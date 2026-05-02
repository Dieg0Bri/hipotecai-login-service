/**
 * Pool PostgreSQL compartido por todo el servicio.
 * --------------------------------------------------------------
 * En Cloud Run usa Unix socket vía Cloud SQL Proxy
 * (`/cloudsql/<INSTANCE_CONNECTION_NAME>`); local usa TCP.
 */
const { Pool } = require('pg');
const config = require('../../config');
const loggingService = require('../services/loggingService');

const isCloudRun = !!process.env.K_SERVICE;
const instanceConnectionName = process.env.INSTANCE_CONNECTION_NAME;

const dbConfig = isCloudRun && instanceConnectionName
  ? {
      host: `/cloudsql/${instanceConnectionName}`,
      user: config.database.user,
      password: config.database.password,
      database: config.database.database,
    }
  : config.database;

const pool = new Pool(dbConfig);

pool.on('error', (err) => {
  loggingService.error('Unexpected pg pool error', { error: err.message });
});

async function testConnection() {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    loggingService.info('PostgreSQL connection ok', {
      host: isCloudRun ? `cloudsql:${instanceConnectionName}` : config.database.host,
      database: config.database.database,
    });
  } catch (err) {
    loggingService.error('PostgreSQL connection failed', {
      error: err.message,
      host: isCloudRun ? `cloudsql:${instanceConnectionName}` : config.database.host,
    });
    if (config.environment === 'production') {
      throw err;
    }
  }
}

module.exports = { pool, testConnection };
