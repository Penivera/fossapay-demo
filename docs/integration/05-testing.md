# 5. Testing without a sandbox

FossaPay has no test environment, so a test that calls the real API would spend real money. The repo therefore tests at three levels,
none of which touch production.

| Level | What | Where |
|---|---|---|
| Unit | Money maths, signature verification, de-duplication | `packages/fossapay-client/test/fossapay.test.ts` |
| Contract | Live transport with `fetch` stubbed: asserts method, path, headers and body against the OpenAPI spec | `packages/fossapay-client/test/live-contract.test.ts` |
| Flow | Each demo's full journey against the mock ledger, including signed webhooks | `demos/*/test/e2e.test.ts` |

```bash
npm test            # everything
npm run test:e2e    # just the journeys
```

## The mock ledger

`MockFossaPayLedger` is an in-memory implementation of the same surface. It deduplicates idempotency keys, creates checkouts, and
after a short delay **signs and delivers** webhooks to your registered listener or URL, using the real signing scheme, so webhook handlers
are exercised end to end. Bank enquiry is deterministic (`0123456789` resolves to `OLUWASEUN CHUKWUDI ADENIYI`).

## Writing a contract test

```ts
const { client, calls } = liveClient(() => ({ json: { status: 'success', data: { /* spec-shaped response */ } } }));
await client.payouts.createMasterPayout(req, 'key-1');
expect(calls[0].url).toBe('https://api-production.fossapay.com/api/v1/payouts');
expect(calls[0].body).toEqual({ amount: 5000, currency: 'NGN', destinationBankCode: '058', /* ... */ });
```

When FossaPay changes an endpoint, update the stub and assertion from the OpenAPI spec first, then the client.

## Validating live

After the offline suite passes, validate with **one small real transaction**: create a checkout for a low amount, pay it, confirm the signed
webhook arrives and de-duplicates, and reconcile by `GET`. FossaPay's own guidance is the same.
