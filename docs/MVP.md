# Dinely MVP

Dinely provides a POS, kitchen display, captain access, QR menu and online storefront. This is the MVP handover; the larger enterprise specification remains partially implemented.

## Start and create accounts

1. Install Docker with Compose and Node.js 22 or newer.
2. Run `npm run setup:env` to generate private local secrets.
3. Fill the six `INITIAL_*` settings in `.env`. Choose an administrator password of at least 12 characters. Never commit `.env`.
4. Run `docker compose up -d --build`.
5. Run `docker compose exec api npm run setup:restaurant`. This creates your restaurant, first outlet, administrator, station and tables. Repeating it preserves existing passwords.
6. Open http://localhost:5000/pos/ and sign in with the restaurant slug, administrator username and password. Add menu items and staff through Management.
7. Remove `INITIAL_ADMIN_PASSWORD` from `.env` after setup and recreate the API container. Store your secrets securely.

Staff roles: ADMIN, MANAGER, CASHIER, SERVER, KITCHEN and RIDER. Administrators create staff and assign outlets through Management. Rider accounts exist but delivery dispatch is outside this MVP. No shared production passwords are preloaded. Creating actual accounts requires a running database; no live restaurant or external provider accounts have been created for you.

## Included

- Restaurant and outlet scoped login, permissions and staff management.
- Menu modifiers, tables, orders, KOT, kitchen status, bills and manual payments.
- Durable offline order creation and manual payment queues with reconnect replay and conflict visibility.
- Inventory, procurement, recipes, loyalty, expenses, cash drawer and basic analytics.
- Public QR menu and storefront; optional Stripe/Razorpay checkout and signed webhooks.
- Admin JSON export, encrypted PostgreSQL backups and optional S3 storage.
- Optional SMTP, Firebase and Twilio adapters configured through environment settings.

## Hosting and operations

The portable default is Docker with PostgreSQL and Redis. Public hosting still needs a server, domain, HTTPS reverse proxy, private secrets, persistent volumes and backup storage. Provider accounts and dashboard configuration cannot be replaced by environment variables alone. See [portable deployment](PORTABLE_DEPLOYMENT.md) for configuration and recovery commands.

Use `docker compose logs --tail=200 api` for application logs and `docker compose logs --tail=200 postgres redis` for dependency logs. `/health` checks the process; `/ready` checks PostgreSQL and Redis. Business audit records are available through the authenticated audit API. Do not publish private logs or credentials.

## Validation and limits

The previous release passed nine workspace builds, 100 core tests, real PostgreSQL migrations, Docker smoke tests, Chromium offline/reconnect flows, JSON export and encrypted backup restoration in CI. Real provider callbacks, message delivery and production deployment require your accounts and acceptance testing.

The full specification is unfinished: dedicated tenant schemas, complete offline edits/voids, refunds, delivery integrations, printer hardware, campaigns, advanced monitoring and comprehensive performance/security acceptance remain incomplete. See [task progress](../.kiro/specs/dinely/progress.md). MVP delivery does not mean every specification checkbox is complete.
