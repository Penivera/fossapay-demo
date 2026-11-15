# Frontend Design & UI Specification: Cloudflare / Reach Aesthetic
## NEAR Intents Cross-Chain Off-Ramp to Naira

**Target Directory:** `demos/near-offramp/`  
**Design System Origin:** Cloudflare Dashboard & [deck.reachapp.xyz](https://deck.reachapp.xyz) (`cf-` design tokens)  
**Wallet Infrastructure:** Complete NEAR.com Ecosystem (NEAR Wallet Selector, FastAuth Passkeys, EVM/WalletConnect, Solana)

---

## 1. Design Tokens & Styling Primitives (from `deck.reachapp.xyz`)

The UI adopts the exact visual language of `deck.reachapp.xyz`: high-contrast, technical dark slate, crisp 1px borders, Cloudflare Orange accents, and monospace typefaces for technical telemetry.

| Token | Class Name | Value / Spec | Usage |
| :--- | :--- | :--- | :--- |
| **Dark Canvas** | `bg-slate-950` | `#0f172a` (RGB 15, 23, 42) | Full-screen app background |
| **Card Surface** | `.cf-card-dark` | `#1e293b` (RGB 30, 41, 59) | Floating cards, modal bodies |
| **Crisp Border** | `border-slate-700` | `1px solid #334155` (RGB 51, 65, 85) | Card borders, dividers, inputs |
| **Cloudflare Orange** | `.cf-kicker` / `.cf-badge-orange` | `#ea580c` (RGB 234, 88, 12) | Primary brand accent, active tabs, kickers |
| **Orange Tint Surface** | `bg-orange-500/10` | `rgba(234, 88, 12, 0.12)` | Badge backgrounds, input focus rings |
| **Emerald Accent** | `.cf-badge-green` | `#16a34a` (RGB 22, 163, 74) | Account resolved, transaction success |
| **Muted Slate Text** | `text-slate-400` | `#94a3b8` (RGB 148, 163, 184) | Labels, exchange rate details, footnotes |
| **Kicker / Tech Font**| `font-mono` | `"JetBrains Mono", monospace` | Kickers, step numbers (`01`, `02`), hashes |
| **Headline / Body Font**| `font-sans` | `Inter, -apple-system, sans-serif` | Amounts, bank names, primary buttons |

---

## 2. Complete Wallet Support Matrix (as supported by `near.com`)

The wallet connection modal implements the **NEAR Wallet Selector** architecture, unifying Web2 social logins, NEAR native accounts, EVM chains, and Solana:

```text
┌────────────────────────────────────────────────────────────────────────┐
│  SELECT WALLET OR SIGN-IN METHOD                                   [×] │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  [ SOCIAL / PASSKEYS ]    [ NEAR NATIVE ]    [ EVM / MULTI ]   [ SOL ] │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ 🔑 Continue with Passkey / Google (FastAuth)           [Instant] │  │
│  │    Near account created automatically in 2 seconds               │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  NEAR WALLETS                                                          │
│  ┌───────────────────────────────┐   ┌──────────────────────────────┐  │
│  │ [M] MyNearWallet              │   │ [☄] Meteor Wallet            │  │
│  ├───────────────────────────────┤   ├──────────────────────────────┤  │
│  │ [H] HERE Wallet (Mobile/TG)   │   │ [S] Sender Wallet            │  │
│  ├───────────────────────────────┤   ├──────────────────────────────┤  │
│  │ [B] Bitte Wallet (Mintbase)   │   │ [📱] Near Mobile / Ledger    │  │
│  └───────────────────────────────┘   └──────────────────────────────┘  │
│                                                                        │
│  EVM & MULTI-CHAIN WALLETS                                             │
│  ┌───────────────────────────────┐   ┌──────────────────────────────┐  │
│  │ [🦊] MetaMask (EVM Chains)    │   │ [🌈] Rainbow / Coinbase      │  │
│  ├───────────────────────────────┤   ├──────────────────────────────┤  │
│  │ [⚡] Rabby Wallet             │   │ [🔗] WalletConnect (300+)    │  │
│  └───────────────────────────────┘   └──────────────────────────────┘  │
│                                                                        │
│  SOLANA NATIVE                                                         │
│  ┌───────────────────────────────┐   ┌──────────────────────────────┐  │
│  │ [👻] Phantom (Solana)         │   │ [☀️] Solflare                │  │
│  └───────────────────────────────┘   └──────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Screen 1: The Off-Ramp Terminal (Main View)

Notice the **`cf-` design language**: the uppercase JetBrains Mono kicker, high-contrast dark surface, 1px crisp borders, numbered step tabs, and Cloudflare Orange accents.

```text
┌───────────────────────────────────────────────────────────────────────────────────────┐
│ [⚡] NAIRABRIDGE // NEAR INTENTS GATEWAY                   [ Arbitrum ▾ ] [ 0x71c...49a ] │
├───────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                       │
│   CROSS-CHAIN LIQUIDATION & SETTLEMENT                                                │
│   Instant Naira Payouts for Any Web3 Token.                                           │
│   <span class="cf-kicker">NEAR INTENTS // FOSSAPAY FIAT ENGINE</span>                               │
│                                                                                       │
│   ┌───────────────────────────────────────────────────────────────────────────────┐   │
│   │ .cf-card-dark                                                                 │   │
│   │                                                                               │   │
│   │  <div class="cf-kicker">01 // ORIGIN ASSET (YOU SELL)</div>                          │   │
│   │  ┌────────────────────────────────────────┐ ┌──────────────────────────────┐  │   │
│   │  │ 100.00                                 │ │ [USDT] Arbitrum            ▾ │  │   │
│   │  └────────────────────────────────────────┘ └──────────────────────────────┘  │   │
│   │  <span class="font-mono text-xs">Balance: 420.50 USDT</span>  [MAX]     <span class="text-xs text-slate-400">≈ $100.00 USD</span>      │   │
│   │                                                                               │   │
│   │  ───────────────────────────────── [ ↓ ] ───────────────────────────────────  │   │
│   │  <span class="cf-badge cf-badge-orange">SOLVER RATE</span> 1 USDT = 1.000 USDC (Solana) ➔ ₦1,595.00 NGN   │   │
│   │                                                                               │   │
│   │  <div class="cf-kicker">02 // FIAT SETTLEMENT (YOU RECEIVE)</div>                     │   │
│   │  ┌─────────────────────────────────────────────────────────────────────────┐  │   │
│   │  │ ₦ 159,450.00                                                            │  │   │
│   │  └─────────────────────────────────────────────────────────────────────────┘  │   │
│   │                                                                               │   │
│   │  <span class="text-xs font-mono uppercase text-slate-400">DESTINATION BANK ACCOUNT</span>            │   │
│   │  ┌────────────────────────────────────────┐ ┌──────────────────────────────┐  │   │
│   │  │ 0123456789                             │ │ OPay                       ▾ │  │   │
│   │  └────────────────────────────────────────┘ └──────────────────────────────┘  │   │
│   │                                                                               │   │
│   │  <span class="cf-badge cf-badge-green">✓ NUBAN RESOLVED: OLUWASEUN CHUKWUDI ADENIYI</span>            │   │
│   │                                                                               │   │
│   │  ───────────────────────────────────────────────────────────────────────────  │   │
│   │  TELEMETRY & FEES:                                                            │   │
│   │  • Intent Routing:  Arbitrum (USDT) ➔ Solana (USDC) via NEAR Intent Solvers    │   │
│   │  • Solvers Output:  99.90 USDC (Guaranteed min)                               │   │
│   │  • Payout Fee:      ₦50.00 (FossaPay NIBSS clearing)                          │   │
│   │  • Settlement SLA:  ~12 seconds                                               │   │
│   │                                                                               │   │
│   │  ┌─────────────────────────────────────────────────────────────────────────┐  │   │
│   │  │               [ INITIATE OFF-RAMP & EXECUTE INTENT ]                    │  │   │
│   │  └─────────────────────────────────────────────────────────────────────────┘  │   │
│   │                                                                               │   │
│   └───────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                       │
│   <span class="cf-badge cf-badge-slate">NEAR INTENTS</span>  <span class="cf-badge cf-badge-slate">SOLANA USDC</span>  <span class="cf-badge cf-badge-orange">FOSSAPAY RAILS</span>  <span class="cf-badge cf-badge-slate">NIBSS INSTANT</span>        │
└───────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Screen 2: Real-Time Execution Telemetry (The Solver & Payout Terminal)

When the user signs the debit transaction, the card transforms into an active execution terminal with telemetry steps matching `deck.reachapp.xyz` style:

```text
┌───────────────────────────────────────────────────────────────────────────────────────┐
│  SETTLEMENT IN PROGRESS                                         SESSION: int_8f3a91bc │
├───────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                       │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐  │
│  │                                                                                 │  │
│  │   01  ORIGIN TRANSACTION BROADCAST                               [ CONFIRMED ]  │  │
│  │       <span class="font-mono text-xs text-orange-500">100.00 USDT debited on Arbitrum One</span>                             │  │
│  │       Tx: <span class="font-mono text-xs text-slate-400">0x4f8a...9c2e</span>  [View on Arbiscan ↗]                            │  │
│  │                                                                                 │  │
│  │   02  SOLVER MATCH & NEAR INTENT EXECUTION                        [ COMPLETED ] │  │
│  │       Solvers matched intent with zero slippage                                 │  │
│  │       Delivered 99.90 USDC to FossaPay Solana Master Wallet                     │  │
│  │       Tx: <span class="font-mono text-xs text-slate-400">5KNv...7Xp1</span>  [View on Solscan ↗]                             │  │
│  │                                                                                 │  │
│  │   03  FOSSAPAY FIAT DISBURSEMENT                              [ IN PROGRESS... ]│  │
│  │       Dispatched ₦159,450.00 to OPay (Acct: 0123456789)                         │  │
│  │       Beneficiary: OLUWASEUN CHUKWUDI ADENIYI                                   │  │
│  │       Reference: <span class="font-mono text-xs text-orange-500">FP_PAY_e4b1a8c9</span>                                      │  │
│  │                                                                                 │  │
│  │   04  INTER-BANK SETTLEMENT (NIBSS)                                  [ PENDING ]│  │
│  │       Awaiting clearing acknowledgment from receiving bank (~5s)                │  │
│  │                                                                                 │  │
│  └─────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                       │
│  <div class="cf-progress-bar" style="width: 75%;"></div>                                     │
└───────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Screen 3: Settlement Success & Cryptographic Receipt

```text
┌───────────────────────────────────────────────────────────────────────────────────────┐
│  TRANSACTION CLEARED                                             STATUS: 200 SUCCESS  │
├───────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                       │
│   <span class="cf-badge cf-badge-green">✓ SETTLED TO BENEFICIARY ACCOUNT</span>                                       │
│                                                                                       │
│   <h1 class="text-3xl font-mono font-bold text-white">₦ 159,450.00</h1>                │
│                                                                                       │
│   ┌───────────────────────────────────────────────────────────────────────────────┐   │
│   │ .cf-card-dark                                                                 │   │
│   │                                                                               │   │
│   │  BENEFICIARY:        OLUWASEUN CHUKWUDI ADENIYI                               │   │
│   │  BANK:               OPay Digital Services (100004)                           │   │
│   │  ACCOUNT NUMBER:     0123456789                                               │   │
│   │  DATE / TIME:        Nov 3, 2026 • 21:40:12 GMT+1                             │   │
│   │  FOSSAPAY REF:       FP_PAY_e4b1a8c9                                          │   │
│   │  NIBSS SESSION ID:   1000042611032140129841203                                │   │
│   │  ORIGIN ASSET:       100.00 USDT (Arbitrum)                                   │   │
│   │  SETTLED ON SOLANA:  99.90 USDC (FossaPay Master Vault)                       │   │
│   │                                                                               │   │
│   └───────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                       │
│   ┌───────────────────────────┐           ┌───────────────────────────────────────┐   │
│   │ [ DOWNLOAD PDF RECEIPT ]  │           │       [ START ANOTHER OFF-RAMP ]      │   │
│   └───────────────────────────┘           └───────────────────────────────────────┘   │
│                                                                                       │
└───────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. CSS Module Implementation Details

These classes replicate the exact behavior of `deck.reachapp.xyz`:

```css
/* Cloudflare / Reach Design Tokens */
.cf-deck-root {
  background-color: #0f172a;
  color: #f8fafc;
  font-family: 'Inter', sans-serif;
  -webkit-font-smoothing: antialiased;
}

.cf-card-dark {
  background-color: #1e293b;
  border: 1px solid #334155;
  border-radius: 12px;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.cf-card-dark:hover {
  border-color: #475569;
}

.cf-kicker {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: #ea580c; /* Cloudflare Orange */
}

.cf-badge {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 3px 8px;
  border-radius: 9999px;
  display: inline-flex;
  align-items: center;
}

.cf-badge-orange {
  color: #ea580c;
  background-color: rgba(234, 88, 12, 0.12);
  border: 1px solid rgba(234, 88, 12, 0.25);
}

.cf-badge-green {
  color: #16a34a;
  background-color: rgba(22, 163, 74, 0.12);
  border: 1px solid rgba(22, 163, 74, 0.25);
}

.cf-badge-slate {
  color: #94a3b8;
  background-color: rgba(148, 163, 184, 0.12);
  border: 1px solid rgba(148, 163, 184, 0.25);
}

.cf-progress-bar {
  height: 3px;
  background-color: #ea580c;
  transition: width 0.3s ease-out;
}
```
