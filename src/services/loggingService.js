/**
 * loggingService · logger dual Winston (console) + Cloud Logging
 * --------------------------------------------------------------
 * En Cloud Run (K_SERVICE presente) emite JSON a stdout que GCP
 * Cloud Logging captura automáticamente. En local usa Winston con
 * formato legible. Misma API en ambos entornos.
 */
const winston = require('winston');
const config = require('../../config');

const isCloudRun = !!process.env.K_SERVICE;

// Severidades GCP Cloud Logging
const SEVERITY = {
  debug: 'DEBUG',
  info: 'INFO',
  warn: 'WARNING',
  error: 'ERROR',
};

function structuredLog(level, message, metadata = {}) {
  if (isCloudRun) {
    // En Cloud Run, JSON a stdout = entrada Cloud Logging
    process.stdout.write(JSON.stringify({
      severity: SEVERITY[level] || 'DEFAULT',
      message,
      service: config.serviceName,
      version: config.serviceVersion,
      timestamp: new Date().toISOString(),
      ...metadata,
    }) + '\n');
  } else {
    winstonLogger.log(level, message, metadata);
  }
}

const winstonLogger = winston.createLogger({
  level: config.logLevel,
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
      return `${timestamp} [${config.serviceName}] ${level}: ${message}${metaStr}`;
    })
  ),
  transports: [new winston.transports.Console()],
});

const loggingService = {
  debug: (msg, meta) => structuredLog('debug', msg, meta),
  info:  (msg, meta) => structuredLog('info', msg, meta),
  warn:  (msg, meta) => structuredLog('warn', msg, meta),
  error: (msg, meta) => structuredLog('error', msg, meta),

  /** Middleware Express: attach requestId y log de cada request */
  requestLogger() {
    return (req, _res, next) => {
      req.requestId = req.headers['x-cloud-trace-context']?.split('/')[0]
        || `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      next();
    };
  },

  /** Middleware Express: log de errores no atrapados */
  errorLogger() {
    // eslint-disable-next-line no-unused-vars
    return (err, req, res, next) => {
      loggingService.error('Unhandled error in request', {
        error: err.message,
        stack: err.stack,
        method: req.method,
        url: req.url,
        requestId: req.requestId,
      });
      res.status(500).json({
        status: 'error',
        message: 'Error interno del servidor',
        code: 'INTERNAL_ERROR',
      });
    };
  },

  logAuthEvent(email, event, success = true) {
    structuredLog(success ? 'info' : 'warn', `auth_event:${event}`, { email, event, success });
  },
};

module.exports = loggingService;
