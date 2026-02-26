// oauth-config.js
const config = {
  authEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  clientId: '1024356103437-7a7n0ju1vvu12cijrt138jv1vdtjnneg.apps.googleusercontent.com',
  scope: 'https://www.googleapis.com/auth/calendar.readonly',
  redirectUri: chrome.identity.getRedirectURL('oauth2')
};

// oauth.js
class OAuth2Handler {
  constructor(config) {
    this.config = config;
    this.tokenInfo = null;
  }

  async generateCodeVerifier() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return base64URLEncode(array);
  }

  async generateCodeChallenge(verifier) {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return base64URLEncode(new Uint8Array(hash));
  }

  async authorize() {
    try {
      const codeVerifier = await this.generateCodeVerifier();
      const codeChallenge = await this.generateCodeChallenge(codeVerifier);
      
      const authParams = new URLSearchParams({
        client_id: this.config.clientId,
        response_type: 'code',
        redirect_uri: this.config.redirectUri,
        scope: this.config.scope,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        access_type: 'offline',
        prompt: 'consent'
      });

      const authUrl = `${this.config.authEndpoint}?${authParams.toString()}`;

      const responseUrl = await chrome.identity.launchWebAuthFlow({
        url: authUrl,
        interactive: true
      });

      return await this.handleAuthResponse(responseUrl, codeVerifier);
    } catch (error) {
      console.error('Authorization failed:', error);
      throw error;
    }
  }

  async handleAuthResponse(responseUrl, codeVerifier) {
    const urlParams = new URLSearchParams(new URL(responseUrl).search);
    const code = urlParams.get('code');
    
    if (!code) {
      throw new Error('No authorization code received');
    }

    return await this.exchangeCodeForToken(code, codeVerifier);
  }

  async exchangeCodeForToken(code, codeVerifier) {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.config.clientId,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: this.config.redirectUri,
        code_verifier: codeVerifier
      })
    });

    const tokenInfo = await tokenResponse.json();
    
    if (!tokenResponse.ok) {
      throw new Error('Token exchange failed');
    }

    // Store tokens securely
    await chrome.storage.local.set({
      'access_token': tokenInfo.access_token,
      'refresh_token': tokenInfo.refresh_token,
      'expires_at': Date.now() + (tokenInfo.expires_in * 1000)
    });

    return tokenInfo;
  }

  async getValidToken() {
    const storage = await chrome.storage.local.get([
      'access_token',
      'refresh_token',
      'expires_at'
    ]);

    if (!storage.access_token) {
      return await this.authorize();
    }

    if (Date.now() >= storage.expires_at) {
      return await this.refreshToken(storage.refresh_token);
    }

    return {
      access_token: storage.access_token,
      expires_at: storage.expires_at
    };
  }

  async refreshToken(refreshToken) {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.config.clientId,
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      })
    });

    const tokenInfo = await response.json();
    
    if (!response.ok) {
      // If refresh fails, trigger new authorization
      return await this.authorize();
    }

    await chrome.storage.local.set({
      'access_token': tokenInfo.access_token,
      'expires_at': Date.now() + (tokenInfo.expires_in * 1000)
    });

    return tokenInfo;
  }
}

// Helper function for PKCE
function base64URLEncode(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}


// usage-example.js
const oauth = new OAuth2Handler(config);

async function makeAuthenticatedRequest() {
  try {
    const tokenInfo = await oauth.getValidToken();
    
    const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      headers: {
        'Authorization': `Bearer ${tokenInfo.access_token}`
      }
    });
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
}


/*

## Response Type Differences

**token (Implicit Flow)**
- Returns an access token directly in the URL fragment[6]
- No intermediate code exchange step[6]
- Less secure as tokens are exposed in browser history[6]
- Short-lived access tokens (typically 5-10 minutes)[6]
- No refresh tokens provided[6]

**code (Authorization Code Flow)**
- Returns a temporary authorization code first[5]
- Requires an additional server-side exchange for access token[5]
- More secure as tokens are exchanged through back channels[5]
- Can provide both access and refresh tokens[5]
- Longer-lived access possible through refresh tokens[4]

## Access Type Differences

**online**
- Designed for immediate access[3]
- User must be present during authentication
- No refresh tokens provided
- Better for short-term access scenarios

**offline**
- Enables long-term access through refresh tokens[4]
- Can access resources even when user is not present
- Provides refresh tokens for obtaining new access tokens[4]
- Better for background/server-side operations

## Security Considerations

The Authorization Code flow with `response_type=code` is now considered the more secure option[4]. OAuth 2.1 is actually removing the Implicit flow (`response_type=token`) due to security concerns[4]. For modern applications, you should use the Authorization Code flow with PKCE for enhanced security[4].

*/