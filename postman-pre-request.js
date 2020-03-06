const querystring = require('querystring');

if (isAccessTokenExpired()) {
    console.log('Fetching new access token');
    getAccessToken();
} else {
    console.log('Using unexpired access token');
}

function isAccessTokenExpired() {
    const accessToken = pm.environment.get('CURRENT_ACCESS_TOKEN');
    const expiry = pm.environment.get('CURRENT_ACCESS_TOKEN_EXPIRY');
    const now = (new Date()).getTime();
    return !accessToken || !expiry || expiry < now;
}

function getAccessToken() {
    const queryParams = {
        clientId: pm.environment.get('OKTA_CLIENT_ID'),
        oktaBaseUrl: pm.environment.get('OKTA_BASE_URL'),
    };
    const url = `http://127.0.0.1:21232/get_access_token?${querystring.stringify(queryParams)}`;
    pm.sendRequest(url, (err, response) => {
        if (err) {
            throw err;
        } else if (response.code !== 200) {
            const responseText = response.text();
            throw new Error(`Problem fetching access token: ${responseText}`);
        } else {
            const responseJson = response.json();
            const expiry = new Date();
            expiry.setSeconds(expiry.getSeconds() + responseJson.expires_in);
            pm.environment.set('CURRENT_ACCESS_TOKEN', responseJson.access_token);
            pm.environment.set('CURRENT_ACCESS_TOKEN_EXPIRY', expiry.getTime());
        }
    });
}
