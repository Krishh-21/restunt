import express from 'express';
import { createServer } from 'http';
import { logger, requestLogging } from './logger';

test('request logs correlate failures without capturing credentials or customer identifiers', async () => {
  const log = jest.spyOn(logger, 'info').mockImplementation(() => logger);
  const app = express();
  app.use(requestLogging);
  app.post('/customers/:id', (_req, res) => res.status(403).json({ error: 'Forbidden' }));
  const server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address() as { port: number };
    const response = await fetch(`http://127.0.0.1:${address.port}/customers/private-customer?token=secret-query`, {
      method: 'POST', headers: { authorization: 'Bearer secret-token', 'content-type': 'application/json' },
      body: JSON.stringify({ password: 'private-password' }),
    });
    await response.text();
    expect(response.headers.get('X-Request-ID')).toMatch(/^[a-f0-9-]{36}$/);
    expect(log).toHaveBeenCalledWith('http.request', expect.objectContaining({
      requestId: response.headers.get('X-Request-ID'), route: '/customers/:id', status: 403,
    }));
    const output = JSON.stringify(log.mock.calls);
    for (const secret of ['private-customer', 'secret-query', 'secret-token', 'private-password']) expect(output).not.toContain(secret);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    log.mockRestore();
  }
});
