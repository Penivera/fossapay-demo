# 4. Recipes: product idea to FossaPay calls

Each demo is a small, complete example of one pattern. Source links are to the code that does it.

## NairaBridge: crypto to a bank account (payout-only)

[`demos/near-offramp`](../../demos/near-offramp) · [`intentStore.ts`](../../demos/near-offramp/src/lib/intentStore.ts)

`bank enquiry → quote → user pays → payout → webhook → receipt`

- Verify the beneficiary name first (`bankEnquiry`), show it, and have the user confirm.
- One payout per intent: key `offramp_payout_<intentId>_1`. The **Retry** button reuses that exact key, so retrying can never double-pay.
- Progress is streamed to the browser over Server-Sent Events; `payout.completed` finalises it, `payout.failed`/`reversed` surfaces an error instead of auto-retrying.
- **Live caveat:** the cross-chain deposit leg (NEAR Intents) is a simulated adapter, so live quotes and payouts are refused. A real version must verify the deposit on-chain *before* paying naira out.

## SafeDeal: escrow for social sellers (checkout + wallets + payout)

[`demos/safedeal`](../../demos/safedeal) · [`dealStore.ts`](../../demos/safedeal/src/lib/dealStore.ts)

`create deal → buyer gets a 30-min checkout → checkout.completed locks escrow → dispatch → inspection → release or dispute`

- A state machine (`DRAFT → WAITING_PAYMENT → ESCROW_LOCKED → DISPATCHED → INSPECTION_PERIOD → RELEASED | DISPUTED → REFUNDED`) rejects illegal transitions server-side.
- Buyer pays a **checkout**; key `safedeal_checkout_<dealId>_1`, reference `ref_<dealId>` lets the webhook find the deal.
- Release = free **wallet-to-wallet transfer**, then an idempotent **payout** to the seller (`safedeal_release_payout_<dealId>_1`).
- Refund = payout to the buyer's account (`safedeal_refund_payout_<dealId>_1`).
- An inspection timer auto-releases unless a dispute is filed.

## SquadPay: split a bill (many checkouts, one payout)

[`demos/squadpay`](../../demos/squadpay) · [`roomStore.ts`](../../demos/squadpay/src/lib/roomStore.ts)

`room → one checkout per friend → live board → single payout to the host`

- One checkout per participant, reference `squad_<roomId>_<participantId>`. A webhook maps back to exactly one participant.
- **Remainder-safe maths:** `₦10,000 ÷ 3` is distributed in integer kobo (`distributeAmount`) so shares always sum to the total.
- Expired checkouts can be regenerated with a new attempt number in the idempotency key.
- Settlement is one payout, key `squad_payout_<roomId>`, so double-clicking "withdraw" pays once.
- Live caveat: checkout amounts are whole naira, so itemised shares with fractional kobo are rejected.

## AjoSphere: rotating savings club (KYC + dedicated accounts + scheduled payout)

[`demos/ajosphere`](../../demos/ajosphere) · [`clubStore.ts`](../../demos/ajosphere/src/lib/clubStore.ts)

`join → verify BVN/NIN → match name to payout account → create customer + wallet → deposits via webhook → Friday payout`

- **Identity gate:** the KYC name must match the bank-enquiry name for the payout account, so a member can only be paid into an account they own.
- Each member gets a **permanent dedicated account**; a `deposit.completed` webhook credits their contribution by account number.
- Privacy: plaintext BVN/NIN is never stored (SHA-256 hash and last 4 digits only) and never logged.
- Payout key `ajo_payout_<clubId>_round<n>`. If the pot is short, disbursal is held and the organiser chooses to wait or pay a partial pot.
- Each lookup is billed, so the UI warns before verifying in live mode.

## Patterns shared by all four

| Pattern | Where |
|---|---|
| Deterministic idempotency keys | every `createCheckout` / `createMasterPayout` call |
| Verify beneficiary before paying | `BankAccountPicker` in `packages/ui` |
| Server-side state machine, SSE to the browser | every `*Store.ts` and `stream/route.ts` |
| Signature-verified, de-duplicated webhook | every `api/webhook/route.ts` |
| Sample data and simulators only in sandbox | `useMode().isMock`, `denyInLive()` |
