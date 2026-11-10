# UNTESTED: written on 10 Nov but never built. Docker could not run on the machine it was written on (the disk was full),
# so nothing here has been verified beyond `docker compose config` accepting the compose file. Build it once and fix what breaks.
# The Unmask backend with the Rust auction engine built inside. Build from the repository root:
#   docker build -f backend/Dockerfile -t unmask-backend .
# Development image: settlement uses the development enclave (not confidential, not attested). See docs/settlement-dev.md.

FROM rust:1-bookworm AS engine
WORKDIR /src
COPY enclave/auction-engine enclave/auction-engine
RUN cargo build --release --manifest-path enclave/auction-engine/Cargo.toml

FROM node:24-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY backend/prisma ./prisma
COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npx prisma generate --schema=prisma/schema.prisma && npx tsc

FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY backend/package.json ./
COPY --from=engine /src/enclave/auction-engine/target/release/auction-engine /app/engine/auction-engine
ENV AUCTION_ENGINE_BIN=/app/engine/auction-engine HOST=0.0.0.0 PORT=4001
EXPOSE 4001
# Apply migrations, then start. NODE_ENV is deliberately not forced to "production": settlement refuses to run there.
CMD ["sh", "-c", "npx prisma migrate deploy --schema=prisma/schema.prisma && node dist/server.js"]
