/**
 * login-service · entry point
 * --------------------------------------------------------------
 * Arranca el servidor Express, prueba conexión a PostgreSQL y
 * registra todas las rutas a través de los loaders.
 */
const express = require('express');
const config = require('./config');
const loaders = require('./src/loaders');
const { testConnection } = require('./src/config/database');
const loggingService = require('./src/services/loggingService');

async function startServer() {
  const app = express();

  // Probar conexión a la base de datos antes de aceptar tráfico
  await testConnection();

  await loaders(app);

  app.listen(config.port, '0.0.0.0', () => {
    loggingService.info('login-service started', {
      port: config.port,
      environment: config.environment,
      nodeVersion: process.version,
      timestamp: new Date().toISOString(),
    });
  }).on('error', (err) => {
    loggingService.error('Failed to start login-service', {
      error: err.message,
      stack: err.stack,
    });
    process.exit(1);
  });
}

startServer();
