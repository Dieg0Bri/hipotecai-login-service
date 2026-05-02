/**
 * oauthService · flujo OAuth 2.0 de Google
 * --------------------------------------------------------------
 *  · generateAuthUrl       — URL de consentimiento de Google
 *  · exchangeCodeForTokens — code → access_token + refresh_token + id_token
 *  · refreshAccessToken    — refresh_token → nuevo access_token (+ id_token si Google lo devuelve)
 *  · generateFrontendCallbackUrl — empaca tokens (sin refresh) y arma redirect
 *
 * El refresh_token NUNCA se entrega al frontend: queda persistido
 * en `dt_usuarios` por databaseService.saveRefreshToken.
 */
const config = require('../../config');
const loggingService = require('./loggingService');

const REFRESH_TOKEN_DURATION_S = 7 * 24 * 60 * 60; // 7 días

class OAuthService {
  constructor() {
    this.clientId = config.googleClientId;
    this.clientSecret = config.googleClientSecret;
    this.frontendUrl = config.frontendUrl;
  }

  generateAuthUrl(baseUrl, state = null) {
    if (!this.clientId) throw new Error('GOOGLE_CLIENT_ID no configurado');

    const redirectUri = `${baseUrl}/api-login/auth/google/callback`;
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'email profile openid',
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
    });
    if (state) params.append('state', state);

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async exchangeCodeForTokens(code, baseUrl) {
    if (!this.clientId || !this.clientSecret) {
      throw new Error('Credenciales OAuth no configuradas');
    }

    const redirectUri = `${baseUrl}/api-login/auth/google/callback`;
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }).toString(),
    });

    const data = await response.json();
    if (!response.ok) {
      loggingService.error('Token exchange failed', { error: data.error, description: data.error_description });
      throw new Error(data.error_description || data.error || 'Error intercambiando código por tokens');
    }

    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      id_token: data.id_token,
      expiry_time: Date.now() + (data.expires_in * 1000),
      token_type: data.token_type || 'Bearer',
      refresh_token_expires_at: Date.now() + (REFRESH_TOKEN_DURATION_S * 1000),
    };
  }

  async refreshAccessToken(refreshToken) {
    if (!refreshToken) throw new Error('refresh_token requerido');
    if (!this.clientId || !this.clientSecret) throw new Error('Credenciales OAuth no configuradas');

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }).toString(),
    });

    const data = await response.json();
    if (!response.ok) {
      const friendly = {
        invalid_grant: 'Refresh token revocado o expirado. El usuario debe volver a iniciar sesión.',
        invalid_client: 'GOOGLE_CLIENT_SECRET inválido o inexistente.',
      }[data.error] || data.error_description || 'Error renovando token';

      const err = new Error(friendly);
      err.code = data.error;
      err.status = response.status;
      throw err;
    }

    return {
      access_token: data.access_token,
      id_token: data.id_token,
      expires_in: data.expires_in || 3600,
      token_type: data.token_type || 'Bearer',
      refresh_token: data.refresh_token,
    };
  }

  generateFrontendCallbackUrl(tokens, redirectBaseUrl = null) {
    const base = redirectBaseUrl || this.frontendUrl;
    const tokensB64 = Buffer.from(JSON.stringify(tokens)).toString('base64');
    return `${base}/auth/callback?tokens=${tokensB64}`;
  }

  generateFrontendErrorUrl(error, redirectBaseUrl = null) {
    const base = redirectBaseUrl || this.frontendUrl;
    return `${base}/login?error=${encodeURIComponent(error)}`;
  }
}

module.exports = new OAuthService();
