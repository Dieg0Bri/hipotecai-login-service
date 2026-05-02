/**
 * Rutas OAuth — flujo de login con Google.
 * --------------------------------------------------------------
 *  GET  /api-login/auth/google           — inicia flujo (redirect a Google)
 *  GET  /api-login/auth/google/callback  — callback (intercambia code → tokens)
 *  POST /api-login/auth/refresh          — renueva access_token usando refresh_token de BDD
 *  POST /api-login/auth/logout           — revoca refresh_token en BDD
 */
const express = require('express');
const oauthService = require('../../services/oauthService');
const databaseService = require('../../services/databaseService');
const jwtService = require('../../services/jwtService');
const loggingService = require('../../services/loggingService');
const { verifyGoogleOAuthAllowExpired, verifyGoogleOAuth } = require('../../middleware/auth');
const config = require('../../../config');

const router = express.Router();

router.get('/google', (req, res) => {
  try {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.headers['x-forwarded-host'] || req.headers['host'];
    const baseUrl = `${protocol}://${host}`;

    let frontendRedirectUri = req.query.redirect_uri || config.frontendUrl;
    const isAllowed = config.allowedOrigins.some((o) => frontendRedirectUri.startsWith(o));
    if (!isAllowed) frontendRedirectUri = config.frontendUrl;

    const state = Buffer.from(JSON.stringify({ redirect_uri: frontendRedirectUri })).toString('base64');
    const authUrl = oauthService.generateAuthUrl(baseUrl, state);

    loggingService.info('Starting OAuth flow', { baseUrl, frontendRedirectUri });
    return res.redirect(authUrl);
  } catch (err) {
    loggingService.error('Error starting OAuth flow', { error: err.message });
    return res.redirect(oauthService.generateFrontendErrorUrl('oauth_error'));
  }
});

router.get('/google/callback', async (req, res) => {
  let frontendRedirectUri = config.frontendUrl;
  try {
    if (req.query.state) {
      const stateData = JSON.parse(Buffer.from(req.query.state, 'base64').toString());
      if (stateData.redirect_uri) frontendRedirectUri = stateData.redirect_uri;
    }
  } catch (err) {
    loggingService.warn('Could not parse state', { error: err.message });
  }

  try {
    if (req.query.error) {
      return res.redirect(`${frontendRedirectUri}/login?error=${encodeURIComponent(req.query.error)}`);
    }

    const code = req.query.code;
    if (!code) return res.redirect(`${frontendRedirectUri}/login?error=no_code`);

    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.headers['x-forwarded-host'] || req.headers['host'];
    const baseUrl = `${protocol}://${host}`;

    const tokens = await oauthService.exchangeCodeForTokens(code, baseUrl);

    // Decodificar id_token para obtener email + perfil
    const idPayload = JSON.parse(Buffer.from(tokens.id_token.split('.')[1], 'base64').toString());

    // Upsert perfil del usuario
    await databaseService.upsertUserProfile({
      email: idPayload.email,
      name: idPayload.name,
      sub: idPayload.sub,
      picture: idPayload.picture,
    });

    // Persistir refresh_token (NUNCA se envía al frontend)
    if (tokens.refresh_token) {
      await databaseService.saveRefreshToken(
        idPayload.email,
        tokens.refresh_token,
        new Date(tokens.refresh_token_expires_at)
      );
    }

    const frontendTokens = {
      access_token: tokens.access_token,
      id_token: tokens.id_token,
      expiry_time: tokens.expiry_time,
      token_type: tokens.token_type,
    };

    return res.redirect(oauthService.generateFrontendCallbackUrl(frontendTokens, frontendRedirectUri));
  } catch (err) {
    loggingService.error('OAuth callback error', { error: err.message, stack: err.stack });
    return res.redirect(oauthService.generateFrontendErrorUrl('token_error', frontendRedirectUri));
  }
});

router.post('/refresh', verifyGoogleOAuthAllowExpired, async (req, res) => {
  try {
    const userEmail = req.user?.email;
    if (!userEmail) {
      return res.status(401).json({ status: 'error', code: 'UNAUTHORIZED', message: 'Usuario no identificable.' });
    }

    const stored = await databaseService.getRefreshToken(userEmail);
    if (!stored?.refreshToken) {
      return res.status(401).json({ status: 'error', code: 'NO_REFRESH_TOKEN', message: 'No hay refresh token. Volver a iniciar sesión.' });
    }

    const refreshed = await oauthService.refreshAccessToken(stored.refreshToken);

    // Rotación: si Google entrega un nuevo refresh_token, persistirlo
    if (refreshed.refresh_token) {
      const newExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await databaseService.saveRefreshToken(userEmail, refreshed.refresh_token, newExpiry);
    }

    let idToken = refreshed.id_token;
    let expiresIn = refreshed.expires_in;

    // Google a veces no devuelve id_token; firmamos uno propio
    if (!idToken) {
      const jwtResult = jwtService.generateToken(req.user);
      idToken = jwtResult.token;
      expiresIn = jwtResult.expiresIn;
    }

    return res.status(200).json({
      access_token: refreshed.access_token,
      id_token: idToken,
      expires_in: expiresIn,
      token_type: refreshed.token_type,
    });
  } catch (err) {
    loggingService.error('Refresh token error', { error: err.message, code: err.code });
    return res.status(err.status || 500).json({
      status: 'error',
      code: err.code || 'REFRESH_FAILED',
      message: err.message || 'Error renovando token.',
    });
  }
});

router.post('/logout', verifyGoogleOAuth, async (req, res) => {
  try {
    await databaseService.revokeRefreshToken(req.user.email);
    return res.status(200).json({ status: 'success', message: 'Sesión cerrada.' });
  } catch (err) {
    loggingService.error('Logout error', { error: err.message });
    return res.status(500).json({ status: 'error', code: 'LOGOUT_FAILED', message: 'Error cerrando sesión.' });
  }
});

module.exports = router;
