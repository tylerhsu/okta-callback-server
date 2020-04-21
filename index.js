const url = require('url');
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const querystring = require('querystring');
const childProcess = require('child_process');

const PORT = 21232;
const REDIRECT_URI = `http://127.0.0.1:${PORT}/callback`;
const states = new Map();

const server = http.createServer(async (req, res) => {
  try {
    console.log(req.url);
    const queryParams = url.parse(req.url, true).query;
    if (req.url.startsWith('/get_access_token')) {
      const { clientId, oktaBaseUrl } = queryParams;
      const result = await handleGetAccessToken(clientId, oktaBaseUrl);
      return res.writeHead(200).end(result);
    } else if (req.url.startsWith('/callback')) {
      const { code, state: stateId } = queryParams;
      const result = await handleCallback(code, stateId);
      return res.writeHead(200).end(result);
    } else {
      return res.writeHead(404).end('404');
    }
  } catch (err) {
    console.log(err);
    const statusCode = err.statusCode || 500;
    res.writeHead(statusCode).end(err.message || err || 'Unhandled error');
  }
});

server.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});

async function handleGetAccessToken(clientId, oktaBaseUrl) {
  const codeVerifier = randomString();
  const codeChallenge = base64UrlEncode(crypto.createHash('sha256').update(codeVerifier).digest());
  const stateId = randomString();
  const authCodeUrl = new url.URL(`${oktaBaseUrl}/v1/authorize`);
  authCodeUrl.search = querystring.stringify({
    state: stateId,
    client_id: clientId,
    response_type: 'code',
    scope: 'openid offline_access',
    redirect_uri: REDIRECT_URI,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
  });

  childProcess.spawn('open', [authCodeUrl]).unref();

  return new Promise((resolve, reject) => {
    const state = {
      id: stateId,
      clientId,
      oktaBaseUrl,
      codeVerifier,
      codeChallenge,
      resolve: (...args) => {
        states.delete(stateId);
        resolve(...args);
      },
      reject: (err) => {
        states.delete(stateId);
        reject(err);
      },
    };
    states.set(state.id, state);
    setTimeout(() => {
      state.reject(new Error('Timed out'));
    }, 60000);
  });
}

async function handleCallback(authorizationCode, stateId) {
  if (!states.has(stateId)) {
    throw new Error(`Unrecognized state id ${stateId}`);
  }
  const state = states.get(stateId);
  let accessTokenResponse;
  try {
    accessTokenResponse = await request(
      `${state.oktaBaseUrl}/v1/token`,
      {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cache-Control': 'no-cache',
        },
      },
      querystring.stringify({
        code: authorizationCode,
        code_verifier: state.codeVerifier,
        client_id: state.clientId,
        grant_type: 'authorization_code',
        redirect_uri: REDIRECT_URI,
      }),
    );
  } catch (err) {
    const msg = `Problem getting access token from okta: ${err}`;
    state.reject(new Error(msg));
    throw new Error(msg);
  }

  const responseJson = JSON.parse(accessTokenResponse.body);
  if (responseJson.error) {
    const msg = `${responseJson.error}: ${responseJson.error_description}`;
    throw new Error(msg);
  } else {
    state.resolve(accessTokenResponse.body);
    return 'You can close this window now';
  }
}

function base64UrlEncode(str) {
  return str.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function randomString() {
  return base64UrlEncode(crypto.randomBytes(30).toString('hex'));
}

async function request(url, options, data) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options);
    if (data) {
      req.write(data, 'utf8');
    }
    req.end();
    req.on('response', (res) => {
      let data = '';
      res
        .setEncoding('utf8')
        .on('data', (chunk) => {
          data += chunk;
        })
        .on('end', () => {
          res.body = data;
          resolve(res);
        })
        .on('error', (err) => {
          reject(err);
        });
    });
  });
}
