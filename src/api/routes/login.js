/**
 * /api-login/login — endpoint de bienvenida + creación tácita del usuario.
 * --------------------------------------------------------------
 * Usado por el frontend tras un login OAuth exitoso para confirmar
 * la sesión, sincronizar el perfil con la BDD y devolver datos del
 * usuario (nombre, picture, etc).
 */
const express = require('express');
const databaseService = require('../../services/databaseService');
const loggingService = require('../../services/loggingService');

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const user = req.user;
    if (!user?.email) {
      return res.status(401).json({ status: 'error', code: 'NO_USER', message: 'Usuario no autenticado.' });
    }

    const profile = await databaseService.upsertUserProfile({
      email: user.email,
      name: user.name,
      sub: user.sub,
      picture: user.picture,
    });

    loggingService.info('User session confirmed', { email: user.email });

    return res.status(200).json({
      status: 'success',
      data: {
        email: profile.email,
        nombre: profile.nombre,
        picture: profile.picture,
      },
      message: 'Bienvenido al despacho.',
    });
  } catch (err) {
    loggingService.error('Login error', { error: err.message });
    return res.status(500).json({ status: 'error', code: 'LOGIN_FAILED', message: 'Error iniciando sesión.' });
  }
});

module.exports = router;
