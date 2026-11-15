import crypto from 'node:crypto';
import BigNumber from 'bignumber.js';
import { signFossaPayWebhook } from './webhooks.js';
import { toKobo, fromKobo } from './money.js';
import type {
  SupportedBank,
  BankEnquiryResult,
  CalculateFeeResult,
  CustomerRecord,
  CreateCustomerRequest,
  FiatWalletRecord,
  CreateFiatWalletRequest,
  CryptoWalletRecord,
  CreateCryptoWalletRequest,
  MasterCryptoWallet,
  TransferFiatRequest,
  TransferFiatRecord,
  CreateCheckoutRequest,
  CheckoutRecord,
  CreatePayoutRequest,
  PayoutRecord,
  KycVerificationRequest,
  KycVerificationResult,
  FossaPayWebhookEvent,
} from './types.js';

export const MOCK_BANKS: SupportedBank[] = [
  { name: 'OPay Digital Services', code: '999992', slug: 'opay', active: true },
  { name: 'Guaranty Trust Bank (GTBank)', code: '058', slug: 'gtb', active: true },
  { name: 'Kuda Microfinance Bank', code: '090110', slug: 'kuda', active: true },
  { name: 'Zenith Bank', code: '057', slug: 'zenith', active: true },
  { name: 'Providus Bank', code: '101', slug: 'providus', active: true },
  { name: 'Access Bank', code: '044', slug: 'access', active: true },
  { name: 'PalmPay', code: '100033', slug: 'palmpay', active: true },
  { name: 'First Bank of Nigeria', code: '011', slug: 'firstbank', active: true },
  { name: 'United Bank for Africa (UBA)', code: '033', slug: 'uba', active: true },
  { name: 'Moniepoint MFB', code: '090405', slug: 'moniepoint', active: true },
];

const KNOWN_ACCOUNT_NAMES: Record<string, string> = {
  '0123456789': 'OLUWASEUN CHUKWUDI ADENIYI',
  '9988776655': 'TUNDE BALOGUN',
  '1122334455': 'CHIDINMA OKONKWO',
  '5566778899': 'IBRAHIM MUSA',
  '1234567890': 'BABATUNDE ADEYEMI',
  '2034918234': 'NGOZI ADICHIE',
};

const FIRST_NAMES = ['CHUKWUDI', 'OLUWASEUN', 'TUNDE', 'CHIDINMA', 'IBRAHIM', 'FATIMA', 'EMMANUEL', 'FOLAKE', 'ZAINAB', 'EMEKA'];
const LAST_NAMES = ['ADENIYI', 'BALOGUN', 'OKONKWO', 'MUSA', 'ADEBAYO', 'DANJUMA', 'EZE', 'OSUNDARE', 'BELLO', 'NWOSU'];

export type WebhookListener = (event: FossaPayWebhookEvent, signature: string) => Promise<void> | void;

export interface MockLedgerOptions {
  webhookSecret?: string;
  webhookUrl?: string;
  defaultDelayMs?: number;
  autoCompletePayouts?: boolean;
}

export class MockFossaPayLedger {
  private webhookSecret: string;
  private webhookUrl?: string;
  private defaultDelayMs: number;
  private autoCompletePayouts: boolean;

  readonly customers = new Map<string, CustomerRecord>();
  readonly fiatWallets = new Map<string, FiatWalletRecord>();
  readonly cryptoWallets = new Map<string, CryptoWalletRecord>();
  readonly checkouts = new Map<string, CheckoutRecord>();
  readonly payouts = new Map<string, PayoutRecord>();
  readonly kycVerifications = new Map<string, KycVerificationResult>();
  readonly idempotencyRecords = new Map<string, any>();
  private listeners: WebhookListener[] = [];

  constructor(options: MockLedgerOptions = {}) {
    this.webhookSecret = options.webhookSecret || process.env.FOSSAPAY_WEBHOOK_SECRET || 'test_webhook_secret_mock_12345';
    this.webhookUrl = options.webhookUrl || process.env.FOSSAPAY_WEBHOOK_URL;
    this.defaultDelayMs = options.defaultDelayMs ?? 50;
    this.autoCompletePayouts = options.autoCompletePayouts ?? true;

    // Initialize master crypto wallet
    this.cryptoWallets.set('master_solana_wallet', {
      id: 'master_solana_wallet',
      network: 'solana',
      address: 'FossaPaySolanaMasterVault1111111111111111111',
      tokens: [
        { symbol: 'USDC', balance: '1000000.00', decimals: 6 },
        { symbol: 'SOL', balance: '50000.00', decimals: 9 },
      ],
    });
  }

