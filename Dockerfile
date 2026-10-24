# OpenCal — Postgres image. The Vercel build does not use this file.
# SQLite self-hosting stays on main until this branch is merged.
# Node 22.23.4 includes the 2026-10-21 fix for CVE-2026-111497 (Brotli / Node2Shell).
# Digest is the multi-arch index for node:22.23.4-alpine from registry-1.docker.io.
FROM node:22.23.4-alpine@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914 AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
COPY src/lib/database-url.ts ./src/lib/database-url.ts
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build

FROM node:22.23.4-alpine@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app ./
EXPOSE 3000
# Schema changes are applied with `npm run db:migrate:deploy` (DIRECT_URL).
# That step is manual so a container start cannot migrate the wrong database.
CMD ["npm", "run", "start"]
