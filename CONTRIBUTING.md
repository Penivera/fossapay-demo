# Contributing

Thanks for helping improve these FossaPay demos. Small, focused pull requests are easiest to review.

## Ground rules

- Be kind: see the [Code of Conduct](CODE_OF_CONDUCT.md).
- **Never commit secrets** (`.env`, API keys, webhook secrets, real BVN/NIN or account numbers).
- **Never run money-moving calls against FossaPay production in tests.** FossaPay has no sandbox. All automated tests use
  the in-process mock ledger or a stubbed `fetch`.
- Money is never floating point. Use the helpers in `@fossapay/client` (`toKobo`, `fromKobo`, `distributeAmount`).

## Setup

Requires Node.js 20+ (see `.nvmrc`) and npm 10+.

```bash
git clone https://github.com/Penivera/fossapay-demo.git
cd fossapay-demo
npm install
npm run build --workspace=packages/fossapay-client   # demos import the built client
npm run dev:safedeal                                  # or dev:offramp, dev:squadpay, dev:ajosphere, gateway
```

## Before opening a pull request

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

CI runs the same commands. If you change the live FossaPay transport, update the contract tests in
`packages/fossapay-client/test/live-contract.test.ts` against the
[OpenAPI spec](https://docs.fossapay.com/api-reference/openapi.json).

## Project layout

| Path | What it is |
|---|---|
| `packages/fossapay-client` | Typed client, mock ledger, webhook verification, money math |
| `packages/ui` | Shared design system (tokens, Tailwind preset, components) |
| `packages/webhook-gateway` | Local webhook ingestion and inspector |
| `demos/*` | The four Next.js demo apps |
| `docs/integration` | The integration guide |

## Style

Prettier config is in `.prettierrc`; `.editorconfig` covers the basics. Keep UI changes inside `@fossapay/ui`
primitives where possible so all demos stay consistent. Any sample data must be gated on `useMode().isMock` so live mode
shows none.

## Commit messages

Conventional style, for example `fix(safedeal): ...`, `feat(ui): ...`, `docs: ...`.

## Reporting bugs and ideas

Use the [issue templates](https://github.com/Penivera/fossapay-demo/issues/new/choose). For security issues see
[SECURITY.md](SECURITY.md).
