import { randomUUID } from 'crypto';
import type { RequestHandler } from 'express';
import winston from 'winston';

// Accept only operational metadata, never request bodies, URLs or credentials.
export const logger = winston.createLogger({
  level: ['error', 'warn', 'info', 'debug'].includes(process.env.LOG_LEVEL ?? '') ? process.env.LOG_LEVEL : 'info',
  defaultMeta: { service: 'dinely-api' },
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()],
});

export const requestLogging: RequestHandler = (req, res, next) => {
  const requestId = randomUUID();
  const started = process.hrtime.bigint();
  res.locals.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);
  res.once('finish', () => {
    logger.info('http.request', {
      requestId, method: req.method,
      // Route templates avoid customer identifiers and query-string secrets.
      route: typeof req.route?.path === 'string' ? req.route.path : 'unmatched',
      status: res.statusCode,
      durationMs: Number(process.hrtime.bigint() - started) / 1e6,
    });
  });
  next();
};
