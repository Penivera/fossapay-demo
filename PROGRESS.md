# FossaPay Showcase Build Progress

## Phase 0: Scaffold
- [x] Initialize workspaces (`package.json`), `tsconfig.base.json`, ESLint (`eslint.config.mjs`), and Prettier (`.prettierrc`)
- [x] Verify specs placed in `docs/` (`ARCHITECTURE.md`, `DEMO_PROJECTS_SPEC.md`, `01A-FRONTEND-WIREFRAMES.md`, `01-NEAR-INTENTS-OFFRAMP.md`, `02-SAFEDEAL-ESCROW.md`, `03-SQUADPAY-SPLITBILL.md`, `04-AJOSPHERE-SAVINGS.md`)
- [x] Create `DECISIONS.md` and `PROGRESS.md`
- [x] Gate: Install succeeds and workspace typecheck passes

## Phase 1: packages/fossapay-client
- [ ] Implement `FossaPayClient` class (customers, wallets, checkouts, payouts, transfers, kyc)
- [ ] Add `WebhookVerifier` (HMAC-SHA256 over `JSON.stringify(body.data)` with `crypto.timingSafeEqual`)
- [ ] Define exhaustive TypeScript types for requests, responses, and webhook payloads
- [ ] Implement mock transport: in-memory ledger, idempotency cache, webhook dispatcher with signing, configurable delay, deterministic test bank list, deterministic bank-enquiry names
- [ ] Unit tests (vitest) covering: envelope unwrapping, idempotent replay, signature accept/reject, money math
- [ ] Gate: All tests pass and package builds

## Phase 2: demos/near-offramp (Flagship)
- [ ] Screen 1: Terminal with origin asset input, solver rate, NGN output, bank selector, NUBAN auto-resolve badge, telemetry/fees block, CTA
- [ ] Screen 2: 4-step execution telemetry driven by SSE with progress bar
- [ ] Screen 3: Settlement receipt with PDF download (client-side/lightweight route)
- [ ] Wallet Modal with NEAR Connect, Passkeys/FastAuth, EVM, Solana layout + offline Demo Wallet adapter
- [ ] SolverAdapter interface with `MockSolverAdapter` and `NearIntentsSolverAdapter` stub
- [ ] Backend orchestration: bank enquiry -> quote -> execute -> payout (`offramp_payout_<intentId>_1`) -> webhook -> receipt
- [ ] Gate: Typecheck and build pass, automated E2E script runs full off-ramp to receipt

## Phase 3: demos/safedeal (P2P Social Commerce Escrow)
- [ ] Deal creation, shareable link `/d/[id]` (buyer view and seller secret token view), escrow timeline
- [ ] State machine: `DRAFT` -> `WAITING_PAYMENT` -> `ESCROW_LOCKED` -> `DISPATCHED` -> `INSPECTION_PERIOD` -> `RELEASED` | `DISPUTED` -> `REFUNDED`
- [ ] Demo-only courier drop-off simulation and configurable inspection timer with auto-release
- [ ] Dispute flow with reason + local photo upload, and admin mediation page at `/admin`
- [ ] Release performs wallet transfer then payout (idempotent); refund performs payout to buyer bank
- [ ] Gate: Build passes, E2E covers happy path and dispute-to-refund path

## Phase 4: demos/squadpay (Live Group Bill Splitter)
- [ ] Room creation with equal and itemized splits, host bank enquiry, participant cards
- [ ] SSE stream at `/api/rooms/[id]/stream` and per-participant checkouts (`squad_<roomId>_<participantId>`)
- [ ] Remainder kobo deterministic distribution for itemized splits
- [ ] Checkout expiry + "Regenerate Account", partial close & withdraw with unsettled marking, payout idempotency key `squad_payout_<roomId>`
- [ ] Gate: Build passes, E2E covers 3 participants paying, live SSE updates, single idempotent payout

## Phase 5: demos/ajosphere (Digital Rotating Savings Club)
- [ ] Club creation, invite link join, KYC step (BVN/NIN) matching identity name against payout account name
- [ ] Permanent dedicated virtual account display, rotation calendar, contribution tracker, audit ledger, reminder log
- [ ] Scheduler simulation (Mon-Thu contribution window, Fri 09:00 disbursal) with demo time-advancement control panel
- [ ] Payout key `ajo_payout_<clubId>_round<n>`, defaulter handling (hold/partial/wait)
- [ ] Security: Never log full BVN/NIN; store only hash + last 4 digits
- [ ] Gate: Build passes, E2E covers 5-member 5-round simulation including late contributor

## Phase 6: Integration, Polish & Documentation
- [ ] Root scripts: `dev:<demo>`, `build`, `test`, `test:e2e`
- [ ] Root `README.md` and per-demo `README.md` (run instructions, env vars, mock behavior, live flip instructions)
- [ ] Mobile responsive layout review, loading/error states, empty states
- [ ] Final Gate: Clean clone install, build, test, and test:e2e all pass
