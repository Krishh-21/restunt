# Portable Docker setup

This setup runs PostgreSQL 16, Redis 7 and one Node 22 application image. The API serves all five frontends on one origin. No hosting account is required for local use. The same image can run on a Docker-capable Linux server. Initial package/image downloads require internet.

## First local start

Install Node 22+ and Docker with Compose. From the repository root:

```sh
npm run setup:env
docker compose up -d --build
```

`setup:env` creates a private `.env` with random JWT, database and backup secrets. It preserves an existing `.env`. Compose applies committed migrations automatically and preserves database, Redis and encrypted backup volumes. Do not run `docker compose down -v` on data you need.

Open http://localhost:5000/pos/ . Other apps: `/captain/`, `/kitchen/`, `/qr/`, `/store/`. `/health` checks the process; `/ready` checks PostgreSQL and Redis. Start with local development mode; production requires HTTPS configuration below.

Fill the six `INITIAL_*` settings in `.env` with your restaurant name, slug, admin username, password (12+ characters), email and name. Recreate the container to pick up changed environment:

```sh
docker compose up -d --force-recreate api
docker compose exec -T api node node_modules/tsx/dist/cli.mjs scripts/setup-restaurant.ts
```

Provisioning creates the restaurant, admin, first outlet, kitchen station and eight tables. Existing restaurants and passwords are preserved. Log in using your restaurant slug, username and password. Remove `INITIAL_ADMIN_PASSWORD` from `.env` after provisioning and recreate the API container. Add your menu, prices, inventory and staff through the management APIs/UI; provisioning does not invent a restaurant menu. Demo seeding is for disposable local databases only (`node node_modules/tsx/dist/cli.mjs prisma/seed.ts`); it creates known demo credentials.

## Hosting requirements

Choose a Linux server with Docker/Compose, persistent disk, a domain and HTTPS reverse proxy. The supplied Compose file binds ports to localhost; point your host reverse proxy at `127.0.0.1:5000`. Keep PostgreSQL/Redis private. Configure WebSocket upgrades and forward `Host` and `X-Forwarded-Proto` headers. Use managed databases instead by replacing Compose's internal DATABASE_URL/DIRECT_URL/REDIS_URL overrides with your provider URLs. `DIRECT_URL` must reach the primary database for backups.

Set in `.env`:

```dotenv
NODE_ENV=production
CORS_ORIGIN=https://restaurant.example.com
PUBLIC_STOREFRONT_URL=https://restaurant.example.com/store/
PUBLIC_API_URL=
TRUST_PROXY=1
BACKUP_ENABLED=true
```

Use your real domain. Retain the randomly generated JWT and backup keys. `PUBLIC_API_URL` stays empty for the recommended single-origin setup; only this allowlisted public field is exposed to browsers. Set `TRUST_PROXY` to the actual number of trusted proxy hops and prevent direct access that bypasses your proxy. Check configuration with `docker compose exec -T api node node_modules/tsx/dist/cli.mjs scripts/check-config.ts`. It reports enabled services without printing secrets.

Editing `.env` requires recreating the API container. Docker excludes `.env` and secret files from image builds, so one image is reusable across environments. Separately hosted static frontends need their own `/runtime-config.js` or Vite build-time `VITE_API_URL`, correct CORS and SPA fallback routing. Prefer the provided single-origin setup.

Before upgrading, back up the database and retain the previous image/commit. Run `docker compose up -d --build`; migration failures stop application startup. Existing databases created with `db push` need a reviewed Prisma baseline before `migrate deploy`; do not reset them to resolve migration history errors. There is no automatic destructive migration rollback.

## Optional services

Leave unused provider settings blank. Startup validates related settings together.

