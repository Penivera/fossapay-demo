# SquadPay: Live Group Bill Splitter

**SquadPay** is a live group dining and shared expense bill splitter with real-time settlement into the host's Nigerian bank account. Friends pay their individual shares via dynamic 30-minute virtual checkout accounts while the room board illuminates green in real time over Server-Sent Events (SSE).


> Part of [FossaPay demos](../../README.md). See the [integration guide](../../docs/integration/04-recipes.md) for how this demo maps onto FossaPay. In live mode sample data and simulator controls are removed (`FOSSAPAY_MODE=live`).

---

## 🚀 Key Features

1. **Room Creation (`/`)**
   - Host specifies Bill Title, total amount (or itemized participant breakdown), and payout bank details.
   - Bank enquiry resolves the host's legal account name.
   - Supports both **Equal Split** and **Custom Itemized Split**.
2. **Remainder-Safe Kobo Math (`distributeAmount`)**
   - Never uses floating-point division. Remainder kobo (e.g. ₦10,000 ÷ 3 = ₦3,333.333...) are distributed deterministically penny-by-penny to the first $r$ participants.
   - Guarantees `sum(shares) === total` down to the exact kobo.
3. **Live Synchronized Room Board (`/r/[id]`)**
   - Real-time SSE synchronization (`/api/rooms/[id]/stream`).
   - Each participant card shows individual share, status (`PENDING`, `PAID`, `EXPIRED`, `UNSETTLED`), and payment timestamps.
   - Participant cards illuminate vivid green upon payment confirmation.
4. **Checkout Expiry & Account Regeneration**
   - 30-minute countdown timers per participant checkout.
   - Expired checkouts can be renewed on demand using "Regenerate Account", producing a fresh account ref `squad_<roomId>_<participantId>_v<counter>`.
5. **Partial Close & Single-Payout Idempotency**
   - Host can partially close the room at any time to withdraw already-collected funds.
   - Unpaid participants are marked `UNSETTLED`.
   - Host payout is strictly protected by idempotency key:
     `squad_payout_<roomId>`.
   - Retrying the payout trigger never results in a duplicate payout.

---

## 🏃 Quick Start

```bash
# From repository root
npm run dev:squadpay

# Or within this directory
cd demos/squadpay
npm run dev
```

Open [http://localhost:3002](http://localhost:3002) in your browser.

---

## ⚙️ Environment Variables

Create `.env` using `.env.example`:

```bash
# FossaPay Mode: 'mock' (default, 100% offline) or 'live'
FOSSAPAY_MODE=mock
FOSSAPAY_API_KEY=fossa_mock_key
FOSSAPAY_WEBHOOK_SECRET=fossa_whsec_mock_shared_secret
NEXT_PUBLIC_APP_URL=http://localhost:3002
```

---

## 🧪 How the Mock Works

- **Per-Participant Checkouts:** Generates individual Wema Bank checkout accounts with references `squad_<roomId>_<participantId>`.
- **Live SSE Dispatch:** Simulating payment on any participant card triggers an internal HMAC-signed webhook (`checkout.completed`) that auto-updates the live board.
- **Idempotent Settlement:** Pool payouts trigger a single FossaPay Master Payout with key `squad_payout_<roomId>`.

---

## 🌐 Flipping to Live Mode (Untested)

To point to production FossaPay APIs:
1. Update `.env`:
   ```bash
   FOSSAPAY_MODE=live
   FOSSAPAY_API_KEY=fk_production_your_live_key
   FOSSAPAY_WEBHOOK_SECRET=your_live_webhook_secret
   ```
2. Real checkouts and payouts will route to `https://api-production.fossapay.com/api/v1`.
> [!WARNING]
> Live mode has been implemented according to the FossaPay API specification but is marked as **untested** in this repository.

---

## 🧪 Testing

```bash
# Run Vitest E2E test suite (3 paying, live updates, single idempotent payout, expiry regen, partial withdraw)
npm run test:e2e
```
