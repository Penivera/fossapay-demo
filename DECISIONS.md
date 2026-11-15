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



