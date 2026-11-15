# System Architecture & Engineering Standards

This document establishes the foundational design, technical standards, and security protocols across all demo applications in this repository.

---

## 1. Repository & Monorepo Layout

The repository is structured as a modular TypeScript monorepo where each demo application operates independently while sharing core FossaPay utilities, type definitions, and webhook verifiers:

```text
fossapay-demo/
├── packages/
│   └── fossapay-client/             # Shared typed SDK wrapper & webhook cryptographic helpers
├── demos/
│   ├── near-offramp/                 # [FLAGSHIP] NEAR Intents Cross-Chain Off-Ramp to NGN
│   ├── safedeal/                     # P2P Social Commerce Escrow
│   ├── squadpay/                     # Live Group Bill Splitter with Direct Bank Settlement
│   └── ajosphere/                    # Digital Rotating Savings & Credit Club (Esusu)
├── docs/
│   ├── ARCHITECTURE.md              # Global architecture & security standards (this file)
│   ├── 01-NEAR-INTENTS-OFFRAMP.md   # Flagship specification
│   ├── 02-SAFEDEAL-ESCROW.md        # SafeDeal specification
│   ├── 03-SQUADPAY-SPLITBILL.md     # SquadPay specification
│   └── 04-AJOSPHERE-SAVINGS.md      # AjoSphere specification
├── DEMO_PROJECTS_SPEC.md             # High-level product catalog
├── package.json                      # Workspace root scripts
└── tsconfig.base.json                # Shared TypeScript compiler options
```

---

## 2. FossaPay Integration Standards

All applications interacting with FossaPay must adhere to these five non-negotiable operational requirements:

### 2.1 Production Base URL & Authentication
* **Base URL:** `https://api-production.fossapay.com/api/v1`
* **Authentication Header:** `x-api-key: fk_production_...`
* **Environment Guard:** API keys must remain strictly in backend runtime environments (Node.js/Next.js API routes). **Never expose keys to client bundles (`NEXT_PUBLIC_`) or public source code.**

### 2.2 Standard API Response Envelope
Every request returns the standardized FossaPay envelope:
```json
{
  "status": "success",
  "statusCode": 200,
  "message": "Human readable summary",
  "data": { ... }
}
```
* HTTP status codes match `statusCode`.
* Application clients must unwrap `.data` only when `status === "success"`.
* Error responses provide diagnostic messages in `message`.

### 2.3 Strict Idempotency Handling
All mutating financial endpoints (`/checkouts`, `/payouts`, `/kyc/verifications`, `/batches`) require an `X-Idempotency-Key` header:
* Maximum length: **255 characters**.
* Format convention: `<domain>_<operation>_<unique_entity_id>_<attempt>` (e.g., `offramp_payout_int_8f3a1b_1`).
* Retrying a failed or ambiguous network request with an identical payload and idempotency key safely returns the original resource without double debiting.

### 2.4 Webhook Cryptographic Verification
Webhooks notify our systems of asynchronous financial events (`checkout.completed`, `payout.completed`, `deposit.completed`, etc.).
* **Delivery Header:** `x-fossapay-signature` (hex-encoded HMAC-SHA256).
* **Signing Input:** **`JSON.stringify(body.data)`** (the inner data payload only, **not** the entire webhook envelope).
* **Verification Algorithm:**
  ```typescript
  import crypto from "node:crypto";

  export function verifyFossaPayWebhook(
    body: { data: Record<string, unknown> },
    signature: string,
    secret: string
  ): boolean {
    if (!body?.data || !signature || !secret) return false;

    const expected = crypto
      .createHmac("sha256", secret)
      .update(JSON.stringify(body.data))
      .digest("hex");

    const received = String(signature);
    if (expected.length !== received.length) return false;

    return crypto.timingSafeEqual(
      Buffer.from(expected, "utf8"),
      Buffer.from(received, "utf8")
    );
  }
  ```
* **Processing Rules:**
  1. Acknowledge with an HTTP `200 OK` within 2 seconds.
  2. Record `body.eventId` in an event-deduplication store to prevent processing duplicate deliveries.
  3. Queue asynchronous domain tasks (e.g., releasing escrow, unlocking bill cards) outside the HTTP response handler.

### 2.5 Monetary Precision
* Never perform financial calculations using standard JavaScript floating-point numbers.
* Preserve string decimals (e.g., `"5000.00"`) or convert to the smallest currency unit (Kobo / Cents) using fixed-precision integer math (`bignumber.js` or `dinero.js`).

---

## 3. Shared Library Specification: `packages/fossapay-client`

To guarantee DRY (Don't Repeat Yourself) implementation across all four demos, the shared client package provides:

1. **`FossaPayClient` Class:**
   * `customers`: `create()`, `getById()`, `list()`
   * `wallets`: `createFiatWallet()`, `getFiatWallet()`, `createCryptoWallet()`, `getCryptoBalance()`
   * `checkouts`: `createCheckout(data, idempotencyKey)`, `getCheckout(id)`
   * `payouts`: `createMasterPayout(data, idempotencyKey)`, `getPayout(id)`
   * `transfers`: `bankEnquiry(accountNumber, bankCode)`, `getSupportedBanks()`, `calculateFiatFee(amount)`
   * `kyc`: `verifyIdentity(method, identityNumber, idempotencyKey)`
2. **`WebhookVerifier`:** Standalone timing-safe HMAC validator and event typing.
3. **TypeScript Types:** Exhaustive types for all request bodies, responses, and webhook payloads.
