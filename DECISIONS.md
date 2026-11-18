# Architectural & Implementation Decisions Log

This document records architectural, functional, and engineering decisions made during the construction of the FossaPay product demo monorepo, following the format prescribed in the project specification.

---

## [Phase 0] Package Manager Selection
- **Question:** Should the monorepo use pnpm or npm workspaces?
- **Decision:** Use npm workspaces with `package-lock.json`.
- **Why:** `pnpm` is not globally installed without an interactive Corepack prompt requiring network download, whereas `npm` (v11.19.1) and `node` (v24.22.1) are locally available and functioning non-interactively.
- **Revisit if:** Corepack is pre-authorized in the execution container environment.

## [Phase 0] Flagship Specification Document Status
- **Question:** Is `01-NEAR-INTENTS-OFFRAMP.md` present or missing?
- **Decision:** `01-NEAR-INTENTS-OFFRAMP.md` is present in `docs/` alongside `01A-FRONTEND-WIREFRAMES.md` and `DEMO_PROJECTS_SPEC.md`.
- **Why:** Verified on disk in `docs/01-NEAR-INTENTS-OFFRAMP.md` and used directly for architecture alignment.
- **Revisit if:** The user replaces or removes this file.

## [Phase 0] Shared Fee Bearer Field Convention
- **Question:** The catalog mentions `feeBearer: "customer"`, whereas `02-SAFEDEAL-ESCROW.md` mentions `feeBearer: "buyer"`. What should the client send?
- **Decision:** Support both via a union `'customer' | 'merchant' | 'buyer'`, defaulting standard checkout requests to `'customer'` as per the FossaPay core API standard, while allowing `'buyer'` mapping in SafeDeal.
- **Why:** FossaPay standard API uses `'customer' | 'merchant'`, while domain wrappers can alias `'buyer'` to `'customer'`.
- **Revisit if:** Official FossaPay API docs mandate a strict enum without alias tolerance.

## [Phase 0] SafeDeal Internal Wallet Transfer Modeling
- **Question:** How should SafeDeal's zero-fee wallet-to-wallet transfer (`POST /api/v1/wallets/fiat/transfer`) operate in mock vs live mode?
- **Decision:** In mock mode, model it as an atomic ledger debit/credit between internal customer wallet balances. In live mode, call `POST /api/v1/wallets/fiat/transfer` with unverified live payload notation.
- **Why:** Guarantees offline demo execution while providing the live client integration surface.
- **Revisit if:** Live merchant account API credentials become available.

## [Phase 0] Exchange Rate Provider for NEAR Off-Ramp
- **Question:** What is the source of the crypto-to-NGN exchange rate for the flagship off-ramp?
- **Decision:** Use a mock deterministic rate provider with a configurable baseline constant (default `1 USDT = 1 USDC (Solana) -> 1,595.00 NGN`, with ₦50 payout fee).
- **Why:** Must never present mock rates as real live oracles and must run 100% offline.
- **Revisit if:** External real-time price feeds (e.g., Pyth, CoinGecko) are requested.

## [Phase 1] Client Field Definitions and Unverified Types
- **Question:** Which API field names in `@fossapay/client` cannot be confirmed from existing specs?
- **Decision:** Marked `// UNVERIFIED` on: `BankEnquiryResult.sessionId`, `CreateCustomerRequest.metadata`, `CustomerRecord.metadata`, `CreateFiatWalletRequest.accountType`, `CreateCryptoWalletRequest.customerId`, `TransferFiatRequest.narration`, `CreateCheckoutRequest.metadata`.
- **Why:** Adheres strictly to the requirement to flag unverified fields while maintaining full TypeScript support.
- **Revisit if:** Official API schema specs are provided.

## [Phase 1] In-Memory Mock Ledger & Hot-Reload Singleton
- **Question:** How should mock state persist across multiple API route invocations during development hot-reloads?
- **Decision:** Anchor `defaultMockLedger` onto `globalThis.__fossapayMockLedger` in non-production environments.
- **Why:** Ensures that customer accounts, wallets, checkouts, and payouts created in one route remain visible across all routes and SSE streams without external database dependencies.
- **Revisit if:** Persistent file or SQLite storage is preferred across complete server restarts.

