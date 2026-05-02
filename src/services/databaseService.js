/**
 * databaseService · persistencia OAuth + usuarios
 * --------------------------------------------------------------
 * Tabla principal: dt_usuarios
 *   email TEXT PRIMARY KEY
 *   nombre TEXT
 *   refresh_token TEXT
 *   refresh_token_expires_at TIMESTAMP
 *   created_at, updated_at TIMESTAMP
 */
const { pool } = require('../config/database');
const loggingService = require('./loggingService');

class DatabaseService {
  async saveRefreshToken(email, refreshToken, expiresAt) {
    const sql = `
      INSERT INTO dt_usuarios (email, refresh_token, refresh_token_expires_at, updated_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (email) DO UPDATE SET
        refresh_token = EXCLUDED.refresh_token,
        refresh_token_expires_at = EXCLUDED.refresh_token_expires_at,
        updated_at = NOW()
      RETURNING email
    `;
    const { rows } = await pool.query(sql, [email, refreshToken, expiresAt]);
    return rows[0];
  }

  async getRefreshToken(email) {
    const { rows } = await pool.query(
      'SELECT refresh_token AS "refreshToken", refresh_token_expires_at AS "expiresAt" FROM dt_usuarios WHERE email = $1',
      [email]
    );
    return rows[0] || null;
  }

  async upsertUserProfile(profile) {
    const sql = `
      INSERT INTO dt_usuarios (email, nombre, sub_oauth, picture, updated_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (email) DO UPDATE SET
        nombre = COALESCE(EXCLUDED.nombre, dt_usuarios.nombre),
        sub_oauth = COALESCE(EXCLUDED.sub_oauth, dt_usuarios.sub_oauth),
        picture = COALESCE(EXCLUDED.picture, dt_usuarios.picture),
        updated_at = NOW()
      RETURNING email, nombre, picture, sub_oauth
    `;
    try {
      const { rows } = await pool.query(sql, [profile.email, profile.name, profile.sub, profile.picture]);
      return rows[0];
    } catch (err) {
      loggingService.error('Error upserting user profile', { error: err.message, email: profile.email });
      throw err;
    }
  }

  async revokeRefreshToken(email) {
    await pool.query(
      'UPDATE dt_usuarios SET refresh_token = NULL, refresh_token_expires_at = NULL, updated_at = NOW() WHERE email = $1',
      [email]
    );
  }
}

module.exports = new DatabaseService();
