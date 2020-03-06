# Okta Callback Server
A long-lived server that will execute the [PKCE Authorization Code flow](https://developer.okta.com/docs/guides/implement-auth-code-pkce/overview/) with an Okta application of your choice.  Only works on mac.

## Installation
```
$ git clone git@github.com:tylerhsu/okta-callback-server
```

## Usage
Run the server:
```
$ node index.js
Listening on port 21232
```

Request an access code, where `oktaClientId` is the client ID of an okta application, and `oktaBaseUrl` is the absolute URL to an Okta server's OAuth2 API, e.g. `https://example.okta.com/oauth2/default`:
```
$ curl --request GET 'http://localhost:21232/get_access_token?clientId=<oktaClientId>&oktaBaseUrl=<oktaBaseUrl>'
{"token_type":"Bearer","expires_in":3600,"access_token":<accessToken>}
```