| Service | Environment settings | Setup outside `.env` |
| --- | --- | --- |
| Stripe | STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET | Register HTTPS webhook `/api/payments/stripe/webhook`; select checkout completion/expiry and payment failure events; verify sandbox callbacks before live use. |
| Razorpay | RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET | Register HTTPS webhook `/api/payments/razorpay/webhook` for captured/failed payments; use test credentials first. |
| WhatsApp | TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM | Enable a sender, recipient consent and approved Content templates; queue jobs require their template SID and variables. |
| Email alerts | SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASSWORD, SMTP_FROM | Verify sender/domain and SMTP account. Enable email under POS Notifications for each manager. Port 587 uses STARTTLS in production; port 465 normally uses SMTP_SECURE=true. |
| Firebase push adapter | FIREBASE_SERVICE_ACCOUNT_PATH | Mount service-account JSON read-only at the specified container path. Register real device tokens using `/api/notifications/preferences`. Browser token enrollment is not yet implemented; environment values alone cannot grant browser notification permission. |
| Private backup S3 | AWS_REGION, AWS_BUCKET_NAME; optional AWS credentials | Create a private bucket with PutObject permissions and retention/lifecycle rules. Standard AWS role credentials are supported. Never enable public access to backups. |

Gateway payments require connectivity and a verified signed callback. Refunds are not implemented. Email/push use retryable delivery records; ambiguous provider timeouts may cause duplicate delivery. Notification creation follows the business transaction and is not yet a transactional outbox.

## Data export

Restaurant administrators can download orders (including lines), customers, inventory, stock movements, bills, payments, expenses, journal and loyalty records from Management. The selected date range filters record creation dates. JSON is streamed in bounded database batches and contains no staff credentials. Exports contain personal customer data; store them privately. Concurrent changes may appear across collections; use database backups for a consistent recovery snapshot. This is a data-portability tool, not a complete GDPR compliance certification.

## Backups and recovery

The image includes `pg_dump`/`pg_restore` 16. Use a matching client for a different database major version. With BACKUP_ENABLED=true a daily 02:00 container-time backup is scheduled; BACKUP_CRON changes the schedule. Local files live on the `backup-data` volume under `/app/.data/backups/dinely-backups`. S3 can store an additional private copy. Configure retention; local pruning is not automatic. Keep the encryption key separately from the server and backup files. Losing it makes recovery impossible.

Create a manual backup:

```sh
docker compose exec -T api node node_modules/tsx/dist/cli.mjs scripts/backup.ts
```

Copy a selected backup and the key to an isolated recovery environment. Set BACKUP_ENCRYPTION_KEY, then run `npm run backup:decrypt -- input.dump.aes recovered.dump`. Authentication is verified before the destination file is published; existing files are never overwritten. Restore the decrypted custom-format dump with `pg_restore --no-owner --no-acl --dbname <isolated_database> recovered.dump`. Check restored records before switching production connections. Decryption never changes a database automatically.

CI runs an encrypted backup/decrypt/restore round trip into a randomly named isolated database. This verifies the recovery mechanism, not your eventual provider permissions or backup retention.

## Offline behavior and limits

POS/Captain cache the app shell and previously loaded menu, tables and orders. Load them online first over HTTPS (localhost also permits service workers). An existing staff login is needed. Orders and recorded manual payments persist in IndexedDB, scoped to restaurant/outlet/user. Reconnect using the same account; expired sessions need online sign-in before replay. Keep the browser profile and site data until every pending operation is acknowledged.

Manual payment records remain provisional until the server accepts them; invoices are issued only by the server. A price/table/cash-drawer conflict remains visible and retained for review. Cash settlement still requires an open server cash drawer. A recorded card/UPI/wallet payment means payment was accepted separately; the offline app does not contact a bank or terminal. Duplicate operation replay does not duplicate invoices or stock deduction. Online gateway payments, new sign-in, administrative writes and full offline order edits/voids remain online-only. Generic vector-clock conflict merging and comprehensive browser acceptance tests remain unfinished.

## Remaining specification work

`.kiro/specs/dinely/progress.md` tracks the wider specification. Docker portability and environment validation do not complete delivery/rider workflows, aggregators, printer hardware transport, refunds, dedicated schemas/read replicas, all exports, or production acceptance/security/performance testing. These are implementation gaps as well as external integration tasks; adding credentials does not finish them.
