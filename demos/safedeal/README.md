# SafeDeal: P2P Social Commerce Escrow

**SafeDeal** is a trustless peer-to-peer escrow platform tailored for Instagram, Twitter (X), and WhatsApp social commerce merchants in Nigeria. It eliminates the rampant "payment before delivery" scams by locking buyer funds in escrow until goods are delivered and inspected.


> Part of [FossaPay demos](../../README.md). See the [integration guide](../../docs/integration/04-recipes.md) for how this demo maps onto FossaPay. In live mode sample data and simulator controls are removed (`FOSSAPAY_MODE=live`).

---

## 🚀 Key Features

1. **Seller Deal Creation (`/`)**
   - Seller specifies item details, price (NGN), courier/delivery terms, and their payout bank account.
   - Bank enquiry resolves the seller's verified account holder name.
   - Generates two URLs:
     - Public Buyer Link: `/d/[id]`
     - Private Seller Secret Token Link: `/d/[id]?sellerToken=...`
2. **Interactive Deal Page (`/d/[id]`)**
   - 5-step visual escrow timeline driven by Server-Sent Events (`/api/deals/[id]/stream`):
     `DRAFT` → `WAITING_PAYMENT` → `ESCROW_LOCKED` → `DISPATCHED` → `INSPECTION_PERIOD` → `RELEASED` | `DISPUTED` → `REFUNDED`.
   - Buyer pays via a dedicated 30-minute FossaPay dynamic checkout virtual account.
   - Demo simulation actions: "Simulate Buyer Payment" and "Simulate Courier Drop-off".
3. **Automated Inspection Timer & Auto-Release**
   - Configurable inspection timer (seconds in demo mode vs 24 hours in production).
   - Server-side scheduled worker automatically releases funds to the seller once the timer expires unless a dispute was filed.
4. **Dispute Flow & Evidence Upload**
   - Buyer can dispute during the inspection period, providing a written reason and uploading photo evidence.
   - Multipart file uploads are saved to disk under `public/uploads/`.
5. **Admin Mediation Desk (`/admin`)**
   - Central portal for dispute mediators to inspect evidence photos, review buyer claims, and execute either "Resolve & Release to Seller" or "Refund to Buyer".
6. **Settlement Architecture**
   - **Release:** Internal zero-fee wallet-to-wallet transfer (`POST /api/v1/wallets/fiat/transfer`) followed by payout to the seller's bank (`safedeal_release_payout_<dealId>_1`).
   - **Refund:** Payout directly to the buyer's bank account (`safedeal_refund_payout_<dealId>_1`).

---

## 🏃 Quick Start

```bash
# From repository root
npm run dev:safedeal

# Or within this directory
cd demos/safedeal
npm run dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser.  
Access the mediation desk at [http://localhost:3001/admin](http://localhost:3001/admin).

---

## ⚙️ Environment Variables

Create `.env` using `.env.example`:

```bash
# FossaPay Mode: 'mock' (default, 100% offline) or 'live'
FOSSAPAY_MODE=mock
FOSSAPAY_API_KEY=fossa_mock_key
FOSSAPAY_WEBHOOK_SECRET=fossa_whsec_mock_shared_secret
NEXT_PUBLIC_APP_URL=http://localhost:3001
```

---

## 🧪 How the Mock Works

- **Dynamic Checkouts:** Generates mock Wema Bank NUBAN accounts (`88...`) that expire in 30 minutes.
- **Webhook Dispatching:** Simulating buyer payment dispatches a signed `checkout.completed` event to `/api/webhook`.
- **Scheduled Auto-Release:** Automatically transitions state from `INSPECTION_PERIOD` to `RELEASED` using scheduled timeouts on the server.
- **Idempotency:** Settlement payouts are guarded by `safedeal_release_payout_<dealId>_<attempt>` and `safedeal_refund_payout_<dealId>_<attempt>`.

---

## 🌐 Flipping to Live Mode (Untested)

To point to production FossaPay APIs:
1. Update `.env`:
   ```bash
   FOSSAPAY_MODE=live
   FOSSAPAY_API_KEY=fk_production_your_live_key
   FOSSAPAY_WEBHOOK_SECRET=your_live_webhook_secret
   ```
2. Real checkouts, wallet moves, and bank payouts will route to `https://api-production.fossapay.com/api/v1`.
> [!WARNING]
> Live mode has been implemented according to the FossaPay API specification but is marked as **untested** in this repository.

---

## 🧪 Testing

```bash
# Run Vitest E2E test suite (happy path + dispute-to-refund)
npm run test:e2e
```
