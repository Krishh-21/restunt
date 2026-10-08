FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY . .
RUN npm ci && npm run db:generate && npm run build
# PostgreSQL client 16 is included for real encrypted database backups.
FROM postgres:16-bookworm AS runtime
COPY --from=build /usr/local/bin/node /usr/local/bin/node
RUN useradd --create-home --uid 1000 node
WORKDIR /app
COPY --from=build --chown=node:node /app /app
RUN mkdir -p /app/.data/backups && chown -R node:node /app/.data
ENV NODE_ENV=production SERVE_FRONTENDS=true
EXPOSE 5000
ENTRYPOINT []
USER node
CMD ["node", "apps/api/dist/index.js"]
