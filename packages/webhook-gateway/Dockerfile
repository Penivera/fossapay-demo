# syntax=docker/dockerfile:1

# Build from the repository root; the gateway depends on @fossapay/client, which must be compiled first.
#   docker build -f packages/webhook-gateway/Dockerfile -t fossapay-webhook-gateway .

FROM node:22-alpine AS build
WORKDIR /app
ENV NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/fossapay-client/package.json packages/fossapay-client/
COPY packages/webhook-gateway/package.json packages/webhook-gateway/
COPY packages/ui/package.json packages/ui/
COPY demos/ajosphere/package.json demos/ajosphere/
COPY demos/near-offramp/package.json demos/near-offramp/
COPY demos/safedeal/package.json demos/safedeal/
COPY demos/squadpay/package.json demos/squadpay/

RUN npm ci --workspace=packages/fossapay-client

COPY packages/fossapay-client packages/fossapay-client

RUN npm run build --workspace=packages/fossapay-client \
 && npm pack --workspace=packages/fossapay-client --pack-destination /tmp

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8001

# Install only what the gateway needs at runtime; a full workspace install would ship all demo apps.
COPY --from=build /tmp/fossapay-client-*.tgz /tmp/
RUN npm init --yes >/dev/null \
 && npm install --omit=dev --no-audit --no-fund /tmp/fossapay-client-*.tgz tsx@4.23.15 \
 && rm -rf /tmp/fossapay-client-*.tgz package-lock.json /root/.npm

COPY packages/webhook-gateway/src packages/webhook-gateway/src
COPY packages/webhook-gateway/package.json packages/webhook-gateway/

USER node
EXPOSE 8001

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8001/platforms/webhook >/dev/null || exit 1

CMD ["./node_modules/.bin/tsx", "packages/webhook-gateway/src/server.ts"]
