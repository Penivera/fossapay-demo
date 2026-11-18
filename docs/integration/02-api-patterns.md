# 2. API patterns

Everything below is implemented in [`packages/fossapay-client/src/client.ts`](../../packages/fossapay-client/src/client.ts)
and checked against the [OpenAPI spec](https://docs.fossapay.com/api-reference/openapi.json) by
[`live-contract.test.ts`](../../packages/fossapay-client/test/live-contract.test.ts).

## Using the client

```ts
import { FossaPayClient } from '@fossapay/client';

const fossa = new FossaPayClient();   // reads FOSSAPAY_MODE / FOSSAPAY_API_KEY from the environment
```

Auth is a single header, `x-api-key`. Base URL is `https://api-production.fossapay.com/api/v1`.

## The response envelope (and its exceptions)

Most endpoints return `{ status, statusCode, message, data }`. Three things trip people up, and the client handles them:

- `status` is the string `"success"` on some endpoints and a **boolean** on others (banks, enquiry, fees).
- A few reads use `success: true` instead.
- `POST /kyc/verifications` returns its payload **with no envelope at all**.

The client unwraps real envelopes only, and treats `status: "error"`, `status: false`, `success: false` or any non-2xx as a
`FossaPayError` carrying `statusCode` and `responseBody`.

## Idempotency: the rule that protects your money

Every mutating call takes an `X-Idempotency-Key` (max 255 chars). Same key and same body returns the original result; same
key with a different body is a `409`. So:

1. **Derive keys from your own business identity**, not randomness: `safedeal_release_payout_<dealId>_1`,
   `squad_payout_<roomId>`, `ajo_payout_<clubId>_round<n>`. A retry after a crash then reuses the same key and can never pay twice.
2. **Persist the key with the record** before you call.
3. **Never mint a new key because a request timed out.** First look the payout up by reference. If it exists, track it; if
   not, retry the identical body with the original key.

```ts
const payout = await fossa.payouts.createMasterPayout(
  { accountNumber, bankCode, accountName, amount: 5000, reference: 'PAYOUT-10025', narration: 'Settlement' },
  'payout-order-10025'                     // idempotency key
);
```

References (`^[A-Za-z0-9._:-]{1,100}$`) are also unique per merchant; reusing one is a `409`.

## Money: whole naira in, decimal strings out

- **Requests take whole-naira integers** for checkouts and payouts. The client throws on `1234.50` instead of rounding,
  because silently moving the wrong amount is worse than failing.
- **Responses are decimal strings** (`"5080.00"`). Parse with a decimal library. This repo uses `bignumber.js` and kobo-integer
  helpers (`toKobo`, `fromKobo`, `distributeAmount`). Never use floats for money.

## Resolve the account before you pay it

```ts
const banks = await fossa.transfers.getSupportedBanks();                 // [{ name, code }]
const who   = await fossa.transfers.bankEnquiry('0123456789', '058');    // { accountName, ... }
// Show who.accountName to the user and have them confirm, then pass it to the payout.
```

Account numbers must be exactly 10 digits. The live bank list is ~800 entries and repeats some codes; the client dedupes.

## Checkouts: collect a one-off payment

```ts
const checkout = await fossa.checkouts.createCheckout(
  { amount: 25000, reference: 'ORDER-10025', feeBearer: 'customer', metadata: { orderId: '10025' } },
  'checkout-order-10025-v1'
);
// Show checkout.bankName / accountName / accountNumber and **amountPayable** (not amount) to the buyer.
```

- The buyer makes **one exact transfer** of `amountPayable` before `expiresAt` (30 minutes).
- `feeBearer: 'customer'` means `amountPayable = amount + fee`; `'merchant'` means the fee comes out of your settlement.
- Never compute the fee yourself; use the returned values.
- Fulfil only on the signed `checkout.completed` webhook. Statuses: `pending`, `processing`, `completed`, `failed`, `expired`, `reversed`.
- Reconcile with `getCheckout(id)` or `getCheckoutByReference(ref)`; expire early with `expireCheckout(id)` (only while `pending`).

## Payouts: send NGN to a bank account

```ts
await fossa.payouts.createMasterPayout(req, key);
```

HTTP `202` means *accepted*, not *delivered*. Treat `status: 'processing'` as **non-terminal** and wait for
`payout.completed` / `payout.failed` / `payout.reversed`. On `failed`, do **not** auto-create a replacement; retrieve the payout and
decide. The live API needs a bank name, which the client looks up from the bank list by code when you omit it.

## Customers and wallets

```ts
const customer = await fossa.customers.create({
  firstName, lastName, email, phoneNumber, dateOfBirth: '1990-08-15', address, city, country: 'Nigeria',
}, 'customer-ada');
const wallet = await fossa.wallets.createFiatWallet({ customerId: customer.id }, 'wallet-ada');
// wallet.accountNumber is a permanent dedicated virtual account for this customer.
```

All of `firstName, lastName, email, phoneNumber, dateOfBirth, address, city, country` are required by the live API. Collect
them from the user; do not fabricate identity data. `transferFiat` moves money between two of your customers' wallets for free
(the live API addresses wallets by account number; the client resolves them for you).

## Identity verification (billed)

```ts
const r = await fossa.kyc.verifyIdentity('BVN', '01234567890', 'ajo_kyc_club1_7890_1');
// r.verified, r.fullName, r.last4Digits, r.identityNumberHash; the plaintext number is never returned
```

NIN costs NGN 120 and BVN NGN 70 per attempt, charged even when `person` comes back `null`. Keep the number out of logs, URLs and
analytics. Store only a hash and the last four digits, as AjoSphere does.
