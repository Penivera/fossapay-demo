# 1. Getting started

## Requirements

Node.js 20+ and npm 10+ (`.nvmrc` pins 22).

## Run the demos

```bash
git clone https://github.com/Penivera/fossapay-demo.git
cd fossapay-demo
npm install
npm run build --workspace=packages/fossapay-client   # the demos import the built client

npm run dev:offramp     # NairaBridge     http://localhost:3000
npm run dev:safedeal    # SafeDeal        http://localhost:3001
npm run dev:squadpay    # SquadPay        http://localhost:3002
npm run dev:ajosphere   # AjoSphere       http://localhost:3003
npm run gateway         # Webhook inspector http://localhost:8001
```

With no configuration everything runs in **sandbox mode**: no network, no credentials, no money.

## Sandbox vs live

| | Sandbox (`FOSSAPAY_MODE` unset or `mock`) | Live (`FOSSAPAY_MODE=live`) |
|---|---|---|
| FossaPay calls | In-process mock ledger | Real production API |
| Sample data | Pre-filled forms, seeded AjoSphere club, sample wallet | None: forms start blank |
| Simulate buttons | Shown | Hidden, and their endpoints return `403` |
| Webhook secret | Public mock default | Required, else deliveries are rejected (`500`) |
| Money | None | **Real** |

> Live mode moves real money. Use a small amount you are comfortable losing while you validate an integration, exactly as
> [FossaPay recommends](https://docs.fossapay.com).

## Environment variables

Copy `.env.example` to `.env.local` inside a demo folder (Next.js loads it automatically).

| Variable | Required | Purpose |
|---|---|---|
| `FOSSAPAY_MODE` | no | `mock` (default) or `live` |
| `FOSSAPAY_API_KEY` | live only | Your `fk_production_...` key. The client throws without it in live mode |
| `FOSSAPAY_WEBHOOK_SECRET` | live only | Secret you configured for your webhook endpoint in the dashboard |
| `FOSSAPAY_BASE_URL` | no | Defaults to `https://api-production.fossapay.com/api/v1` |

Keep the key and secret server-side. Never prefix them with `NEXT_PUBLIC_`, and never commit `.env` files.

The webhook gateway reads the **root** `.env` (also `FOSSAPAY_SECRET` as a fallback name). Set the same `FOSSAPAY_MODE`
for the gateway and the demos.

## What works live today

| Demo | Live status |
|---|---|
| SafeDeal, SquadPay | Calls are mapped to the real API. SafeDeal needs real customer details (see [going live](06-going-live.md)) |
| AjoSphere | Same; each BVN/NIN lookup is billed (NGN 70 / 120) |
| NairaBridge | **Declines live quotes and payouts.** Its NEAR Intents deposit leg is simulated, so paying out real naira against it would be unsafe |

## Repository map

```
packages/fossapay-client   typed client, mock ledger, webhook verification, money math
packages/ui                shared design system
packages/webhook-gateway   local webhook ingestion + inspector
demos/near-offramp         NairaBridge
demos/safedeal             SafeDeal
demos/squadpay             SquadPay
demos/ajosphere            AjoSphere
```
