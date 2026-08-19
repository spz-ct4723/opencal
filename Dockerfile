# OpenCal — self-host image
# SQLite by default (mount /data to persist); set DATABASE_URL for Postgres.
FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json* ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci || npm install
COPY . .
ENV DATABASE_URL="file:/data/opencal.db"
RUN npx prisma generate && npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV DATABASE_URL="file:/data/opencal.db"
COPY --from=builder /app ./
VOLUME /data
EXPOSE 3000
# Apply schema (works for SQLite and Postgres), then serve
CMD ["sh", "-c", "npx prisma db push && npm run start"]
