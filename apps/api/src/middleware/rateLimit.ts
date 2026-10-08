import type { RequestHandler } from 'express';
// Per-process guard; use a shared Redis/WAF limit for a multi-instance deployment.
export function rateLimit(limit: number, windowMs = 60000): RequestHandler {
  const attempts = new Map<string, { count: number; reset: number }>();
  return (req, res, next) => {
    const now = Date.now(),
      key = req.ip ?? 'unknown';
    let entry = attempts.get(key);
    if (!entry || entry.reset <= now) {
      if (attempts.size > 10000)
        for (const [ip, value] of attempts) if (value.reset <= now) attempts.delete(ip);
      if (attempts.size > 20000) {
        res.status(503).json({ error: { code: 'BUSY', message: 'Try again later' } });
        return;
      }
      entry = { count: 0, reset: now + windowMs };
      attempts.set(key, entry);
    }
    if (++entry.count > limit) {
      res.setHeader('Retry-After', Math.ceil((entry.reset - now) / 1000));
      res
        .status(429)
        .json({ error: { code: 'RATE_LIMIT', message: 'Too many requests; try again later' } });
      return;
    }
    next();
  };
}
