FROM node:22-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY . .
RUN npm ci && npm run db:generate && npm run build
ENV NODE_ENV=production
EXPOSE 5000
USER node
CMD ["node", "apps/api/dist/index.js"]
