# AjoSphere: Digital Rotating Savings & Credit Club

**AjoSphere** digitizes traditional West African rotating community savings circles (*Ajo* in Yoruba, *Esusu* in Igbo). It eliminates manual cash handling, ledger tampering, and untraceable defaulters by combining official BVN/NIN identity verification, permanent Providus Bank dedicated virtual accounts, and automated Friday lump-sum disbursals.


> Part of [FossaPay demos](../../README.md). See the [integration guide](../../docs/integration/04-recipes.md) for how this demo maps onto FossaPay. In live mode sample data and simulator controls are removed (`FOSSAPAY_MODE=live`).

---

## 🚀 Key Features

1. **Official KYC Identity Verification (`/club/[id]/join`)**
   - Members onboard by submitting their 11-digit BVN or NIN and designated personal payout bank details.
   - Real-time cross-verification ensures the official verified identity name matches the NUBAN account holder name, preventing pseudonym and proxy fraud.
   - **Privacy Guard:** Plaintext BVN/NIN numbers are **never logged or stored**. Records retain only a cryptographic SHA-256 hash and the last 4 digits.
2. **Permanent Dedicated Virtual Accounts**
   - Unlike 30-minute checkouts, members receive a permanent Providus Bank NUBAN (`99...`).
   - Members can save this account in their commercial banking apps for recurring weekly standing orders.
   - Deposits landing throughout the week trigger `deposit.completed` webhooks that auto-credit the active round.
3. **5-Round Rotation Schedule & Live Dashboard (`/club/[id]`)**
   - Live synchronization over Server-Sent Events (`/api/clubs/[id]/stream`).
   - Rotation calendar tracks who collects each round, target vs collected pot amounts, and NIBSS settlement IDs.
4. **Time Machine Demo Desk (Simulation Controls)**
   - Allows demonstrator to advance time from Monday to Friday in seconds.
   - Quick simulation buttons to trigger member deposits individually or for all members at once.
5. **Defaulter Mitigation & Governance**
   - If a member fails to deposit by Friday 09:00, disbursal is paused in `HELD_DEFICIT` and automated urgent reminders are dispatched.
   - Club Admin can choose between:
     - **Option A: Wait for Defaulter** (disbursal executes as soon as late deposit lands).
     - **Option B: Disburse Partial Pot** (releases whatever amount was collected so far).
6. **Immutable Audit Ledger & Notification Log**
   - Real-time immutable record of all club creations, joins, deposits, deficit alerts, and master payouts.
   - Notification log showing simulated SMS alerts dispatched to members.

---

## 🏃 Quick Start

```bash
# From repository root
npm run dev:ajosphere

# Or within this directory
cd demos/ajosphere
npm run dev
```

Open [http://localhost:3003](http://localhost:3003) in your browser.

---

## ⚙️ Environment Variables

Create `.env` using `.env.example`:

```bash
# FossaPay Mode: 'mock' (default, 100% offline) or 'live'
FOSSAPAY_MODE=mock
FOSSAPAY_API_KEY=fossa_mock_key
FOSSAPAY_WEBHOOK_SECRET=fossa_whsec_mock_shared_secret
NEXT_PUBLIC_APP_URL=http://localhost:3003
```

---

## 🧪 How the Mock Works

- **Identity Verification:** Mock ledger returns verified identity records for test BVNs (`22233344455`, `11223344556`, `99887766554`, `01234567891`).
- **Dedicated Accounts:** Provisions permanent Providus Bank virtual accounts (`99...`).
- **Deposit Simulation:** Fires signed `deposit.completed` webhooks and immediately syncs the live club pot over SSE.
- **Master Payouts:** Friday disbursal executes a single master payout to the round recipient's bank account using idempotency key:
  `ajo_payout_<clubId>_round<roundNumber>`.

---

## 🌐 Flipping to Live Mode (Untested)

To point to production FossaPay APIs:
1. Update `.env`:
   ```bash
   FOSSAPAY_MODE=live
   FOSSAPAY_API_KEY=fk_production_your_live_key
   FOSSAPAY_WEBHOOK_SECRET=your_live_webhook_secret
   ```
2. Real KYC checks, dedicated wallets, and NIBSS payouts will route to `https://api-production.fossapay.com/api/v1`.
> [!WARNING]
> Live mode has been implemented according to the FossaPay API specification but is marked as **untested** in this repository.

---

## 🧪 Testing

```bash
# Run Vitest E2E test suite (5-member, 5-round simulation, late contributor handling, name matching)
npm run test:e2e
```
