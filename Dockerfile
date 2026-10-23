# OpenCal — self-host image
# SQLite by default (mount /data to persist); set DATABASE_URL for Postgres.
# Node 22.23.4 includes the 2026-10-21 fix for CVE-2026-111497 (Brotli / Node2Shell).
# Digest is the multi-arch index for node:22.23.4-alpine from registry-1.docker.io.
FROM node:22.23.4-alpine@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914 AS builder
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci
COPY . .
ENV DATABASE_URL="file:/data/opencal.db"
RUN npx prisma generate && npm run build

FROM node:22.23.4-alpine@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914
WORKDIR /app
ENV NODE_ENV=production
ENV DATABASE_URL="file:/data/opencal.db"
COPY --from=builder /app ./
VOLUME /data
EXPOSE 3000
# Apply schema (works for SQLite and Postgres), then serve
CMD ["sh", "-c", "npx prisma db push && npm run start"]
