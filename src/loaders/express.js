/**
 * express loader · CORS + middlewares + rutas
 * --------------------------------------------------------------
 * Las rutas públicas (/health, /auth/*) van sin OAuth; /login va
 * detrás de verifyGoogleOAuth.
 */
const express = require('express');
const cors = require('cors');
const { verifyGoogleOAuth } = require('../middleware/auth');
const loggingService = require('../services/loggingService');
const config = require('../../config');

const healthRoutes = require('../api/routes/health');
const loginRoutes = require('../api/routes/login');
const authRoutes = require('../api/routes/auth');

module.exports = (app) => {
  app.use(loggingService.requestLogger());

  const validOrigins = config.allowedOrigins;

  const corsOptions = process.env.NODE_ENV === 'test' ? {
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS', 'DELETE', 'PUT'],
    allowedHeaders: ['Authorization', 'Content-Type'],
  } : {
    origin: (origin, callback) => {
      if (!origin || validOrigins.includes(origin)) return callback(null, true);
      loggingService.warn('CORS origin rejected', { origin });
      return callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type'],
  };

  app.use(cors(corsOptions));
  app.use(express.json());

  // Rutas públicas
  app.use('/api-login/health', healthRoutes);
  app.use('/api-login/auth', authRoutes);

  // Rutas autenticadas
  app.use('/api-login/login', (req, res, next) => {
    if (req.method === 'OPTIONS') return next();
    return verifyGoogleOAuth(req, res, next);
  }, loginRoutes);

  app.use(loggingService.errorLogger());

  loggingService.info('login-service routes registered', {
    endpoints: [
      'GET  /api-login/health',
      'GET  /api-login/auth/google',
      'GET  /api-login/auth/google/callback',
      'POST /api-login/auth/refresh',
      'POST /api-login/auth/logout',
      'POST /api-login/login',
    ],
  });
};
