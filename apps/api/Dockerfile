# InfraSure ERP — API image.
# IMPORTANT: build with the repo root as context (it needs the packages/db workspace):
#   docker build -f apps/api/Dockerfile -t infrasure-api .
FROM node:22-slim

# OpenSSL is required by Prisma's query engine.
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install workspace dependencies (lockfile-exact). Copy only manifests first so
# this layer is cached unless a package.json / lockfile changes.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/db/package.json packages/db/package.json
RUN npm ci

# Application source (API + shared db package).
COPY packages/db ./packages/db
COPY apps/api ./apps/api

# Generate the Prisma client at build time.
RUN npx prisma generate --schema packages/db/prisma/schema.prisma

ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

# Entry point applies the schema (prisma db push) then starts the API.
ENTRYPOINT ["sh", "apps/api/docker-entrypoint.sh"]
