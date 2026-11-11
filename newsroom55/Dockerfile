# syntax=docker/dockerfile:1

ARG BUILD_ARCH
ARG BUILD_VERSION=dev

FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
RUN npm ci

FROM node:22-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runner
ARG BUILD_ARCH
ARG BUILD_VERSION
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV TZ=America/Montreal
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV DATA_DIR=/app/data
LABEL io.hass.type="app" \
  io.hass.name="NEWSROOM55" \
  io.hass.arch="${BUILD_ARCH}" \
  io.hass.version="${BUILD_VERSION}" \
  org.opencontainers.image.title="NEWSROOM55" \
  org.opencontainers.image.description="Centre de nouvelles pour Cisco Board et Home Assistant"
RUN apt-get update && apt-get install -y --no-install-recommends wget ca-certificates gosu \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system newsroom \
  && useradd --system --gid newsroom --home /app newsroom
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY home-assistant-entrypoint.mjs ./
RUN mkdir -p /app/data && chown -R newsroom:newsroom /app
USER root
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "home-assistant-entrypoint.mjs"]