## [Phase 2] Wallet Adapter Matrix and Unwired Connectors
- **Question:** How should unwired wallet connectors (MetaMask, Rabby, Solflare, Bitte, etc.) be presented in the Near Off-Ramp terminal?
- **Decision:** Render the full 4-tab grid from `01A-FRONTEND-WIREFRAMES.md` (`SOCIAL / PASSKEYS`, `NEAR NATIVE`, `EVM / MULTI`, `SOL`). Implement an offline `Demo Wallet` (alice.near, 420.50 USDT) and `FastAuth` passkey adapter that work immediately, while marking unwired external extension wallets "Coming soon" with in-UI notice banners.
- **Why:** Keeps the demo completely functional offline without requiring multiple browser extensions, while remaining 100% faithful to the visual specification.
- **Revisit if:** Specific third-party browser wallet libraries are required to be bundled.

## [Phase 2] Solver Adapter & 1Click Endpoints
- **Question:** How should NEAR Intents cross-chain routing be integrated?
- **Decision:** Put routing behind `SolverAdapter` interface with `MockSolverAdapter` as active default, and `NearIntentsSolverAdapter` with documented `https://1click.chaindefuser.com/v0/quote` endpoints falling back gracefully.
- **Why:** Prevents breaking offline demos when external solver APIs are unreachable or have undocumented parameter updates.
- **Revisit if:** Production 1Click API keys and contracts are provided.

## [Phase 3] SafeDeal Legal State Machine & Inspection Auto-Release
- **Question:** How should illegal lifecycle transitions and the 24-hour auto-release countdown be enforced?
- **Decision:** Enforce transitions strictly on the server through a transition lookup table. When entering `INSPECTION_PERIOD`, compute `inspectionExpiresAt` and register an in-process scheduled timeout callback that auto-releases to the seller upon expiration unless a dispute was raised.
- **Why:** Complies with strict server-side state enforcement and lets demo users verify the 24-hour auto-release behavior in seconds using configurable demo timers.
- **Revisit if:** Multi-node horizontal scaling requires Redis/BullMQ distributed job scheduling.

## [Phase 3] SafeDeal Dispute Photo Storage
- **Question:** Where should dispute evidence photos be saved?
- **Decision:** Store multipart uploads on the local filesystem under `public/uploads/`, returning the public asset URL to render in the admin mediation portal.
- **Why:** Keeps the implementation self-contained, requires no external S3/GCS credentials, and is accessible directly in the browser.
- **Revisit if:** Cloud object storage (GCS/S3) is configured.

## [Phase 4] SquadPay Remainder Kobo Distribution
- **Question:** When an equal split or itemized total has remainder kobo (e.g. ₦10,000 amongst 3 people = 3,333.333... kobo), how are remainder pennies distributed?
- **Decision:** Use `@fossapay/client` `distributeAmount(total, n)` which assigns the remainder kobo deterministically one-by-one to the first `r` participants.
- **Why:** Guarantees `sum(shares) === total` down to the exact kobo, strictly preventing floating-point rounding errors.
- **Revisit if:** The room host chooses to absorb or waive remainder differences.

## [Phase 4] SquadPay Checkout Expiry & Regeneration
- **Question:** How should expired participant checkout accounts be renewed?
- **Decision:** Provide a "Regenerate Account" button in the participant modal and an API endpoint `/api/rooms/[id]/regenerate` which increments a per-participant attempt counter, creating a new checkout ref `squad_<roomId>_<participantId>_v<attempt>` with a fresh 30-minute timer.
- **Why:** Complies with the checkout expiry requirement while maintaining deterministic references and idempotency.
- **Revisit if:** FossaPay adds an in-place TTL extension endpoint to existing checkouts.

## [Phase 4] SquadPay Partial Close & Single Payout Idempotency
- **Question:** How should partial settlements behave when only some members have paid?
- **Decision:** Mark unpaid participants as `UNSETTLED`, transition room state to `PARTIALLY_SETTLED`, and trigger the host payout for the collected amount using idempotency key `squad_payout_<roomId>`.
- **Why:** Satisfies the requirement that retrying payout completion never creates duplicate payouts, and clearly records unpaid member state.
- **Revisit if:** Host needs secondary payout tranches for members paying after partial close.

