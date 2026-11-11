# TESTED 10 Nov 2026: `docker compose build` and `docker compose up -d` worked, the backend ran its migrations and the Rust engine inside the image,
# a seeded launch settled (price $0.03, 1,000,000 sold, $30,000 raised, 2 bids left out) and `npm run demo:preflight` passed 12 of 12.
# Not tested: a real hosting provider, HTTPS, or anything but the development enclave.
# The Unmask web app (Next.js). NEXT_PUBLIC_API_URL is baked in at build time and is the address the BROWSER uses
# to reach the backend, so it must be reachable from the visitor's machine, not just from other containers.
#   docker build --build-arg NEXT_PUBLIC_API_URL=http://localhost:4001 -t unmask-web .
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ARG NEXT_PUBLIC_API_URL=http://localhost:4001
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build

FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/next.config.ts ./
EXPOSE 3000
CMD ["npx", "next", "start", "-p", "3000"]
