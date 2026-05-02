const express = require('express');
const router = express.Router();
const { pool } = require('../../config/database');

/**
 * GET /api-login/health
 * Liveness + readiness probe. Devuelve 200 si la BDD responde.
 */
router.get('/', async (_req, res) => {
  const checks = { service: 'login-service', timestamp: new Date().toISOString() };
  try {
    const { rows } = await pool.query('SELECT NOW() as now');
    checks.database = 'ok';
    checks.now = rows[0].now;
    res.status(200).json({ status: 'success', data: checks });
  } catch (err) {
    checks.database = 'error';
    checks.error = err.message;
    res.status(503).json({ status: 'error', code: 'DB_UNAVAILABLE', data: checks });
  }
});

module.exports = router;
