# Run and verify Dinely

Use Node.js 22 and npm 11. Copy `.env.example` to `.env`, then:

```sh
npm ci
npm run db:generate
docker compose up -d postgres redis
npm run db:migrate:deploy
npm run db:seed
npm run dev
```

The demo seed is disabled in production. Sign in to restaurant `demo`, username `admin`, password `admin123`; Captain PIN `1234`. These credentials are for local development. The seed prints the outlet ID; QR links contain valid UUIDs. Open a cash drawer in Management before accepting cash.

Apps: POS 3000, KDS 3001, Captain 3002, QR 3003, Online Store 3004; API 5000. Vite development proxies API requests to localhost:5000. For separately hosted APIs, set VITE_API_URL in each app before building. The root .env is not automatically loaded by Vite workspaces.

```sh
npm run build
npm run test:core
```

CI creates PostgreSQL 16, applies migrations, builds every active workspace, and runs unit tests plus four real transaction tests. Local integration tests require DATABASE_URL and INTEGRATION_DATABASE_URL to match and the database name to end in `_test`. Never point tests at restaurant data.

`docker compose up --build api` builds and starts the API after migrations. Static frontend files in each app's `dist` directory need a static host with SPA fallback. Docker execution is unverified on this workstation, where Docker is unavailable. It does not provision AWS or serve frontend files.

## Existing databases

The initial migration is for an empty database. For an existing database created with `db push`, back up first, compare schema drift, and baseline only if it actually matches. Never blindly apply the initial migration or use `migrate reset` on production.

## Payments and public ordering

Configure sandbox provider keys and webhook secrets. Register `/api/payments/stripe/webhook` and/or `/api/payments/razorpay/webhook`. Raw signatures and stored amounts/currency are verified; browser callbacks never mark payments paid. PUBLIC_STOREFRONT_URL is a fixed HTTPS return URL in production. Duplicate captures or a paid QR order whose table became unavailable require operator refund review.

QR ordering uses `?outletId=<uuid>&tableId=<uuid>`; online ordering uses `?restaurant=<subdomain>` or `?outletId=<uuid>`. Private order tokens remain in browser session storage. Status refreshes every five seconds. Live provider delivery has not been verified.

## Deployment

No hosting target or cloud credentials were present. Use the platform secret manager, set a random JWT_SECRET of at least 32 characters, configure CORS_ORIGIN, HTTPS and database/Redis access, and run the checks above. `/health` checks the process; `/ready` checks database and Redis. Built-in request limits are per process; use a shared gateway/WAF limit for multiple instances.

The database uses public plus one shared tenant schema with explicit tenant filters; dedicated restaurant schemas are not implemented. See `.kiro/specs/dinely/progress.md` for incomplete enterprise features. Backup jobs fail explicitly until a real adapter exists. Twilio workers require consent, E.164 numbers, credentials, and approved templates. Ambiguous provider timeouts can require operator review before retries.