## [Phase 5] AjoSphere KYC Name Cross-Matching & Privacy Storage
- **Question:** How should BVN/NIN verification and legal name matching be enforced while respecting privacy?
- **Decision:** Hash the 11-digit BVN/NIN with SHA-256, store only `bvnOrNinHash` and `bvnOrNinLast4` (never logging or storing plaintext BVN/NIN), and cross-match uppercase name tokens between the KYC verification record and the NUBAN bank enquiry account holder.
- **Why:** Complies with privacy and data protection standards while preventing pseudonym fraud in savings clubs.
- **Revisit if:** Live biometric facial matching or liveness check APIs become available.

## [Phase 5] AjoSphere Friday Defaulter Mitigation Policy
- **Question:** How should Friday disbursals handle incomplete pots when a member defaults?
- **Decision:** Automatically pause disbursal into `HELD_DEFICIT`, log an urgent reminder to the defaulter, and present the admin with two explicit options: "Wait for Defaulter" (disburses once late deposit lands) or "Disburse Partial Pot" (disburses collected funds with idempotency key `ajo_payout_<clubId>_round<n>`).
- **Why:** Protects recipient expectations, aligns with authentic community Esusu governance, and prevents unauthorized under-disbursals.
- **Revisit if:** Automatic collateral liquidation or penalty interest is introduced.

## [Phase 5] AjoSphere Permanent Dedicated Accounts vs Dynamic Checkouts
- **Question:** Which FossaPay account rail should be used for recurring weekly Ajo contributions?
- **Decision:** Provision permanent dedicated Providus Bank virtual accounts (`POST /api/v1/wallets/fiat/create`) per member rather than dynamic 30-minute checkouts.
- **Why:** Dedicated NUBANs persist indefinitely and can be saved in commercial banking apps for automated scheduled weekly transfers.
- **Revisit if:** Members explicitly request card or USSD checkouts for one-off contributions.

## [Phase 6] Unified Workspace E2E Test Runner & Cross-Workspace Scripts
- **Question:** How should the monorepo coordinate end-to-end testing across heterogeneous demo workspaces?
- **Decision:** Configure `"test:e2e": "npm run test:e2e --workspaces --if-present"` at root alongside workspace-specific dev scripts (`dev:offramp`, `dev:safedeal`, `dev:squadpay`, `dev:ajosphere`).
- **Why:** Delivers a single turnkey command for comprehensive verification while giving developers direct individual dev shortcuts.
- **Revisit if:** Sub-projects are sharded into separate independent CI pipelines.

## [Phase 6+] Cloudflare Tunnel Webhook Gateway & Production API Verification
- **Question:** How should incoming webhooks from FossaPay's single registered webhook URL (`https://fossapay-demo.reachapp.xyz/platforms/webhook`) forwarded via Cloudflare tunnel to `localhost:8001` be ingested and routed to local demo applications?
- **Decision:** Created `@fossapay/webhook-gateway` listening on port `8001`. It verifies the `x-fossapay-signature` using `FOSSAPAY_WEBHOOK_SECRET` from the environment (no secret is ever hardcoded; with none set every delivery is rejected), responds `200 OK` within milliseconds, and forwards verified events to running demo ports (3000, 3001, 3002, 3003) while offering an in-browser Webhook Inspector at `http://localhost:8001`.
- **Why:** Cloudflare tunnel binds a single external port (8001) for all merchant webhook deliveries; the gateway provides unified signature verification, logging, and multi-demo event fanout.
- **Revisit if:** FossaPay supports per-application webhook endpoint registrations.

## [UI Simplification] Reduced Contrast & Minimalist Interface Across Demos
- **Question:** How to simplify the UI, reduce contrast, remove extra components, and keep it soft across all demos?
- **Decision:**
  - Standardized on a consistent soft dark background (`#0d1117`) and low-contrast card surfaces (`#161b22`, `border-slate-800`, `text-slate-300`).
  - Removed decorative marketing grids, heavy neon glow drop-shadows, scanlines, and mesh gradients across all demos (`demos/near-offramp`, `demos/safedeal`, `demos/squadpay`, `demos/ajosphere`, and `packages/webhook-gateway`).
  - Retained all functional capabilities, state machines, SSE real-time streaming, idempotent operations, and verification tests while keeping visual elements focused, legible, and calm.
- **Why:** Directly addresses user request for minimal, soft, and low-contrast interfaces while preserving 100% of the underlying business logic and test coverage.
- **Revisit if:** High-contrast accessibility modes or brand-specific bright themes are explicitly requested.










