# Security Policy

This repository contains **demonstration code**. It is meant to teach FossaPay integration patterns, not to be
deployed as-is to handle customer money. Even so, we take security reports seriously because people copy patterns
from examples.

## Reporting a vulnerability

Please **do not open a public issue** for security problems.

Use GitHub's private reporting: **Security tab → "Report a vulnerability"**
([direct link](https://github.com/Penivera/fossapay-demo/security/advisories/new)), or email
**penivera655@gmail.com**.

Include what you found, how to reproduce it, and the impact. You can expect an acknowledgement within 5 business days.

## Scope

In scope: this repository's code (the shared client, webhook verification, the gateway, the demos).

Out of scope: vulnerabilities in FossaPay's own API or dashboard. Report those to FossaPay at
[product@fossapay.com](mailto:product@fossapay.com).

## If you leak a credential

FossaPay is production-only: a leaked `fk_production_` key or webhook secret is a financial risk.
Rotate it in the [FossaPay dashboard](https://dashboard.fossapay.com) immediately, then clean up your history.
Never commit `.env` files. This repo's `.gitignore` excludes them.

## Hardening already in place

- Webhook signatures are verified with `crypto.timingSafeEqual`; a missing secret fails closed in live mode.
- No webhook secret has a hardcoded fallback in live mode.
- Simulation endpoints return `403` in live mode.
- The gateway serves everything except the signed webhook route to local requests only, and escapes all payloads.
- Identity numbers (BVN/NIN) are never stored in plaintext: only a SHA-256 hash and the last 4 digits.

## Known limitations (demo-grade by design)

State is in memory, webhook de-duplication is per-process, and the demos have no end-user authentication.
See [docs/integration/06-going-live.md](docs/integration/06-going-live.md) for what a production system needs.
