const crypto = require('crypto');

/**
 * PKCE (Proof Key for Code Exchange) utilities for OAuth 2.0
 * Implementation based on RFC 7636: https://tools.ietf.org/html/rfc7636
 */

/**
 * Generate a cryptographically random code verifier
 * @returns {string} Base64-URL encoded random string (43-128 characters)
 */
function generateCodeVerifier() {
    // Generate 32 random bytes (will result in 43 characters when base64url encoded)
    const randomBytes = crypto.randomBytes(32);
    return base64URLEncode(randomBytes);
}

/**
 * Generate code challenge from code verifier using S256 method
 * @param {string} codeVerifier - The code verifier
 * @returns {string} Base64-URL encoded SHA256 hash of the code verifier
 */
function generateCodeChallenge(codeVerifier) {
    const hash = crypto.createHash('sha256');
    hash.update(codeVerifier);
    return base64URLEncode(hash.digest());
}

/**
 * Encode a buffer to base64url format (base64 without padding, using URL-safe characters)
 * @param {Buffer} buffer - The buffer to encode
 * @returns {string} Base64-URL encoded string
 */
function base64URLEncode(buffer) {
    return buffer.toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

/**
 * Generate a random state parameter for OAuth flow
 * @returns {string} Random state string
 */
function generateState() {
    const randomBytes = crypto.randomBytes(32);
    return base64URLEncode(randomBytes);
}

/**
 * Build OAuth authorization URL with PKCE parameters
 * @param {object} options - OAuth configuration
 * @param {string} options.clientId - OAuth client ID
 * @param {string} options.redirectUri - Redirect URI after authorization
 * @param {string} options.environment - Genesys Cloud environment (e.g., 'mypurecloud.com')
 * @param {string} options.codeChallenge - PKCE code challenge
 * @param {string} options.state - Random state for CSRF protection
 * @returns {string} Complete authorization URL
 */
function buildAuthorizationUrl(options) {
    const { clientId, redirectUri, environment, codeChallenge, state } = options;
    
    // Construct the authorization URL based on the environment
    const baseUrl = `https://login.${environment}/oauth/authorize`;
    
    const params = new URLSearchParams({
        response_type: 'code',
        client_id: clientId,
        redirect_uri: redirectUri,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        state: state
    });
    
    return `${baseUrl}?${params.toString()}`;
}

module.exports = {
    generateCodeVerifier,
    generateCodeChallenge,
    generateState,
    buildAuthorizationUrl,
    base64URLEncode
};