## Phase 8: Live-Mode Audit Against the Official FossaPay Docs/OpenAPI
- **Finding:** The Phase 1 live transport had been written from the architecture spec, not the published contract. Verified against `https://docs.fossapay.com/api-reference/openapi.json` and `@fossapay/node@0.1.2`, and by read-only calls to the production API (`GET /transfers/banks` -> 404; `GET /transfers/fiat/banks` -> 200 with `{bankname, bankcode}`).
- **Decision:** Kept the in-house `FossaPayClient` facade (the mock-first design depends on it) instead of adding `@fossapay/node`, because that SDK has no checkouts or KYC resource, and mapped every live call to the documented endpoint, field names and response shapes. Contract tests in `packages/fossapay-client/test/live-contract.test.ts` pin them. Replace the live branch with the SDK later if desired; the facade signatures would not change.
- **Decision:** The live API takes **whole-naira integers** for checkout and payout amounts. The client now throws on fractional amounts instead of silently rounding money.
- **Decision:** Webhooks accept both documented schemes: `x-fossapay-signature-v2` (HMAC over the raw body, what `@fossapay/node` `constructEvent` does) and `x-fossapay-signature` (HMAC over `JSON.stringify(data)`). Docs conflict on which header is delivered, so both are verified, timing-safe.
- **Decision:** No hardcoded webhook secret anywhere. In live mode a missing `FOSSAPAY_WEBHOOK_SECRET` fails closed (HTTP 500); the public mock secret is only usable in mock mode. The gateway now returns 401 and does not forward on a bad signature.
- **Security note:** The production webhook secret had been hardcoded in the (uncommitted) `webhook-gateway/src/server.ts`, its test, and this file. It was never committed to git and is now removed from the working tree, but rotate it in the FossaPay dashboard if any of those files were shared or backed up.


## Phase 9: Shared Design System and Live-Mode Hygiene
- **Decision:** New workspace `packages/ui` (`@fossapay/ui`): CSS-variable tokens, a Tailwind preset, and React primitives (Button, Card, Field/Input/Select, Dialog, Steps, Badge, Notice, `BankAccountPicker`, `AppShell`, `Stage`). All four demos and the gateway inspector use it. Direction: Cloudflare-dashboard feel: warm light canvas, white surfaces, hairline borders, one orange accent, fluid `clamp()` type, AA contrast (muted text 5:1, brand-on-white 5:1). The old dark theme and monospace-everywhere styling are removed. Landing pages use a two-column `Stage` that fills the viewport and centres vertically instead of hugging the top.
- **Decision:** Live mode shows **no sample data**. Forms start blank (pre-fill is gated on `useMode().isMock`); the seeded AjoSphere club, the `alice.near` sample wallet, the simulated passkey sign-in and the fabricated transaction hash fallback exist only in the sandbox.
- **Decision:** Simulation endpoints (`simulate-payment`, `simulate-delivery`, `simulate-expiry`, `simulate-deposit`, `advance-time`, `advance-round`) return 403 in live mode via `denyInLive()`, and their UI buttons are hidden. This is enforced server-side, not just in the UI.
- **Decision (safety):** The NEAR Intents solver is a simulation. In live mode `/api/quote` returns 503 and `/api/intents/[id]/execute` returns 501, because executing would pay real naira from the FossaPay master wallet against a crypto deposit that cannot be verified. Wiring a real, verified deposit leg is required before the off-ramp can run live.
- **Decision (safety):** Deleted the unused `/api/payout` route in near-offramp: it let any unauthenticated caller trigger a real payout with the server API key.
- **Decision (safety):** The webhook gateway is exposed through a tunnel as a whole port. Every route except the HMAC-authenticated `POST /platforms/webhook` is now restricted to genuinely local requests (loopback and no proxy headers), `/api/test-trigger` is disabled in live mode, and webhook payloads are HTML-escaped in the inspector (they were previously interpolated raw: stored XSS).
- **Bug fixes found via the UI:** SquadPay's create form posted `participants` while the API requires `participantInputs`, so room creation over HTTP never worked (E2E tests call the store directly and missed it). The live bank directory repeats codes (e.g. `100042`), now deduped in the client. Fixed `NN20,000` double currency symbol in AjoSphere's activity log.
