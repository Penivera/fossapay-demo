import type {
  FossaPayResponse,
  SupportedBank,
  BankEnquiryResult,
  CalculateFeeResult,
  CreateCustomerRequest,
  CustomerRecord,
  CreateFiatWalletRequest,
  FiatWalletRecord,
  CreateCryptoWalletRequest,
  CryptoWalletRecord,
  MasterCryptoWallet,
  TransferFiatRequest,
  TransferFiatRecord,
  CreateCheckoutRequest,
  CheckoutRecord,
  CreatePayoutRequest,
  PayoutRecord,
  KycVerificationResult,
} from './types.js';
import { MockFossaPayLedger, defaultMockLedger } from './mock.js';
import crypto from 'node:crypto';
import BigNumber from 'bignumber.js';

export interface FossaPayConfig {
  apiKey?: string;
  baseUrl?: string;
  fetchFn?: typeof fetch;
  mode?: 'mock' | 'live';
  mockLedger?: MockFossaPayLedger;
  /** Per-request timeout for live calls (default 30s). */
  timeoutMs?: number;
}

export class FossaPayError extends Error {
  statusCode: number;
  responseBody?: unknown;

  constructor(message: string, statusCode: number, responseBody?: unknown) {
    super(message);
    this.name = 'FossaPayError';
    this.statusCode = statusCode;
    this.responseBody = responseBody;
  }
}

const REFERENCE_PATTERN = /^[A-Za-z0-9._:-]{1,100}$/;
const CRYPTO_DECIMALS: Record<string, number> = { sol: 9, usdc: 6, usdt: 6, xlm: 7 };

/** Live API takes whole-naira integers. Never round silently: that would move the wrong amount of money. */
function toWholeNaira(amount: string | number, field: string): number {
  const bn = new BigNumber(amount);
  if (bn.isNaN() || !bn.isFinite() || bn.isLessThan(1)) {
    throw new FossaPayError(`${field} must be a positive amount of at least NGN 1 (got ${amount})`, 400);
  }
  if (!bn.isInteger()) {
    throw new FossaPayError(
      `${field} must be a whole number of naira for the live FossaPay API (got ${amount}); fractional kobo amounts are rejected`,
      400
    );
  }
  return bn.toNumber();
}

function toReference(explicit: string | undefined, fallbackSeed: string, prefix: string): string {
  const ref = explicit || `${prefix}_${fallbackSeed}`;
  const cleaned = ref.replace(/[^A-Za-z0-9._:-]/g, '_').slice(0, 100);
  if (!REFERENCE_PATTERN.test(cleaned)) {
    throw new FossaPayError(`Invalid reference "${ref}"`, 400);
  }
  return cleaned;
}

function nameParts(...parts: Array<string | null | undefined>): string {
  return parts.filter((p): p is string => !!p && p.trim() !== '').join(' ');
}

export class FossaPayClient {
  readonly mode: 'mock' | 'live';
  private readonly apiKey?: string;
  private readonly baseUrl: string;
  private readonly fetch: typeof fetch;
  private readonly timeoutMs: number;
  private bankNameCache?: Map<string, string>;
  readonly mockLedger: MockFossaPayLedger;

  constructor(config: FossaPayConfig = {}) {
    const envMode = process.env.FOSSAPAY_MODE;
    this.mode = config.mode || (envMode === 'live' ? 'live' : 'mock');

    if (this.mode === 'live' && !config.apiKey && !process.env.FOSSAPAY_API_KEY) {
      throw new Error('FossaPay apiKey is strictly required in live mode.');
    }

    this.apiKey = config.apiKey || process.env.FOSSAPAY_API_KEY || 'mock_api_key';
    this.baseUrl = (config.baseUrl || process.env.FOSSAPAY_BASE_URL || 'https://api-production.fossapay.com/api/v1').replace(/\/+$/, '');
    this.fetch = config.fetchFn || globalThis.fetch;
    this.timeoutMs = config.timeoutMs ?? 30_000;
    this.mockLedger = config.mockLedger || defaultMockLedger;
  }

