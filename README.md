# Dinely Restaurant Operating System

A comprehensive multi-tenant SaaS platform for restaurant businesses built with TypeScript, React 18, Node.js/Express, PostgreSQL, and Redis.

Start with the [Dinely MVP guide](docs/MVP.md) for accounts, deployment, operations and current limits.

## Project Structure

```
dinely-restaurant-os/
├── apps/
│   ├── api/              # Node.js/Express backend
│   ├── web/              # POS Terminal React app
│   ├── kitchen/          # Kitchen Display System
│   ├── captain/          # Mobile Captain/Waiter app
│   ├── qr-menu/          # Customer QR ordering PWA
│   └── online-store/     # Online ordering website
├── packages/
│   ├── types/            # Shared TypeScript types
│   ├── ui/               # Shared UI components
│   └── utils/            # Shared utilities
└── prisma/               # Database schema and migrations
```

## Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, Zustand, React Query, Socket.IO
- **Backend**: Node.js, Express, PostgreSQL, Redis, Prisma ORM, Bull queues
- **Infrastructure**: Multi-tenant (tenant-scoped shared schemas), AWS S3, Socket.IO, Firebase FCM

## Portable Docker setup

Start with [the portable deployment guide](docs/PORTABLE_DEPLOYMENT.md) for generated `.env` secrets, Docker, first restaurant setup, HTTPS hosting and optional integrations. See [actual progress](.kiro/specs/dinely/progress.md) for unfinished requirements.

## Getting Started

### Prerequisites

- Node.js >= 22.0.0
- npm >= 9.0.0
- PostgreSQL >= 14
- Redis >= 7

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env

# Run database migrations
npm run db:migrate

# Start development servers
npm run dev
```

### Development

```bash
# Run all apps in development mode
npm run dev

# Build all apps
npm run build

# Lint all apps
npm run lint

# Format code
npm run format

# Run tests
npm run test
```

## Features

- Multi-tenant SaaS architecture
- Point of Sale (POS) system
- Kitchen Display System (KDS)
- Mobile Captain/Waiter app
- QR code ordering
- Online ordering website
- Aggregator integration (Zomato, Swiggy, etc.)
- Inventory management
- CRM & loyalty program
- Analytics & reporting
- WhatsApp marketing
- Offline-first capabilities
- Real-time synchronization

## License

Private - All rights reserved

## Current implementation status

See [.kiro/specs/dinely/progress.md](.kiro/specs/dinely/progress.md) for audited progress and remaining work. The complete product is not implemented yet.

```bash
npm ci
npm run db:generate
npm run build:core
npm run test:core
npm run dev --workspace=@dinely/api
npm run dev --workspace=@dinely/web
npm run dev --workspace=@dinely/kitchen
```

Run each development command in a separate terminal. The kitchen UI uses port 3001 and proxies API/Socket.IO to port 5000. Enable sound after signing in. For hosted frontends, set `VITE_API_URL` to the API origin and configure CORS/TLS for the hosting target.

Inventory endpoints under `/api/inventory`: `GET/POST /items`, `PATCH /items/:id/adjust`, `GET /transactions`, and `GET/POST /vendors`. Adjustments require an authenticated manager/admin and current item `version`. Purchases use `type: "PURCHASE"`, positive `quantityChange` and `costPerUnit`. Stock and audit writes commit together. `inventory:low-stock` is a room event; push delivery remains pending.
