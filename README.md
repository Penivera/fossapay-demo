# FossaPay Showcase & Demo Monorepo

Production-grade TypeScript monorepo demonstrating real-world fintech, social commerce, and Web3 applications powered by the [FossaPay](https://docs.fossapay.com/) banking and payments infrastructure.

Rather than mirroring internal administrative dashboards, these applications demonstrate practical consumer and business workflows where FossaPay acts as an invisible banking engine:

1. **NEAR Intents Cross-Chain Off-Ramp (`demos/near-offramp`)** — Flagship terminal liquidating cross-chain crypto (Solana, Base, Arbitrum, Ethereum, NEAR) directly into Nigerian bank accounts via NEAR Intents and FossaPay Master Payouts.
2. **SafeDeal Escrow (`demos/safedeal`)** — Trustless social commerce escrow for WhatsApp and Instagram merchants with 30-minute dynamic virtual accounts, zero-fee wallet transfers, automated inspection timers, and dispute mediation.
3. **SquadPay Split Bill (`demos/squadpay`)** — Real-time group dining expense splitter with per-participant virtual checkout cards, live SSE status synchronization, remainder-safe kobo math, and single-payout pool settlement.
4. **AjoSphere Savings Club (`demos/ajosphere`)** — Digital rotating savings and credit club (*Esusu/Ajo*) with official BVN/NIN identity verification, permanent Providus Bank dedicated virtual accounts, and automated Friday lump-sum disbursals with defaulter mitigation.

---

> **Live mode:** forms start blank, simulate controls are hidden (and their endpoints return 403), and the NairaBridge off-ramp declines quotes/payouts because its NEAR Intents deposit leg is still simulated. Set `FOSSAPAY_MODE=live` plus `FOSSAPAY_API_KEY` and `FOSSAPAY_WEBHOOK_SECRET`.

## 🏗️ Monorepo Architecture

```text
fossapay-demo/
├── packages/
│   ├── fossapay-client/     # Shared typed SDK, WebhookVerifier, MockLedger, Money math
│   ├── ui/                  # @fossapay/ui design system (tokens, Tailwind preset, components)
│   └── webhook-gateway/     # Local webhook ingestion + inspector (port 8001)
├── demos/
│   ├── near-offramp/        # Flagship NEAR Intents Off-Ramp (Port 3000)
│   ├── safedeal/            # Social Commerce Escrow (Port 3001)
│   ├── squadpay/            # Live Group Bill Splitter (Port 3002)
│   └── ajosphere/           # Digital Rotating Savings Club (Port 3003)
├── docs/                    # Architectural specifications and wireframe guides
├── DECISIONS.md             # Running log of inferred engineering decisions
└── PROGRESS.md              # Checklists and phase verification gates
```

---

## ⚡ Quick Start

### Prerequisites
- Node.js `v20+` or `v24+`
- npm `v10+` or `v11+`

### Installation
```bash
# Clone and install dependencies
git clone <repo-url> fossapay-demo
cd fossapay-demo
npm install
```

### Launch Demos
Each demo runs on its own dedicated port:

```bash
# Flagship: NEAR Intents Off-Ramp (http://localhost:3000)
npm run dev:offramp

# SafeDeal Escrow (http://localhost:3001)
npm run dev:safedeal

# SquadPay Bill Splitter (http://localhost:3002)
npm run dev:squadpay

# AjoSphere Rotating Savings (http://localhost:3003)
npm run dev:ajosphere

# Webhook Ingestion Gateway & Live Inspector (http://localhost:8001)
npm run gateway
```

### 🌐 Cloudflare Tunnel & Live Webhooks
FossaPay delivers live webhook notifications to `https://fossapay-demo.reachapp.xyz/platforms/webhook`. The local Cloudflare tunnel maps this public endpoint to port `8001`:
* **Gateway Listener:** `http://localhost:8001/platforms/webhook`
* **HMAC Verification:** Validates `x-fossapay-signature-v2` (raw-body HMAC) or `x-fossapay-signature` (HMAC over `data`) using `FOSSAPAY_WEBHOOK_SECRET`; invalid deliveries get `401` and are not forwarded
* **Multi-Demo Routing:** Asynchronously forwards verified events to active demo apps (`localhost:3000`, `3001`, `3002`, `3003`)
* **Live Inspector Dashboard:** Open [http://localhost:8001](http://localhost:8001) to view real-time inbound deliveries and trigger test events


### Deploying to Vercel
Each demo is its own Next.js app, so create **one Vercel project per demo** and set its *Root Directory* to `demos/<name>`
(`near-offramp`, `safedeal`, `squadpay`, `ajosphere`). Each folder ships a `vercel.json` that installs the workspace from the repo root and builds `@fossapay/client` first. Leave "Include source files outside of the Root Directory" enabled.

> [!NOTE]
> Vercel is fine for **mock-mode showcase demos**, with a caveat: all state (deals, rooms, clubs, intents, the mock ledger) lives in per-instance memory, and timers/SSE are tied to a function instance. A request that lands on a different or cold instance will not find earlier state ("not found"). Treat the deployment as a single-visitor demo. A real deployment needs a shared store (Redis/Postgres) and a queue/cron for timers. The `webhook-gateway` is a long-running local server and is **not** deployable to Vercel; point FossaPay straight at a demo's `/api/webhook` instead.

### Build, Typecheck, & Tests
```bash
# Run full monorepo typecheck
npm run typecheck

# Run full monorepo production build
npm run build

# Run unit tests
npm run test

# Run complete automated E2E test suites across all workspaces
npm run test:e2e
```

---

## 🔒 Security & Standing Engineering Rules

### 1. Mock-First Architecture (100% Offline)
By default, all applications run with `FOSSAPAY_MODE=mock`. The shared mock transport (`packages/fossapay-client`):
- Runs entirely in-process without requiring external database services.
- Deterministically resolves Nigerian bank accounts (`0123456789` -> `OLUWASEUN CHUKWUDI ADENIYI`, `9988776655` -> `TUNDE BALOGUN`).
- Dispatches correctly HMAC-SHA256 signed webhooks (`x-fossapay-signature`) to application endpoints.
- Implements strict idempotency checking using in-memory caches attached to `globalThis` to survive development hot-reloads.

### 2. Live Mode Switch (Untested)
To switch any demo or the shared client to live FossaPay infrastructure:
1. Copy `.env.example` to `.env` in the demo workspace:
   ```bash
   FOSSAPAY_MODE=live
   FOSSAPAY_API_KEY=fk_production_your_actual_key_here
   FOSSAPAY_WEBHOOK_SECRET=your_live_webhook_secret_here
   ```
2. In live mode, requests route to `https://api-production.fossapay.com/api/v1` with header `x-api-key: $FOSSAPAY_API_KEY`.
> [!WARNING]
> FossaPay is **production-only** (no sandbox): live mode moves real money. The live transport is verified against the published OpenAPI spec by contract tests, and read-only endpoints (banks, fee, master wallet) were confirmed against production. Money-moving calls (checkouts, payouts, KYC, transfers) have **not** been exercised against production.
>
> Known gaps before using live mode with the demos (see DECISIONS.md, Phase 8):
> - Checkout/payout amounts must be **whole naira**; SquadPay itemized shares with fractional kobo are rejected.
> - `customers.create` needs real `dateOfBirth`, `address`, `city`, `country`, `email`, `phone`; the demos do not collect them yet.
> - Payouts return `processing` and complete via `payout.completed`; only the Off-Ramp reacts to `payout.failed`/`reversed`. The other demos mark payouts settled on the create response.
> - Each BVN/NIN lookup is billed (NGN 70 / NGN 120).

### 3. Webhook Signature Verification
Every webhook endpoint verifies the `x-fossapay-signature` header:
- Computed as hex HMAC-SHA256 over `JSON.stringify(body.data)` (specifically over the `data` sub-object, never the entire envelope).
- Compares signatures using `crypto.timingSafeEqual` with strict length guards to prevent timing attacks.
- Returns `200 OK` fast, deduplicates processing on `body.eventId`, and executes domain workflows asynchronously.

### 4. Strict Idempotency Keys
Every mutating API call transmits a unique `X-Idempotency-Key` header (max 255 characters):
- NEAR Off-Ramp: `offramp_payout_<intentId>_<attempt>`
- SafeDeal Release: `safedeal_release_payout_<dealId>_<attempt>`
- SafeDeal Refund: `safedeal_refund_payout_<dealId>_<attempt>`
- SquadPay: `squad_payout_<roomId>`
- AjoSphere KYC: `ajo_kyc_<clubId>_<last4>_<timestamp>`
- AjoSphere Disbursal: `ajo_payout_<clubId>_round<n>`

### 5. Monetary Arithmetic (Zero Floating Point)
Currency calculations never use IEEE-754 floating-point numbers:
- Represented as integer kobo (`BigInt` / `toKobo` / `fromKobo`) or `bignumber.js`.
- Split bill remainders are distributed deterministically penny-by-penny across members using `distributeAmount`.

---

## 📑 Top Architectural Decisions to Review

Detailed justifications for all domain decisions are recorded in [DECISIONS.md](file:///home/peni/Projects/fossapay-demo/DECISIONS.md):
1. **[Phase 1] Mock Singleton & Hot-Reload Persistence:** Stores attach to `globalThis` in development so that accounts and checkouts created in one route survive Next.js compilation and SSE stream reconnections.
2. **[Phase 2] Offline Demo Wallet Adapter:** Included an offline `alice.near` demo wallet connector allowing 100% offline demonstration of the 4-step solver telemetry without browser extensions.
3. **[Phase 3] SafeDeal Auto-Release Timer:** Enforces state transitions server-side with configurable inspection timers (seconds in demo vs 24 hours in prod) and scheduled auto-release.
4. **[Phase 4] SquadPay Remainder Kobo:** Allocates odd kobo to the first $r$ participants in order, guaranteeing mathematical balance down to the exact kobo.
5. **[Phase 5] AjoSphere KYC Privacy & Defaulter Mitigation:** Never stores plaintext BVN/NIN (only SHA-256 hash + last 4), cross-verifies legal names with payout bank accounts, and pauses disbursal into `HELD_DEFICIT` upon late deposits.
