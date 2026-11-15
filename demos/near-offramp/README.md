# Flagship Demo: NEAR Intents Cross-Chain Off-Ramp to Naira

The **NEAR Intents Off-Ramp** is a high-throughput, non-custodial DeFi-to-Naira liquidation portal. It enables users to liquidate crypto assets across multiple blockchains (Solana, Base, Arbitrum, Ethereum, Bitcoin, NEAR) directly into Nigerian bank accounts via automated NEAR Intent solvers and FossaPay Master NGN Payouts.

---

## 🚀 Key Features

1. **Screen 1: Intent Terminal (`OffRampCard.tsx`)**
   - Source token selector across chains (USDT, USDC, NEAR, ETH, SOL).
   - Real-time solver exchange rate quote (`1 USDT = 1 USDC (Solana) -> ₦1,595.00 NGN`).
   - Destination bank selector with automated NUBAN account name enquiry.
   - Transparent fee telemetry block showing solver spread, gas subsidy, and NIBSS clearing fees.
2. **Screen 2: Execution Telemetry Terminal (`TelemetryTerminal.tsx`)**
   - 4-step live pipeline streamed over Server-Sent Events (`/api/intents/[id]/stream`):
     1. Quote Locked & Depositing
     2. Solver Cross-Chain Swapping
     3. FossaPay Solana Master Wallet Credited
     4. Instant NGN Master Payout via NIBSS
   - Visible payout retry handler reusing the strict idempotency key:
     `offramp_payout_<intentId>_1`.
3. **Screen 3: Settlement Receipt Modal (`ReceiptModal.tsx`)**
   - Settlement confirmation with NIBSS clearing session ID, transfer reference, and bank details.
   - Client-side download and print receipt capability.
4. **Offline Demo Wallet Adapter (`WalletModal.tsx`)**
   - Complete 4-tab wallet selector (`[ SOCIAL / PASSKEYS ]`, `[ NEAR NATIVE ]`, `[ EVM / MULTI ]`, `[ SOL ]`).
   - Built-in **Demo Wallet** (`alice.near`, 420.50 USDT balance) allowing 100% offline demonstration without browser extensions.

---

## 🏃 Quick Start

```bash
# From repository root
npm run dev:offramp

# Or within this directory
cd demos/near-offramp
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## ⚙️ Environment Variables

Create `.env` using `.env.example`:

```bash
# FossaPay Mode: 'mock' (default, 100% offline) or 'live'
FOSSAPAY_MODE=mock
FOSSAPAY_API_KEY=fossa_mock_key
FOSSAPAY_WEBHOOK_SECRET=fossa_whsec_mock_shared_secret
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 🧪 How the Mock Works

- **Default Execution:** Runs 100% offline without external network dependencies.
- **Deterministic Bank Enquiry:** `0123456789` resolves to `OLUWASEUN CHUKWUDI ADENIYI`, `9988776655` to `TUNDE BALOGUN`.
- **Solver Simulation:** `MockSolverAdapter` produces realistic cryptographic transaction hashes and simulates delivery to the FossaPay Solana master wallet.
- **FossaPay Master Payout:** Automatically triggers NGN bank payout via the in-memory mock ledger and dispatches signed `payout.completed` webhooks.

---

## 🌐 Flipping to Live Mode (Untested)

To point to production FossaPay APIs:
1. Update `.env`:
   ```bash
   FOSSAPAY_MODE=live
   FOSSAPAY_API_KEY=fk_production_your_live_key
   FOSSAPAY_WEBHOOK_SECRET=your_live_webhook_secret
   ```
2. Real payouts will execute against `https://api-production.fossapay.com/api/v1` with your master fiat wallet balance.
> [!WARNING]
> Live mode has been implemented according to the FossaPay API specification but is marked as **untested** in this repository.

---

## 🧪 Testing

```bash
# Run Vitest E2E integration test
npm run test:e2e
```
