import './loadEnv';
import { z } from 'zod';
const optional = z.preprocess((v) => (v === '' ? undefined : v), z.string().optional());
const flag = z
  .enum(['true', 'false'])
  .default('false')
  .transform((v) => v === 'true');
export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(5000),
    DATABASE_URL: z
      .string()
      .url()
      .refine((v) => /^postgres(ql)?:/.test(v), 'Use a PostgreSQL URL'),
    REDIS_URL: z.string().url().default('redis://localhost:6379'),
    JWT_SECRET: z.string().min(32),
    CORS_ORIGIN: optional,
    PUBLIC_API_URL: optional,
    PUBLIC_STOREFRONT_URL: optional,
    SERVE_FRONTENDS: flag,
    TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(0),
    STRIPE_SECRET_KEY: optional,
    STRIPE_WEBHOOK_SECRET: optional,
    RAZORPAY_KEY_ID: optional,
    RAZORPAY_KEY_SECRET: optional,
    RAZORPAY_WEBHOOK_SECRET: optional,
    TWILIO_ACCOUNT_SID: optional,
    TWILIO_AUTH_TOKEN: optional,
    TWILIO_WHATSAPP_FROM: optional,
    AWS_REGION: z.string().default('us-east-1'),
    AWS_BUCKET_NAME: optional,
    BACKUP_DIRECTORY: optional,
    BACKUP_ENABLED: flag,
    BACKUP_ENCRYPTION_KEY: optional,
    SMTP_HOST: optional,
    SMTP_PORT: z.coerce.number().int().default(587),
    SMTP_SECURE: flag,
    SMTP_USER: optional,
    SMTP_PASSWORD: optional,
    SMTP_FROM: optional,
    FIREBASE_SERVICE_ACCOUNT_PATH: optional,
  })
  .superRefine((e, ctx) => {
    const issue = (field: string, message: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [field], message });
    const group = (fields: (keyof typeof e)[]) => {
      if (fields.some((k) => !!e[k]) && fields.some((k) => !e[k]))
        issue(fields[0], 'Configure all fields together: ' + fields.join(', '));
    };
    group(['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET']);
    group(['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET']);
    group(['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_WHATSAPP_FROM']);
    if ((e.STRIPE_SECRET_KEY || e.RAZORPAY_KEY_ID) && !e.PUBLIC_STOREFRONT_URL)
      issue('PUBLIC_STOREFRONT_URL', 'Required for customer checkout');
    for (const key of ['PUBLIC_API_URL', 'PUBLIC_STOREFRONT_URL'] as const)
      if (e[key]) {
        try {
          const u = new URL(e[key]!);
          if (e.NODE_ENV === 'production' && u.protocol !== 'https:')
            issue(key, 'Production public URLs require HTTPS');
        } catch {
          issue(key, 'Use a valid URL');
        }
      }
    if (e.NODE_ENV === 'production') {
      if (/local-development|dev-secret|change.me/i.test(e.JWT_SECRET))
        issue('JWT_SECRET', 'Replace the development secret');
      if (!e.CORS_ORIGIN) issue('CORS_ORIGIN', 'Set allowed HTTPS browser origins in production');
      else
        for (const origin of e.CORS_ORIGIN.split(',')) {
          try {
            const u = new URL(origin.trim());
            if (u.protocol !== 'https:') issue('CORS_ORIGIN', 'Use HTTPS origins in production');
          } catch {
            issue('CORS_ORIGIN', 'Use a comma-separated list of URL origins');
          }
        }
    }
    if (e.SMTP_HOST && !e.SMTP_FROM) issue('SMTP_FROM', 'Required when SMTP is configured');
    if (!!e.SMTP_USER !== !!e.SMTP_PASSWORD)
      issue('SMTP_USER', 'Set SMTP_USER and SMTP_PASSWORD together');
    if (
      e.BACKUP_ENABLED &&
      (!e.BACKUP_ENCRYPTION_KEY || !/^([a-f0-9]{64})$/i.test(e.BACKUP_ENCRYPTION_KEY))
    )
      issue('BACKUP_ENCRYPTION_KEY', 'Set 64 hex characters for enabled backups');
    if (e.BACKUP_ENABLED && !e.BACKUP_DIRECTORY && !e.AWS_BUCKET_NAME)
      issue('BACKUP_ENABLED', 'Configure BACKUP_DIRECTORY or AWS_BUCKET_NAME');
  });
export function readConfiguration(values: NodeJS.ProcessEnv) {
  const parsed = envSchema.safeParse(values);
  if (!parsed.success)
    throw new Error(
      'Invalid configuration:\n' +
        parsed.error.issues.map((i) => i.path.join('.') + ': ' + i.message).join('\n')
    );
  return parsed.data;
}
