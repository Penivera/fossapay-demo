# FossaPay Showcase & Demo Projects

This repository hosts a collection of practical, production-grade applications powered by [FossaPay](https://docs.fossapay.com/) payment and wallet infrastructure.

Rather than mirroring FossaPay's internal dashboards or API explorers, these projects demonstrate real-world consumer and business applications where FossaPay acts as the invisible fintech engine behind the scenes.

---

## 🚀 The Projects Portfolio

### 1. [Flagship] NEAR Intents Cross-Chain Off-Ramp to Naira (`demos/near-offramp/`)
* **Concept:** Non-custodial DeFi-to-Naira liquidation portal. Connect any Web3 wallet, sell any token on any blockchain (Ethereum, Base, Arbitrum, Bitcoin, Solana, NEAR), swap via NEAR Intents to Solana USDC, and receive instant NGN in your Nigerian bank account.
* **FossaPay Capabilities:** Master Crypto Wallet (Solana), Bank Name Enquiry, Fee Calculation, Master Wallet NGN Payouts.
* **Specification:** Read the complete [NEAR Intents Off-Ramp Architecture Document](file:///home/peni/Projects/fossapay-demo/docs/01-NEAR-INTENTS-OFFRAMP.md).

### 2. SafeDeal: P2P Social Commerce Escrow (`demos/safedeal/`)
* **Concept:** Trustless escrow for Instagram, Twitter, and WhatsApp commerce. Buyers fund the escrow via 30-minute dynamic virtual accounts; funds are released to the seller's bank account with zero internal transfer fees once goods are delivered and approved.
* **FossaPay Capabilities:** Customer Accounts, Checkouts, Zero-Fee Internal Wallet Transfers, Inter-Bank Payouts.
* **Specification:** Read the complete [SafeDeal Specification Document](file:///home/peni/Projects/fossapay-demo/docs/02-SAFEDEAL-ESCROW.md).

### 3. SquadPay: Live Group Bill Splitter (`demos/squadpay/`)
* **Concept:** Shared dining and trip expense splitting with real-time settlement. Each friend receives an individual 30-minute checkout card that lights up green on payment; once collected, the accumulated pool is automatically transferred to the host's bank.
* **FossaPay Capabilities:** Dynamic Checkouts, Real-Time Webhooks (HMAC verification), Bank Name Enquiry, Master Payouts.
* **Specification:** Read the complete [SquadPay Specification Document](file:///home/peni/Projects/fossapay-demo/docs/03-SQUADPAY-SPLITBILL.md).

### 4. AjoSphere: Digital Rotating Savings Club (`demos/ajosphere/`)
* **Concept:** Digitized *Ajo/Esusu* community savings circles with official BVN/NIN identity verification, automated weekly virtual account deposits, and scheduled lump-sum disbursements to each round's recipient.
* **FossaPay Capabilities:** Identity Verification (KYC: BVN/NIN), Dedicated Permanent Virtual Accounts, Deposit Webhooks, Master Payouts.
* **Specification:** Read the complete [AjoSphere Specification Document](file:///home/peni/Projects/fossapay-demo/docs/04-AJOSPHERE-SAVINGS.md).

---

## 📚 Technical Documentation Index

All architectural specifications, integration guidelines, and security requirements are documented in the `docs/` directory:

| Document | Purpose |
| :--- | :--- |
| **[ARCHITECTURE.md](file:///home/peni/Projects/fossapay-demo/docs/ARCHITECTURE.md)** | Global engineering standards, monorepo structure, HMAC webhook verification, and idempotency rules |
| **[01-NEAR-INTENTS-OFFRAMP.md](file:///home/peni/Projects/fossapay-demo/docs/01-NEAR-INTENTS-OFFRAMP.md)** | Flagship cross-chain intent-to-fiat architecture, solver mechanics, and settlement flow |
| **[02-SAFEDEAL-ESCROW.md](file:///home/peni/Projects/fossapay-demo/docs/02-SAFEDEAL-ESCROW.md)** | Two-sided social commerce escrow, state machines, and zero-fee wallet transfers |
| **[03-SQUADPAY-SPLITBILL.md](file:///home/peni/Projects/fossapay-demo/docs/03-SQUADPAY-SPLITBILL.md)** | Real-time bill splitting, Server-Sent Events (SSE), and pool disbursement |
| **[04-AJOSPHERE-SAVINGS.md](file:///home/peni/Projects/fossapay-demo/docs/04-AJOSPHERE-SAVINGS.md)** | Rotating savings governance, KYC validation, and permanent virtual account tracking |

---

## 🛠️ Security & Production Requirements

1. **Production-Only Rails:** FossaPay operates in production (`https://api-production.fossapay.com/api/v1`). API keys must use the `fk_production_` prefix and reside strictly on server infrastructure.
2. **Idempotency:** All mutating requests (payouts, checkouts, KYC) must transmit a unique `X-Idempotency-Key` header.
3. **Webhook Verification:** Webhook deliveries must be validated using HMAC-SHA256 computed strictly over `JSON.stringify(body.data)`.
