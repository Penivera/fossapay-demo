# FossaPay integration guide

A practical guide to integrating [FossaPay](https://docs.fossapay.com) into a real product, taught through four working
demos in this repository. Read it in order, or jump to what you need.

| # | Guide | You will learn |
|---|---|---|
| 1 | [Getting started](01-getting-started.md) | Run everything locally, sandbox vs live mode, environment variables |
| 2 | [API patterns](02-api-patterns.md) | The FossaPay envelope, idempotency, whole-naira amounts, bank lookup, checkouts, payouts, KYC |
| 3 | [Webhooks](03-webhooks.md) | Signature verification (both schemes), de-duplication, reconciling, local tunnelling |
| 4 | [Recipes](04-recipes.md) | How each demo maps a product idea onto FossaPay calls |
| 5 | [Testing](05-testing.md) | The mock ledger, contract tests, and why there is no sandbox |
| 6 | [Going live](06-going-live.md) | The checklist between a demo and a product that handles real money |

## The mental model

FossaPay is **production-only**: there is no sandbox, and a `fk_production_` key moves real money. Everything in this repo
is therefore built around one idea: **a shared client with two transports**.

```
 your app code ──► FossaPayClient ──┬─ mode=mock ─► in-process ledger (offline, deterministic, free)
                                    └─ mode=live ─► https://api-production.fossapay.com/api/v1
```

Your product code never branches on the mode. It calls `client.checkouts.createCheckout(...)`, and the mode decides
whether that touches an in-memory map or the real API. Webhooks follow the same rule: the mock ledger signs and delivers
events exactly as FossaPay does, so the handler you test offline is the handler you ship.

## Which FossaPay building block do I need?

| Product need | FossaPay feature | Demo that uses it |
|---|---|---|
| Collect a one-off payment from someone | **Checkout** (30-minute NGN account) | SafeDeal, SquadPay |
| Give each user a permanent deposit account | **Customer + NGN wallet** (dedicated virtual account) | AjoSphere, SafeDeal |
| Pay out to any Nigerian bank account | **Master wallet payout** | all four |
| Move money between your own users, free | **Wallet-to-wallet transfer** | SafeDeal |
| Verify who someone is | **Identity verification** (BVN / NIN, billed per lookup) | AjoSphere |
| Check an account name before paying | **Bank name enquiry** | all four |
| React to payments | **Webhooks** | all four |

## Official SDKs

FossaPay publishes [`@fossapay/node`](https://docs.fossapay.com/sdks/node) (server) and
[`@fossapay/checkout`](https://docs.fossapay.com/sdks/checkout) (hosted checkout UI). This repo uses its own small
`@fossapay/client` instead, for two reasons: it ships the offline mock ledger that makes the demos runnable without
credentials, and the Node SDK does not cover checkouts or identity verification. If you are building a product rather than
a demo, prefer the official SDKs where they cover your need and borrow the patterns here (idempotency keys, webhook
handling, reconciliation) for the rest.
