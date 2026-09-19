# Dinely Restaurant Operating System

A comprehensive multi-tenant SaaS platform for restaurant businesses built with TypeScript, React 18, Node.js/Express, PostgreSQL, and Redis.

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
- **Infrastructure**: Multi-tenant (schema-per-tenant), AWS S3, Socket.IO, Firebase FCM

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
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
