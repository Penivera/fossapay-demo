# 3. Webhooks

Webhooks are how you learn that a payment arrived or a payout settled. Code:
[`webhooks.ts`](../../packages/fossapay-client/src/webhooks.ts); a complete handler:
[`demos/safedeal/src/app/api/webhook/route.ts`](../../demos/safedeal/src/app/api/webhook/route.ts).

## The envelope

```json
{ "eventId": "evt_...", "eventType": "checkout.completed", "data": { "reference": "ORDER-10025", "status": "completed" }, "timestamp": "..." }
```

Headers: `x-fossapay-signature`, `X-Event-Id`, `X-Event-Type`, and `X-Retry-Count` on retries.

## Verify the signature before you trust anything

FossaPay documents two schemes, and the docs disagree about which header is delivered, so this repo accepts both
(`verifyFossaPayWebhookRequest`):

| Header | Signed input | Used by |
|---|---|---|
| `x-fossapay-signature-v2` | the **exact raw request body** | `@fossapay/node` `webhooks.constructEvent` |
| `x-fossapay-signature` | `JSON.stringify(body.data)` (the inner object only) | the Webhooks guide |

Both are lowercase-hex HMAC-SHA256 with your webhook secret, compared with `crypto.timingSafeEqual`.

```ts
export async function POST(req: NextRequest) {
  const rawBody = await req.text();                       // read RAW. Never re-serialise before verifying
  const secret = resolveWebhookSecret();                  // undefined in live mode if not configured
  if (!secret) return NextResponse.json({ error: 'secret not configured' }, { status: 500 });

  const { valid } = verifyFossaPayWebhookRequest(rawBody, req.headers, secret);
  if (!valid) return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
  const { eventId, eventType, data } = JSON.parse(rawBody);
  ...
}
```

Common mistakes: signing the whole envelope; pretty-printing or key-sorting `data`; parsing the body with a framework that
rewrites it before you hash it; falling back to a hardcoded secret.

## Acknowledge fast, process safely

1. Verify, de-duplicate on `eventId`, return `200` immediately.
2. Do the real work (fulfil the order, credit the user) outside the request.
3. Make each state change idempotent using the event's own identifiers (`reference`, `checkoutId`, `payoutId`), because
   delivery can be duplicated or out of order. Failed deliveries retry up to five times with exponential backoff.
4. **A webhook is a hint, not the source of truth.** For anything important, also reconcile through the GET endpoints.

> The demos de-duplicate with an in-memory `Set`, which resets on restart and is per-instance. A product needs a unique
> constraint on `eventId` in a database.

## Events you will handle

| Event | Do |
|---|---|
| `checkout.completed` | Fulfil. The **only** event to fulfil on |
| `checkout.failed` / `expired` / `reversed` | Do not fulfil; stop showing payment instructions |
| `payout.completed` | Mark the payout settled |
| `payout.failed` / `reversed` | Mark unsuccessful; do **not** auto-retry under a new reference |
| `deposit.completed` | Credit a dedicated-account deposit (AjoSphere reads `data.recipient.accountNumber`) |

Ignore unknown event types safely.

## Testing locally

FossaPay cannot reach `localhost`, and there is no simulation endpoint, so:

1. Offline: the mock ledger signs and delivers events itself, and tests build signed fixtures.
2. Against real events: expose a port with a tunnel (`cloudflared`, `ngrok`) and set that URL in
   **Dashboard → Settings → Webhooks**.

The [webhook gateway](../../packages/webhook-gateway) is a small server for exactly this. Point the tunnel at port `8001`;
it verifies each delivery, rejects bad ones with `401`, forwards good ones to the four demos, and shows them in an inspector at
`http://localhost:8001`. Everything except `POST /platforms/webhook` is local-only, because the tunnel publishes the whole port.