  setWebhookSecret(secret: string): void {
    this.webhookSecret = secret;
  }

  setWebhookUrl(url: string): void {
    this.webhookUrl = url;
  }

  addListener(listener: WebhookListener): void {
    this.listeners.push(listener);
  }

  removeListener(listener: WebhookListener): void {
    this.listeners = this.listeners.filter((l) => l !== listener);
  }

  async dispatchWebhook(event: FossaPayWebhookEvent): Promise<void> {
    const signature = signFossaPayWebhook(event.data as unknown as Record<string, unknown>, this.webhookSecret);

    // Notify in-process listeners
    for (const listener of this.listeners) {
      try {
        await listener(event, signature);
      } catch (err) {
        console.error('[MockLedger] In-process webhook listener error:', err);
      }
    }

    // Dispatch via HTTP if webhookUrl is set
    if (this.webhookUrl) {
      try {
        await fetch(this.webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-fossapay-signature': signature,
          },
          body: JSON.stringify(event),
        });
      } catch (err) {
        // Silently capture dispatch error in mock mode
        console.warn(`[MockLedger] HTTP dispatch to ${this.webhookUrl} failed:`, err);
      }
    }
  }

  // --- Bank & Transfer Methods ---

  getSupportedBanks(): SupportedBank[] {
    return [...MOCK_BANKS];
  }

  bankEnquiry(accountNumber: string, bankCode: string): BankEnquiryResult {
    const cleanAcct = accountNumber.replace(/\D/g, '');
    if (cleanAcct.length !== 10) {
      throw new Error(`Invalid NUBAN: account number must be 10 digits (received ${cleanAcct.length})`);
    }

    const bank = MOCK_BANKS.find((b) => b.code === bankCode) || {
      name: 'Commercial Bank',
      code: bankCode,
    };

    let name = KNOWN_ACCOUNT_NAMES[cleanAcct];
    if (!name) {
      // Deterministic hash based generator
      let sum = 0;
      for (let i = 0; i < cleanAcct.length; i++) {
        sum = (sum * 31 + cleanAcct.charCodeAt(i)) >>> 0;
      }
      const first = FIRST_NAMES[sum % FIRST_NAMES.length];
      const last = LAST_NAMES[(sum >> 4) % LAST_NAMES.length];
      name = `${first} ${last}`;
    }

    return {
      accountNumber: cleanAcct,
      accountName: name,
      bankCode: bank.code,
      bankName: bank.name,
      sessionId: `999${Date.now()}${cleanAcct.slice(-4)}`,
    };
  }

  calculateFiatFee(amount: string | number): CalculateFeeResult {
    const bn = new BigNumber(amount);
    return {
      amount: bn.toFixed(2),
      fee: '50.00', // Standard FossaPay NIBSS clearing fee
      feeBearer: 'customer',
      currency: 'NGN',
    };
  }

  // --- Customers ---

  createCustomer(data: CreateCustomerRequest): CustomerRecord {
    const id = `cust_${crypto.randomBytes(6).toString('hex')}`;
    const record: CustomerRecord = {
      id,
      email: data.email,
      phoneNumber: data.phoneNumber,
      firstName: data.firstName,
      lastName: data.lastName,
      createdAt: new Date().toISOString(),
      metadata: data.metadata,
    };
    this.customers.set(id, record);
    return record;
  }

  getCustomer(id: string): CustomerRecord {
    const cust = this.customers.get(id);
    if (!cust) {
      throw new Error(`Customer with id ${id} not found`);
    }
    return cust;
  }

  listCustomers(): CustomerRecord[] {
    return Array.from(this.customers.values());
  }

  // --- Fiat Wallets ---

  createFiatWallet(data: CreateFiatWalletRequest): FiatWalletRecord {
    const id = `wlt_fiat_${crypto.randomBytes(6).toString('hex')}`;
    const cleanAcct = `99${crypto.randomInt(10000000, 99999999).toString()}`;
    const record: FiatWalletRecord = {
      id,
      customerId: data.customerId,
      accountNumber: cleanAcct,
      accountName: 'FOSSAPAY / ' + (data.customerId ? `CUST-${data.customerId.slice(-4)}` : 'DEDICATED'),
      bankName: 'Providus Bank',
      bankCode: '101',
      currency: data.currency || 'NGN',
      balance: '0.00',
      createdAt: new Date().toISOString(),
    };
    this.fiatWallets.set(id, record);
    return record;
  }

  getFiatWallet(id: string): FiatWalletRecord {
    const wallet = this.fiatWallets.get(id);
    if (!wallet) {
      throw new Error(`Fiat wallet with id ${id} not found`);
    }
    return wallet;
  }

  transferFiat(data: TransferFiatRequest): TransferFiatRecord {
    const source = this.fiatWallets.get(data.sourceWalletId);
    const dest = this.fiatWallets.get(data.destinationWalletId);

    if (!source || !dest) {
      throw new Error('Source or destination fiat wallet not found');
    }

    const transferAmountKobo = toKobo(data.amount);
    const sourceKobo = toKobo(source.balance);

    if (sourceKobo < transferAmountKobo) {
      throw new Error(`Insufficient funds: source wallet balance is ${source.balance}`);
    }

    // Ledger move: internal wallet-to-wallet transfer is free (0.00 fee)
    source.balance = fromKobo(sourceKobo - transferAmountKobo);
    dest.balance = fromKobo(toKobo(dest.balance) + transferAmountKobo);

    const record: TransferFiatRecord = {
      id: `wtr_${crypto.randomBytes(6).toString('hex')}`,
      sourceWalletId: source.id,
      destinationWalletId: dest.id,
      amount: fromKobo(transferAmountKobo),
      fee: '0.00',
      status: 'completed',
      reference: `ref_wtr_${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    return record;
  }

  // --- Crypto Wallets ---

  createCryptoWallet(data: CreateCryptoWalletRequest): CryptoWalletRecord {
    const id = `wlt_crypto_${crypto.randomBytes(6).toString('hex')}`;
    const address = data.network === 'solana'
      ? `Sol${crypto.randomBytes(20).toString('hex')}`
      : `G${crypto.randomBytes(20).toString('hex')}`;

    const record: CryptoWalletRecord = {
      id,
      network: data.network,
      address,
      tokens: [
        { symbol: 'USDC', balance: '0.00', decimals: 6 },
      ],
    };
    this.cryptoWallets.set(id, record);
    return record;
  }

  getMasterCryptoWallets(): MasterCryptoWallet[] {
    const master = this.cryptoWallets.get('master_solana_wallet');
    return master ? [master as MasterCryptoWallet] : [];
  }

  getCryptoBalance(walletId: string, symbol?: string): string {
    const wallet = this.cryptoWallets.get(walletId);
    if (!wallet) throw new Error(`Crypto wallet ${walletId} not found`);
    if (symbol) {
      const token = wallet.tokens.find((t) => t.symbol.toUpperCase() === symbol.toUpperCase());
      return token ? token.balance : '0.00';
    }
    return wallet.tokens[0]?.balance || '0.00';
  }

  // --- Checkouts ---

  createCheckout(data: CreateCheckoutRequest, idempotencyKey: string): CheckoutRecord {
    if (!idempotencyKey) {
      throw new Error('X-Idempotency-Key header is strictly required for /checkouts');
    }

    if (this.idempotencyRecords.has(idempotencyKey)) {
      return this.idempotencyRecords.get(idempotencyKey);
    }

    const id = `chk_${crypto.randomBytes(6).toString('hex')}`;
    const ref = data.reference || `ref_chk_${Date.now()}`;
    const amountKobo = toKobo(data.amount);
    const amountStr = fromKobo(amountKobo);
    const feeStr = '50.00';
    const feeBearer = data.feeBearer || 'customer';
    const amountPayable = (feeBearer === 'customer' || feeBearer === 'buyer')
      ? fromKobo(amountKobo + toKobo(feeStr))
      : amountStr;

    const expiresInMinutes = data.expiresInMinutes || 30;
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000).toISOString();

    const record: CheckoutRecord = {
      id,
      reference: ref,
      amount: amountStr,
      fee: feeStr,
      amountPayable,
      feeBearer,
      currency: data.currency || 'NGN',
      status: 'pending',
      accountNumber: `88${crypto.randomInt(10000000, 99999999)}`,
      bankName: 'Wema Bank (FossaPay Dynamic)',
      bankCode: '035',
      accountName: 'FOSSAPAY CHECKOUT / ' + ref.slice(-8),
      expiresAt,
      createdAt: new Date().toISOString(),
      metadata: data.metadata,
    };

    this.checkouts.set(id, record);
    this.idempotencyRecords.set(idempotencyKey, record);
    return record;
  }

  getCheckout(id: string): CheckoutRecord {
    const chk = this.checkouts.get(id);
    if (!chk) throw new Error(`Checkout with id ${id} not found`);
    return chk;
  }

  async simulateCheckoutPayment(
    checkoutId: string,
    sender?: { accountName?: string; accountNumber?: string; bankCode?: string; bankName?: string }
  ): Promise<CheckoutRecord> {
    const chk = this.checkouts.get(checkoutId);
    if (!chk) throw new Error(`Checkout ${checkoutId} not found`);
    if (chk.status !== 'pending') {
      throw new Error(`Checkout ${checkoutId} is already ${chk.status}`);
    }

    chk.status = 'completed';
    const paidAt = new Date().toISOString();

    const event: FossaPayWebhookEvent = {
      eventId: `evt_${crypto.randomBytes(6).toString('hex')}`,
      eventType: 'checkout.completed',
      timestamp: paidAt,
      data: {
        checkoutId: chk.id,
        reference: chk.reference,
        status: 'completed',
        amount: chk.amount,
        fee: chk.fee,
        amountPayable: chk.amountPayable,
        currency: chk.currency,
        sender: sender || {
          accountName: 'MOCK SENDER',
          accountNumber: '0123456789',
          bankCode: '999992',
          bankName: 'OPay',
        },
        paidAt,
      },
    };

    setTimeout(() => {
      this.dispatchWebhook(event).catch(console.error);
    }, this.defaultDelayMs);

    return chk;
  }

  async simulateCheckoutExpiry(checkoutId: string): Promise<CheckoutRecord> {
    const chk = this.checkouts.get(checkoutId);
    if (!chk) throw new Error(`Checkout ${checkoutId} not found`);
    if (chk.status !== 'pending') return chk;

    chk.status = 'expired';
    const expiredAt = new Date().toISOString();

    const event: FossaPayWebhookEvent = {
      eventId: `evt_${crypto.randomBytes(6).toString('hex')}`,
      eventType: 'checkout.expired',
      timestamp: expiredAt,
      data: {
        checkoutId: chk.id,
        reference: chk.reference,
        status: 'expired',
        amount: chk.amount,
        expiredAt,
      },
    };

    setTimeout(() => {
      this.dispatchWebhook(event).catch(console.error);
    }, this.defaultDelayMs);

    return chk;
  }

  // --- Dedicated Account Deposits ---

  async simulateDeposit(
    accountNumber: string,
    amount: string | number,
    sender?: { accountName?: string; accountNumber?: string; bankCode?: string }
  ): Promise<void> {
    const amountKobo = toKobo(amount);
    const amountStr = fromKobo(amountKobo);
    const creditedAt = new Date().toISOString();

    const event: FossaPayWebhookEvent = {
      eventId: `evt_${crypto.randomBytes(6).toString('hex')}`,
      eventType: 'deposit.completed',
      timestamp: creditedAt,
      data: {
        depositId: `dep_${crypto.randomBytes(6).toString('hex')}`,
        accountNumber,
        bankCode: '101',
        amount: amountStr,
        currency: 'NGN',
        reference: `ref_dep_${Date.now()}`,
        sender: sender || {
          accountName: 'MOCK DEPOSITOR',
          accountNumber: '0123456789',
          bankCode: '999992',
        },
        creditedAt,
      },
    };

    setTimeout(() => {
      this.dispatchWebhook(event).catch(console.error);
    }, this.defaultDelayMs);
  }

  // --- Master Payouts ---

  createMasterPayout(data: CreatePayoutRequest, idempotencyKey: string): PayoutRecord {
    if (!idempotencyKey) {
      throw new Error('X-Idempotency-Key header is strictly required for /payouts');
    }

    if (this.idempotencyRecords.has(idempotencyKey)) {
      return this.idempotencyRecords.get(idempotencyKey);
    }

    const id = `pay_${crypto.randomBytes(6).toString('hex')}`;
    const ref = data.reference || `ref_pay_${Date.now()}`;
    const amountKobo = toKobo(data.amount);
    const amountStr = fromKobo(amountKobo);
    const feeStr = '50.00';
    const createdAt = new Date().toISOString();
    const sessionId = `100004${Date.now()}${data.accountNumber.slice(-4)}`;

    const record: PayoutRecord = {
      id,
      reference: ref,
      status: 'processing',
      amount: amountStr,
      fee: feeStr,
      amountPayable: amountStr,
      recipient: {
        accountNumber: data.accountNumber,
        accountName: data.accountName,
        bankCode: data.bankCode,
        bankName: MOCK_BANKS.find((b) => b.code === data.bankCode)?.name || 'Commercial Bank',
      },
      narration: data.narration || 'Payout settlement',
      createdAt,
      updatedAt: createdAt,
      sessionId,
    };

    this.payouts.set(id, record);
    this.idempotencyRecords.set(idempotencyKey, record);

    if (this.autoCompletePayouts) {
      setTimeout(() => {
        record.status = 'completed';
        record.updatedAt = new Date().toISOString();

        const event: FossaPayWebhookEvent = {
          eventId: `evt_${crypto.randomBytes(6).toString('hex')}`,
          eventType: 'payout.completed',
          timestamp: record.updatedAt,
          data: {
            payoutId: record.id,
            reference: record.reference,
            status: 'completed',
            amount: record.amount,
            fee: record.fee,
            accountNumber: record.recipient.accountNumber,
            bankCode: record.recipient.bankCode,
            accountName: record.recipient.accountName,
            sessionId: record.sessionId,
            completedAt: record.updatedAt,
          },
        };
        this.dispatchWebhook(event).catch(console.error);
      }, this.defaultDelayMs);
    }

    return record;
  }

  getPayout(id: string): PayoutRecord {
    const payout = this.payouts.get(id);
    if (!payout) throw new Error(`Payout with id ${id} not found`);
    return payout;
  }

  // --- KYC Verifications ---

  verifyIdentity(
    method: 'BVN' | 'NIN',
    identityNumber: string,
    idempotencyKey: string
  ): KycVerificationResult {
    if (!idempotencyKey) {
      throw new Error('X-Idempotency-Key header is strictly required for /kyc/verifications');
    }

    if (this.idempotencyRecords.has(idempotencyKey)) {
      return this.idempotencyRecords.get(idempotencyKey);
    }

    const cleanNum = identityNumber.replace(/\D/g, '');
    if (cleanNum.length !== 11) {
      throw new Error(`Invalid ${method}: must be exactly 11 digits (received ${cleanNum.length})`);
    }

    // Explicit test rejection token
    if (cleanNum === '00000000000') {
      const failedResult: KycVerificationResult = {
        id: `kyc_${crypto.randomBytes(6).toString('hex')}`,
        method,
        verified: false,
        identityNumberHash: crypto.createHash('sha256').update(cleanNum).digest('hex'),
        last4Digits: cleanNum.slice(-4),
        fullName: 'UNVERIFIED RECORD',
        verifiedAt: new Date().toISOString(),
      };
      this.kycVerifications.set(failedResult.id, failedResult);
      this.idempotencyRecords.set(idempotencyKey, failedResult);
      return failedResult;
    }

    let fullName = 'OLUWASEUN CHUKWUDI ADENIYI';
    if (cleanNum === '22233344455') {
      fullName = 'TUNDE BALOGUN';
    } else if (cleanNum === '11223344556') {
      fullName = 'CHIDINMA OKONKWO';
    } else if (cleanNum === '99887766554') {
      fullName = 'IBRAHIM MUSA';
    } else {
      let sum = 0;
      for (let i = 0; i < cleanNum.length; i++) {
        sum = (sum * 31 + cleanNum.charCodeAt(i)) >>> 0;
      }
      fullName = `${FIRST_NAMES[sum % FIRST_NAMES.length]} ${LAST_NAMES[(sum >> 3) % LAST_NAMES.length]}`;
    }

    const parts = fullName.split(' ');
    const result: KycVerificationResult = {
      id: `kyc_${crypto.randomBytes(6).toString('hex')}`,
      method,
      verified: true,
      identityNumberHash: crypto.createHash('sha256').update(cleanNum).digest('hex'),
      last4Digits: cleanNum.slice(-4),
      fullName,
      firstName: parts[0],
      lastName: parts[parts.length - 1],
      dateOfBirth: '1992-08-14',
      phone: '080' + cleanNum.slice(-8),
      verifiedAt: new Date().toISOString(),
    };

    this.kycVerifications.set(result.id, result);
    this.idempotencyRecords.set(idempotencyKey, result);
    return result;
  }
}

// Global singleton ledger so mock state persists across hot-reloads and route invocations in-process
const globalForLedger = globalThis as unknown as { __fossapayMockLedger?: MockFossaPayLedger };
export const defaultMockLedger = globalForLedger.__fossapayMockLedger || new MockFossaPayLedger();
if (process.env.NODE_ENV !== 'production') {
  globalForLedger.__fossapayMockLedger = defaultMockLedger;
}
