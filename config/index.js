/**
 * login-service · configuración central
 * --------------------------------------------------------------
 * Variables de entorno cargadas desde .env. Sin variables a tope
 * sensibles hardcoded — Diego configura las suyas en Cloud Run.
 */
const dotenv = require('dotenv');

dotenv.config();

module.exports = {
  port: parseInt(process.env.PORT, 10) || 8081,
  environment: process.env.NODE_ENV || 'production',
  skipAuth: process.env.SKIP_AUTH === 'true',

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',
  serviceVersion: process.env.SERVICE_VERSION || '0.0.1',
  serviceName: 'login-service',

  // Google OAuth
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,

  // JWT (token autofirmado para refresh sin id_token de Google)
  jwtSecret: process.env.JWT_SECRET || process.env.GOOGLE_CLIENT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',

  // Frontend
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3030',

  // API Gateway (cuando se despliegue tras gateway de GCP)
  apiGatewayUrl: process.env.API_GATEWAY_URL,

  // CORS — orígenes permitidos
  allowedOrigins: (process.env.ALLOWED_ORIGINS || 'http://localhost:3030,http://localhost:3000,http://127.0.0.1:3030').split(','),

  // PostgreSQL (Cloud SQL)
  database: {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'hipotecai',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  },
};
