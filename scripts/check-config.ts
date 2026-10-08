import '../apps/api/src/lib/loadEnv';
import { readConfiguration } from '../apps/api/src/lib/config';
try {
  const c = readConfiguration(process.env);
  console.log('Configuration valid.');
  console.log(
    JSON.stringify(
      {
        mode: c.NODE_ENV,
        port: c.PORT,
        frontends: c.SERVE_FRONTENDS,
        stripe: !!c.STRIPE_SECRET_KEY,
        razorpay: !!c.RAZORPAY_KEY_ID,
        whatsapp: !!c.TWILIO_ACCOUNT_SID,
        email: !!c.SMTP_HOST,
        push: !!c.FIREBASE_SERVICE_ACCOUNT_PATH,
        backups: c.BACKUP_ENABLED,
      },
      null,
      2
    )
  );
} catch (error) {
  console.error((error as Error).message);
  process.exitCode = 1;
}
