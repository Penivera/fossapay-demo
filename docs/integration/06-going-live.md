# 6. Going live

These demos are teaching code. This is what separates them from a system that should hold customer money.

## Must-do

- [ ] **Durable storage.** All demo state is in process memory; it vanishes on restart and differs per serverless instance. Use Postgres/Redis, and persist every idempotency key and FossaPay ID *before* making the call.
- [ ] **Durable webhook de-duplication.** A unique constraint on `eventId`, plus idempotent state transitions keyed on `reference` / `payoutId` / `checkoutId`.
- [ ] **A queue or cron for timers.** Inspection auto-release, checkout expiry and scheduled payouts use `setTimeout` here. Use a job runner that survives restarts.
- [ ] **Reconciliation.** Periodically `GET` every non-terminal checkout and payout; webhooks can be late or lost.
- [ ] **Authentication and authorisation.** The demos have none. Seller/admin views are protected only by a link token. Real products need user accounts, and `/admin` needs real access control.
- [ ] **Collect real customer data.** `customers.create` requires `dateOfBirth`, `address`, `city`, `country`, email and phone. The demos do not collect these yet.
- [ ] **Whole-naira amounts** for checkouts and payouts. Design pricing around it, or round explicitly in your own code.
- [ ] **Secrets management.** Keys and webhook secrets in a secret manager, rotated if exposed. Never client-side, never in logs.
- [ ] **Rate limiting and abuse controls** on public endpoints (deal creation, KYC), especially anything that costs money per call.

## NairaBridge specifically

Do not enable live payouts until the deposit leg is real: verify the on-chain deposit (via the NEAR Intents 1Click status API or your own
chain watcher) and only then request the naira payout. Otherwise anyone can claim a deposit that never arrived.

## Operations

- Alert on non-2xx rates from your webhook endpoint and on webhook-to-state lag.
- Treat `payout.failed` as a human decision. Never auto-retry under a new reference.
- Log FossaPay request IDs and your own references; never log keys, secrets, full account numbers or BVN/NIN.
- Start with small live amounts and one flow at a time.

## Deploying

Each demo is a Next.js app. On Vercel, create one project per demo with Root Directory `demos/<name>`; each folder ships a `vercel.json`
that installs from the repo root and builds the shared client first. Set `FOSSAPAY_MODE`, `FOSSAPAY_API_KEY` and `FOSSAPAY_WEBHOOK_SECRET` per
project and point FossaPay's webhook URL at `https://<your-app>/api/webhook`. The webhook gateway is a local development tool and is not deployable to Vercel.

See also [SECURITY.md](../../SECURITY.md).
