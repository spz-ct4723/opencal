# OpenCal — Postgres image. The Vercel build does not use this file.
# SQLite self-hosting stays on main until this branch is merged.
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
COPY prisma ./prisma
COPY prisma.config.ts ./
COPY src/lib/database-url.ts ./src/lib/database-url.ts
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app ./
EXPOSE 3000
# Schema changes are applied with `npm run db:migrate:deploy` (DIRECT_URL).
# That step is manual so a container start cannot migrate the wrong database.
CMD ["npm", "run", "start"]