  private async request<T>(
    path: string,
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
      body?: unknown;
      idempotencyKey?: string;
      query?: Record<string, string | number | undefined>;
    } = {}
  ): Promise<T> {
    const { method = 'GET', body, idempotencyKey, query } = options;

    let url = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    if (query) {
      const searchParams = new URLSearchParams();
      for (const [key, val] of Object.entries(query)) {
        if (val !== undefined && val !== null && val !== '') {
          searchParams.append(key, String(val));
        }
      }
      const qStr = searchParams.toString();
      if (qStr) {
        url += (url.includes('?') ? '&' : '?') + qStr;
      }
    }

    const headers: Record<string, string> = {
      'x-api-key': this.apiKey || '',
    };
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }
    if (idempotencyKey) {
      headers['X-Idempotency-Key'] = idempotencyKey;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let response: Response;
    try {
      response = await this.fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch (err) {
      const aborted = err instanceof Error && err.name === 'AbortError';
      throw new FossaPayError(
        aborted ? 'FossaPay API request timed out' : 'Unable to connect to the FossaPay API',
        aborted ? 408 : 503
      );
    } finally {
      clearTimeout(timer);
    }

    let json: any;
    try {
      json = await response.json();
    } catch {
      throw new FossaPayError(
        `Failed to parse FossaPay response: HTTP ${response.status}`,
        response.status
      );
    }

    const failed = !response.ok || json?.status === 'error' || json?.success === false || json?.status === false;
    if (failed) {
      throw new FossaPayError(
        json?.message || `FossaPay request failed with status ${response.status}`,
        response.status || json?.statusCode || 500,
        json
      );
    }

    // Most endpoints wrap the payload as { status, statusCode, message, data }.
    // A few (e.g. POST /kyc/verifications) return the payload bare, so only unwrap real envelopes.
    const isEnvelope =
      json &&
      typeof json === 'object' &&
      'data' in json &&
      ('message' in json || 'success' in json || 'statusCode' in json || 'status' in json);
    return (isEnvelope ? json.data : json) as T;
  }

  private async lookupBankName(bankCode: string): Promise<string> {
    if (!this.bankNameCache) {
      const banks = await this.transfers.getSupportedBanks();
      this.bankNameCache = new Map(banks.map((b) => [b.code, b.name]));
    }
    const name = this.bankNameCache.get(bankCode);
    if (!name) {
      throw new FossaPayError(`Unsupported bankCode "${bankCode}"`, 400);
    }
    return name;
  }

  // --- Live response mappers (FossaPay API shape -> this client's stable shape) ---

  private mapCustomer(c: any): CustomerRecord {
    return {
      id: c.id,
      email: c.emailAddress,
      phoneNumber: c.mobileNumber,
      firstName: c.firstName,
      lastName: c.lastName,
      createdAt: c.createdAt,
      metadata: c.metadata,
    };
  }

  private mapCheckout(c: any): CheckoutRecord {
    return {
      ...c,
      accountNumber: c.account?.accountNumber ?? c.accountNumber,
      bankName: c.account?.bankName ?? c.bankName,
      accountName: c.account?.accountName ?? c.accountName,
    };
  }

  private mapPayout(p: any): PayoutRecord {
    return {
      ...p,
      id: p.payoutId ?? p.id,
      sessionId: p.providerReference ?? p.sessionId ?? undefined,
      createdAt: p.createdAt ?? p.completedAt ?? p.failedAt ?? new Date().toISOString(),
    };
  }

  private mapCryptoTokens(tokens: any): MasterCryptoWallet['tokens'] {
    if (Array.isArray(tokens)) return tokens;
    return Object.entries(tokens || {}).map(([symbol, t]: [string, any]) => ({
      symbol: symbol.toUpperCase(),
      balance: String(t?.amount ?? '0'),
      decimals: CRYPTO_DECIMALS[symbol.toLowerCase()] ?? 0,
    }));
  }

  // --- Customers Module ---
  readonly customers = {
    create: async (data: CreateCustomerRequest, idempotencyKey?: string): Promise<CustomerRecord> => {
      if (this.mode === 'mock') {
        return this.mockLedger.createCustomer(data);
      }
      const payload = {
        firstName: data.firstName,
        middleName: data.middleName,
        lastName: data.lastName,
        emailAddress: data.email,
        mobileNumber: data.phoneNumber,
        dateOfBirth: data.dateOfBirth,
        address: data.address,
        city: data.city,
        country: data.country,
        type: 'individual',
        metadata: data.metadata,
      };
      const missing = (
        ['firstName', 'lastName', 'emailAddress', 'mobileNumber', 'dateOfBirth', 'address', 'city', 'country'] as const
      ).filter((k) => !payload[k]);
      if (missing.length) {
        throw new FossaPayError(
          `Live FossaPay customers require: ${missing.join(', ')}. Collect these from the user; do not fabricate identity data.`,
          400
        );
      }
      const res = await this.request<any>('/customers', {
        method: 'POST',
        body: payload,
        idempotencyKey,
      });
      return this.mapCustomer(res);
    },

    getById: async (id: string): Promise<CustomerRecord> => {
      if (this.mode === 'mock') {
        return this.mockLedger.getCustomer(id);
      }
      return this.mapCustomer(await this.request<any>(`/customers/${encodeURIComponent(id)}`));
    },

    list: async (params?: { limit?: number; page?: number }): Promise<CustomerRecord[]> => {
      if (this.mode === 'mock') {
        return this.mockLedger.listCustomers();
      }
      const res = await this.request<any>('/customers', {
        method: 'GET',
        query: params,
      });
      const items: any[] = Array.isArray(res)
        ? res
        : Array.isArray((res as any)?.result)
        ? (res as any).result
        : Array.isArray((res as any)?.items)
        ? (res as any).items
        : [];
      return items.map((c: any) => this.mapCustomer(c));
    },
  };

  // --- Wallets Module ---
  readonly wallets = {
    createFiatWallet: async (data: CreateFiatWalletRequest, idempotencyKey?: string): Promise<FiatWalletRecord> => {
      if (this.mode === 'mock') {
        return this.mockLedger.createFiatWallet(data);
      }
      if (!data.customerId) {
        throw new FossaPayError('customerId is required to create a live NGN wallet', 400);
      }
      try {
        const res = await this.request<any>('/wallets/fiat/create', {
          method: 'POST',
          body: {
            customerId: data.customerId,
            walletName: data.walletName || `Wallet ${data.customerId}`,
            walletReference: toReference(data.walletReference, data.customerId, 'wallet'),
          },
          idempotencyKey,
        });
        return {
          id: res.walletId ?? res.id,
          customerId: data.customerId,
          accountNumber: res.accountNumber,
          accountName: res.accountName,
          bankName: res.bankName,
          bankCode: res.bankCode,
          currency: 'NGN',
          balance: '0.00',
          createdAt: new Date().toISOString(),
        };
      } catch (err: any) {
        if (err.message && (err.message.toLowerCase().includes('already found') || err.message.toLowerCase().includes('already exists'))) {
          return await this.wallets.getFiatWallet(data.customerId);
        }
        throw err;
      }
    },

    getFiatWallet: async (id: string): Promise<FiatWalletRecord> => {
      if (this.mode === 'mock') {
        return this.mockLedger.getFiatWallet(id);
      }
      try {
        const res = await this.request<any>(`/wallets/fiat/${encodeURIComponent(id)}`);
        return {
          id: res.id ?? res.walletId ?? id,
          customerId: res.customerId,
          accountNumber: res.virtualAccount?.accountNumber ?? res.accountNumber,
          accountName: res.walletName ?? res.accountName,
          bankName: res.virtualAccount?.bankName ?? res.bankName,
          bankCode: res.virtualAccount?.bankCode ?? res.bankCode,
          currency: 'NGN',
          balance: String(res.availableBalance ?? res.balance ?? '0.00'),
          createdAt: res.createdAt ?? new Date().toISOString(),
        };
      } catch (err: any) {
        if (err.statusCode === 404) {
          const rawWallets = await this.request<any>('/wallets/fiat');
          const allWallets: any[] = Array.isArray(rawWallets)
            ? rawWallets
            : Array.isArray(rawWallets?.data)
            ? rawWallets.data
            : Array.isArray(rawWallets?.result)
            ? rawWallets.result
            : [];
          const found = allWallets.find(
            (w: any) =>
              w.accountNumber === id ||
              (w.accountName && w.accountName.includes(id)) ||
              w.id === id ||
              w.walletId === id
          );
          if (found) {
              return {
                id: found.walletId ?? found.id ?? found.accountNumber,
                customerId: found.accountName?.replace(/^Wallet\s+/i, '') ?? '',
                accountNumber: found.accountNumber,
                accountName: found.accountName,
                bankName: found.bankName,
                bankCode: found.bankCode ?? '000',
                currency: 'NGN',
                balance: String(found.availableBalance ?? found.balance ?? '0.00'),
                createdAt: new Date().toISOString(),
              };
            }
        }
        throw err;
      }
    },

    createCryptoWallet: async (data: CreateCryptoWalletRequest, idempotencyKey?: string): Promise<CryptoWalletRecord> => {
      if (this.mode === 'mock') {
        return this.mockLedger.createCryptoWallet(data);
      }
      const res = await this.request<any>('/wallets/crypto/create', {
        method: 'POST',
        body: data,
        idempotencyKey,
      });
      return {
        id: res.walletId ?? res.id,
        network: res.network ?? data.network,
        address: res.address,
        tokens: [],
      };
    },

    getCryptoBalance: async (walletId: string, symbol?: string): Promise<string> => {
      if (this.mode === 'mock') {
        return this.mockLedger.getCryptoBalance(walletId, symbol);
      }
      const res = await this.request<any>(`/wallets/crypto/${encodeURIComponent(walletId)}`);
      const wallet = Array.isArray(res) ? res[0] : res;
      const tokens = this.mapCryptoTokens(wallet?.tokens);
      const wanted = (symbol || '').toUpperCase();
      const match = wanted ? tokens.find((t) => t.symbol.toUpperCase() === wanted) : tokens[0];
      return match?.balance ?? '0';
    },

    getMasterCryptoWallet: async (): Promise<MasterCryptoWallet[]> => {
      if (this.mode === 'mock') {
        return this.mockLedger.getMasterCryptoWallets();
      }
      const res = await this.request<any[]>('/wallets/crypto/master');
      return res.map((w) => ({ ...w, tokens: this.mapCryptoTokens(w.tokens) }));
    },

    /** Free wallet-to-wallet transfer between two customers of the same business. */
    transferFiat: async (data: TransferFiatRequest): Promise<TransferFiatRecord> => {
      if (this.mode === 'mock') {
        return this.mockLedger.transferFiat(data);
      }
      // The live API addresses wallets by account number, not wallet id.
      const [from, to] = await Promise.all([
        this.wallets.getFiatWallet(data.sourceWalletId),
        this.wallets.getFiatWallet(data.destinationWalletId),
      ]);
      const reference = toReference(
        data.reference,
        `${data.sourceWalletId}_${data.destinationWalletId}_${crypto.randomUUID()}`,
        'xfer'
      );
      const amount = new BigNumber(data.amount);
      if (amount.isNaN() || !amount.isGreaterThan(0)) {
        throw new FossaPayError(`Invalid transfer amount: ${data.amount}`, 400);
      }
      await this.request<unknown>('/wallets/fiat/transfers/wallet-to-wallet', {
        method: 'POST',
        body: {
          fromAccount: from.accountNumber,
          toAccount: to.accountNumber,
          amount: amount.toNumber(),
          reference,
          narration: (data.narration || 'Wallet transfer').slice(0, 255),
        },
      });
      return {
        id: reference,
        sourceWalletId: data.sourceWalletId,
        destinationWalletId: data.destinationWalletId,
        amount: amount.toFixed(2),
        fee: '0.00',
        status: 'completed',
        reference,
        createdAt: new Date().toISOString(),
      };
    },
  };

  // --- Checkouts Module ---
  readonly checkouts = {
    createCheckout: async (
      data: CreateCheckoutRequest,
      idempotencyKey: string
    ): Promise<CheckoutRecord> => {
      if (!idempotencyKey) {
        throw new Error('idempotencyKey is required for createCheckout');
      }
      if (this.mode === 'mock') {
        return this.mockLedger.createCheckout(data, idempotencyKey);
      }
      // POST /checkouts has additionalProperties:false, so only documented fields may be sent.
      const metadata = { ...(data.metadata || {}), ...(data.description ? { description: data.description } : {}) };
      const payload: Record<string, unknown> = {
        amount: toWholeNaira(data.amount, 'amount'),
        currency: (data.currency || 'NGN').toUpperCase(),
        reference: toReference(data.reference, idempotencyKey, 'chk'),
        feeBearer: data.feeBearer === 'merchant' ? 'merchant' : 'customer', // 'buyer' (legacy alias) -> 'customer'
      };
      if (data.customer) payload.customer = data.customer;
      if (Object.keys(metadata).length) payload.metadata = metadata;
      if (data.splitCode) payload.splitCode = data.splitCode;

      const res = await this.request<any>('/checkouts', {
        method: 'POST',
        body: payload,
        idempotencyKey,
      });
      return this.mapCheckout(res);
    },

    getCheckout: async (id: string): Promise<CheckoutRecord> => {
      if (this.mode === 'mock') {
        return this.mockLedger.getCheckout(id);
      }
      return this.mapCheckout(await this.request<any>(`/checkouts/${encodeURIComponent(id)}`));
    },

    /** Reconcile by your merchant reference (live only). */
    getCheckoutByReference: async (reference: string): Promise<CheckoutRecord> => {
      if (this.mode === 'mock') {
        for (const c of this.mockLedger.checkouts.values()) {
          if (c.reference === reference) return c;
        }
        throw new Error(`Checkout with reference ${reference} not found`);
      }
      return this.mapCheckout(await this.request<any>(`/checkouts/reference/${encodeURIComponent(reference)}`));
    },

    /** Expire a pending checkout early. Only `pending` checkouts can be expired (else 409). */
    expireCheckout: async (id: string): Promise<CheckoutRecord> => {
      if (this.mode === 'mock') {
        return this.mockLedger.simulateCheckoutExpiry(id);
      }
      return this.mapCheckout(await this.request<any>(`/checkouts/${encodeURIComponent(id)}/expire`, { method: 'POST' }));
    },
  };

  // --- Payouts Module ---
  readonly payouts = {
    createMasterPayout: async (
      data: CreatePayoutRequest,
      idempotencyKey: string
    ): Promise<PayoutRecord> => {
      if (!idempotencyKey) {
        throw new Error('idempotencyKey is required for createMasterPayout');
      }
      if (this.mode === 'mock') {
        return this.mockLedger.createMasterPayout(data, idempotencyKey);
      }
      if (!/^\d{10}$/.test(data.accountNumber)) {
        throw new FossaPayError('accountNumber must contain exactly 10 digits', 400);
      }
      const payload: Record<string, unknown> = {
        amount: toWholeNaira(data.amount, 'amount'),
        currency: 'NGN',
        reference: toReference(data.reference, idempotencyKey, 'payout'),
        destinationBankCode: data.bankCode,
        destinationBankName: data.bankName || (await this.lookupBankName(data.bankCode)),
        destinationAccountName: data.accountName,
        destinationAccountNumber: data.accountNumber,
      };
      if (data.narration) payload.remarks = data.narration.slice(0, 255);
      if (data.metadata) payload.metadata = data.metadata;

      const res = await this.request<any>('/payouts', {
        method: 'POST',
        body: payload,
        idempotencyKey,
      });
      return this.mapPayout(res);
    },

    getPayout: async (id: string): Promise<PayoutRecord> => {
      if (this.mode === 'mock') {
        return this.mockLedger.getPayout(id);
      }
      return this.mapPayout(await this.request<any>(`/payouts/${encodeURIComponent(id)}`));
    },

    getPayoutById: async (id: string): Promise<PayoutRecord> => {
      return this.payouts.getPayout(id);
    },

    getPayoutByReference: async (reference: string): Promise<PayoutRecord> => {
      if (this.mode === 'mock') {
        for (const p of this.mockLedger.payouts.values()) {
          if (p.reference === reference) return p;
        }
        throw new Error(`Payout with reference ${reference} not found`);
      }
      return this.mapPayout(await this.request<any>(`/payouts/reference/${encodeURIComponent(reference)}`));
    },
  };

  // --- Transfers & Banking Module ---
  readonly transfers = {
    getSupportedBanks: async (): Promise<SupportedBank[]> => {
      if (this.mode === 'mock') {
        return this.mockLedger.getSupportedBanks();
      }
      const res = await this.request<Array<{ bankname: string; bankcode: string }>>('/transfers/fiat/banks');
      // The live directory repeats some codes (e.g. 100042); a code must identify exactly one bank
      const seen = new Set<string>();
      const banks: SupportedBank[] = [];
      for (const b of res) {
        if (seen.has(b.bankcode)) continue;
        seen.add(b.bankcode);
        banks.push({ name: b.bankname, code: b.bankcode });
      }
      return banks.sort((a, b) => a.name.localeCompare(b.name));
    },

    getBanks: async (): Promise<SupportedBank[]> => {
      return this.transfers.getSupportedBanks();
    },

    bankEnquiry: async (
      accountOrParams: string | { accountNumber: string; bankCode: string },
      maybeBankCode?: string
    ): Promise<BankEnquiryResult> => {
      const accountNumber = typeof accountOrParams === 'string' ? accountOrParams : accountOrParams.accountNumber;
      const bankCode = typeof accountOrParams === 'string' ? (maybeBankCode || '') : accountOrParams.bankCode;

      if (!accountNumber || !bankCode) {
        throw new Error('accountNumber and bankCode are required for bankEnquiry');
      }

      if (this.mode === 'mock') {
        return this.mockLedger.bankEnquiry(accountNumber, bankCode);
      }
      if (!/^\d{10}$/.test(accountNumber)) {
        throw new FossaPayError('accountNumber must contain exactly 10 digits', 400);
      }
      // Map CBN institution code 999992 (OPay) to live NIBSS code 100004 expected by FossaPay
      const liveBankCode = bankCode === '999992' ? '100004' : bankCode;
      const res = await this.request<any>('/transfers/fiat/bank-name-enquiry', {
        method: 'POST',
        body: { accountNumber, bankCode: liveBankCode },
      });
      return {
        accountName: res.accountName,
        accountNumber: res.accountNumber ?? accountNumber,
        bankCode: res.destinationInstitutionCode ?? bankCode,
        sessionId: res.sessionID,
      };
    },

    calculateFiatFee: async (amount: number | string): Promise<CalculateFeeResult> => {
      if (this.mode === 'mock') {
        return this.mockLedger.calculateFiatFee(amount);
      }
      const res = await this.request<{ amount: number; currency: string; feeAmount: number; total: number }>(
        '/transfers/fiat/calculate-fee',
        { method: 'GET', query: { amount } }
      );
      return {
        amount: new BigNumber(res.amount).toFixed(2),
        fee: new BigNumber(res.feeAmount).toFixed(2),
        feeBearer: 'merchant',
        currency: res.currency,
      };
    },
  };

  // --- KYC Module ---
  readonly kyc = {
    verifyIdentity: async (
      method: 'BVN' | 'NIN',
      identityNumber: string,
      idempotencyKey: string
    ): Promise<KycVerificationResult> => {
      if (!idempotencyKey) {
        throw new Error('idempotencyKey is required for verifyIdentity');
      }
      if (this.mode === 'mock') {
        return this.mockLedger.verifyIdentity(method, identityNumber, idempotencyKey);
      }
      if (!/^\d{11}$/.test(identityNumber)) {
        throw new FossaPayError('identityNumber must be an 11-digit string', 400);
      }
      // Charged per attempt (NIN NGN 120 / BVN NGN 70). Response is NOT wrapped in the usual envelope.
      const res = await this.request<any>('/kyc/verifications', {
        method: 'POST',
        body: { method, identityNumber },
        idempotencyKey,
      });
      const person = res.person;
      return {
        id: res.reference,
        method: res.method ?? method,
        verified: !!person,
        // Never retain the plaintext identity number: keep only a hash and the last 4 digits.
        identityNumberHash: crypto.createHash('sha256').update(identityNumber).digest('hex'),
        last4Digits: identityNumber.slice(-4),
        fullName: person ? nameParts(person.firstName, person.middleName, person.lastName) : '',
        firstName: person?.firstName ?? undefined,
        lastName: person?.lastName ?? undefined,
        dateOfBirth: person?.dateOfBirth ?? undefined,
        phone: person?.phoneNumber ?? undefined,
        verifiedAt: new Date().toISOString(),
      };
    },
  };
}
