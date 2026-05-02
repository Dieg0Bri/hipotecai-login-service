/**
 * Middleware OAuth 2.0 de Google.
 * --------------------------------------------------------------
 * Detrás del API Gateway de GCP, la información del usuario llega
 * en `X-Apigateway-Api-Userinfo` (base64 JSON). En desarrollo se
 * verifica directamente el id_token con google-auth-library.
 *
 * Expone también `verifyGoogleOAuthAllowExpired` que decodifica el
 * JWT sin validar expiración (para el endpoint /auth/refresh).
 */
const { OAuth2Client } = require('google-auth-library');
const config = require('../../config');
const loggingService = require('../services/loggingService');

const client = config.googleClientId ? new OAuth2Client(config.googleClientId) : null;

const TEST_USER = {
  email: 'test@hipotecai.cl',
  sub: 'test-oauth-id-000',
  name: 'Letrado de prueba',
  picture: '',
  email_verified: true,
};

const verifyGoogleOAuth = async (req, res, next) => {
  try {
    if (config.skipAuth || process.env.NODE_ENV === 'test') {
      req.user = TEST_USER;
      req.userInfo = TEST_USER;
      return next();
    }

    const userInfoHeader = req.headers['x-apigateway-api-userinfo'];
    const authHeader = req.headers['x-forwarded-authorization'] || req.headers['authorization'];

    if (!userInfoHeader && !authHeader) {
      return res.status(401).json({
        status: 'error',
        code: 'NO_AUTH',
        message: 'Se requiere autenticación OAuth.',
      });
    }

    let userInfo = null;

    if (userInfoHeader) {
      try {
        userInfo = JSON.parse(Buffer.from(userInfoHeader, 'base64').toString('utf-8'));
      } catch (err) {
        loggingService.warn('Could not decode X-Apigateway-Api-Userinfo', { error: err.message });
      }
    }

    if (!userInfo && authHeader && client) {
      const token = authHeader.replace('Bearer ', '');
      try {
        const ticket = await client.verifyIdToken({ idToken: token, audience: config.googleClientId });
        const payload = ticket.getPayload();
        userInfo = {
          sub: payload.sub,
          email: payload.email,
          name: payload.name,
          picture: payload.picture,
          email_verified: payload.email_verified,
        };
      } catch (err) {
        loggingService.warn('Invalid id_token', { error: err.message });
        return res.status(401).json({ status: 'error', code: 'INVALID_TOKEN', message: 'Token OAuth inválido o expirado.' });
      }
    }

    if (!userInfo) {
      return res.status(401).json({ status: 'error', code: 'NO_USER_INFO', message: 'No se pudo obtener información del usuario.' });
    }

    if (userInfo.email_verified === false) {
      loggingService.logAuthEvent(userInfo.email, 'email_not_verified', false);
      return res.status(403).json({ status: 'error', code: 'EMAIL_NOT_VERIFIED', message: 'El correo no está verificado en Google.' });
    }

    req.user = userInfo;
    req.userInfo = userInfo;
    loggingService.logAuthEvent(userInfo.email, 'auth_success', true);
    next();
  } catch (err) {
    loggingService.error('OAuth middleware error', { error: err.message, stack: err.stack });
    return res.status(500).json({ status: 'error', code: 'AUTH_ERROR', message: 'Error verificando autenticación.' });
  }
};

const verifyGoogleOAuthAllowExpired = async (req, res, next) => {
  if (req.method === 'OPTIONS') return next();

  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      return res.status(401).json({ status: 'error', code: 'NO_TOKEN', message: 'Se requiere token para renovar.' });
    }

    const token = authHeader.replace('Bearer ', '');
    const parts = token.split('.');
    if (parts.length !== 3) {
      return res.status(401).json({ status: 'error', code: 'BAD_TOKEN', message: 'Formato de token inválido.' });
    }

    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
    if (!payload.email) {
      return res.status(401).json({ status: 'error', code: 'NO_EMAIL', message: 'Token sin email.' });
    }

    req.user = {
      sub: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
      given_name: payload.given_name,
      family_name: payload.family_name,
      hd: payload.hd,
      email_verified: payload.email_verified,
    };
    next();
  } catch (err) {
    loggingService.error('Refresh middleware error', { error: err.message });
    return res.status(401).json({ status: 'error', code: 'INVALID_TOKEN', message: 'No se pudo decodificar el token.' });
  }
};

module.exports = { verifyGoogleOAuth, verifyGoogleOAuthAllowExpired };
