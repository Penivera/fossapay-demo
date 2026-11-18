# Changelog

All notable changes are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project uses [Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-11-18

### Added
- Four demos: NairaBridge (off-ramp), SafeDeal (escrow), SquadPay (bill splitter), AjoSphere (savings club).
- `@fossapay/client`: typed client with an offline mock ledger, webhook verification and kobo-safe money math.
- `@fossapay/ui`: shared design system.
- Webhook gateway and inspector.
- Integration guide in `docs/integration`.

### Security
- Webhook verification for both documented signature schemes; fail closed in live mode.
- Simulation endpoints disabled in live mode; unauthenticated payout route removed.
