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
