import { readConfiguration } from './config';
const base = { DATABASE_URL: 'postgresql://u:p@localhost/db', JWT_SECRET: 'a'.repeat(40) };
test('local-only configuration disables optional integrations', () => {
  expect(readConfiguration(base).SERVE_FRONTENDS).toBe(false);
});
test('errors identify names without echoing credentials', () => {
  expect(() => readConfiguration({ ...base, RAZORPAY_KEY_SECRET: 'private-value' })).toThrow(
    'RAZORPAY_KEY_ID'
  );
  try {
    readConfiguration({ ...base, RAZORPAY_KEY_SECRET: 'private-value' });
  } catch (e) {
    expect((e as Error).message).not.toContain('private-value');
  }
});
test('production rejects development secrets and insecure origins', () => {
  expect(() =>
    readConfiguration({ ...base, NODE_ENV: 'production', CORS_ORIGIN: 'http://example.com' })
  ).toThrow('HTTPS');
  expect(() =>
    readConfiguration({
      ...base,
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://example.com',
      JWT_SECRET: 'local-development-secret-1234567890',
    })
  ).toThrow('development secret');
});
test('configured providers require webhook and return URL', () => {
  expect(() => readConfiguration({ ...base, STRIPE_SECRET_KEY: 'sk_test_x' })).toThrow(
    'STRIPE_WEBHOOK_SECRET'
  );
  expect(() =>
    readConfiguration({ ...base, STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_WEBHOOK_SECRET: 'whsec_x' })
  ).toThrow('PUBLIC_STOREFRONT_URL');
});
test('enabled backups require encrypted storage configuration', () => {
  expect(() => readConfiguration({ ...base, BACKUP_ENABLED: 'true' })).toThrow(
    'BACKUP_ENCRYPTION_KEY'
  );
});
