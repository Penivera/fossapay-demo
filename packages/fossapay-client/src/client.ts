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

export interface FossaPayConfig {
  apiKey?: string;
  baseUrl?: string;
  fetchFn?: typeof fetch;
  mode?: 'mock' | 'live';
  mockLedger?: MockFossaPayLedger;
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

export class FossaPayClient {
  readonly mode: 'mock' | 'live';
  private readonly apiKey?: string;
  private readonly baseUrl: string;
  private readonly fetch: typeof fetch;
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
    this.mockLedger = config.mockLedger || defaultMockLedger;
  }

  private async request<T>(
    path: string,
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
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
        if (val !== undefined && val !== null) {
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
      'Content-Type': 'application/json',
    };

    if (idempotencyKey) {
      headers['X-Idempotency-Key'] = idempotencyKey;
    }

    const response = await this.fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    let json: FossaPayResponse<T>;
    try {
      json = (await response.json()) as FossaPayResponse<T>;
    } catch {
      throw new FossaPayError(
        `Failed to parse FossaPay response: HTTP ${response.status}`,
        response.status
      );
    }

    if (!response.ok || json.status === 'error') {
      throw new FossaPayError(
        json.message || `FossaPay request failed with status ${response.status}`,
        response.status || json.statusCode,
        json
      );
    }

    return json.data;
  }

  // --- Customers Module ---
  readonly customers = {
    create: async (data: CreateCustomerRequest): Promise<CustomerRecord> => {
      if (this.mode === 'mock') {
        return this.mockLedger.createCustomer(data);
      }
      return this.request<CustomerRecord>('/customers', {
        method: 'POST',
        body: data,
      });
    },

    getById: async (id: string): Promise<CustomerRecord> => {
      if (this.mode === 'mock') {
        return this.mockLedger.getCustomer(id);
      }
      return this.request<CustomerRecord>(`/customers/${encodeURIComponent(id)}`);
    },

    list: async (params?: { limit?: number; startingAfter?: string }): Promise<CustomerRecord[]> => {
      if (this.mode === 'mock') {
        return this.mockLedger.listCustomers();
      }
      return this.request<CustomerRecord[]>('/customers', {
        method: 'GET',
        query: params,
      });
    },
  };

  // --- Wallets Module ---
  readonly wallets = {
    createFiatWallet: async (data: CreateFiatWalletRequest): Promise<FiatWalletRecord> => {
      if (this.mode === 'mock') {
        return this.mockLedger.createFiatWallet(data);
      }
      return this.request<FiatWalletRecord>('/wallets/fiat/create', {
        method: 'POST',
        body: data,
      });
    },

    getFiatWallet: async (id: string): Promise<FiatWalletRecord> => {
      if (this.mode === 'mock') {
        return this.mockLedger.getFiatWallet(id);
      }
      return this.request<FiatWalletRecord>(`/wallets/fiat/${encodeURIComponent(id)}`);
    },

    createCryptoWallet: async (data: CreateCryptoWalletRequest): Promise<CryptoWalletRecord> => {
      if (this.mode === 'mock') {
        return this.mockLedger.createCryptoWallet(data);
      }
      return this.request<CryptoWalletRecord>('/wallets/crypto/create', {
        method: 'POST',
        body: data,
      });
    },

    getCryptoBalance: async (walletId: string, symbol?: string): Promise<string> => {
      if (this.mode === 'mock') {
        return this.mockLedger.getCryptoBalance(walletId, symbol);
      }
      const res = await this.request<{ balance: string }>(`/wallets/crypto/${encodeURIComponent(walletId)}/balance`, {
        query: symbol ? { symbol } : undefined,
      });
      return res.balance;
    },

    getMasterCryptoWallet: async (): Promise<MasterCryptoWallet[]> => {
      if (this.mode === 'mock') {
        return this.mockLedger.getMasterCryptoWallets();
      }
      return this.request<MasterCryptoWallet[]>('/wallets/crypto/master');
    },

    transferFiat: async (data: TransferFiatRequest): Promise<TransferFiatRecord> => {
      if (this.mode === 'mock') {
        return this.mockLedger.transferFiat(data);
      }
      return this.request<TransferFiatRecord>('/wallets/fiat/transfer', {
        method: 'POST',
        body: data,
      });
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
      return this.request<CheckoutRecord>('/checkouts', {
        method: 'POST',
        body: data,
        idempotencyKey,
      });
    },

    getCheckout: async (id: string): Promise<CheckoutRecord> => {
      if (this.mode === 'mock') {
        return this.mockLedger.getCheckout(id);
      }
      return this.request<CheckoutRecord>(`/checkouts/${encodeURIComponent(id)}`);
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
      return this.request<PayoutRecord>('/payouts', {
        method: 'POST',
        body: data,
        idempotencyKey,
      });
    },

    getPayout: async (id: string): Promise<PayoutRecord> => {
      if (this.mode === 'mock') {
        return this.mockLedger.getPayout(id);
      }
      return this.request<PayoutRecord>(`/payouts/${encodeURIComponent(id)}`);
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
      return this.request<PayoutRecord>(`/payouts/reference/${encodeURIComponent(reference)}`);
    },
  };

  // --- Transfers & Banking Module ---
  readonly transfers = {
    getSupportedBanks: async (): Promise<SupportedBank[]> => {
      if (this.mode === 'mock') {
        return this.mockLedger.getSupportedBanks();
      }
      return this.request<SupportedBank[]>('/transfers/banks');
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
      return this.request<BankEnquiryResult>('/transfers/bank-enquiry', {
        method: 'POST',
        body: { accountNumber, bankCode },
      });
    },

    calculateFiatFee: async (amount: number | string): Promise<CalculateFeeResult> => {
      if (this.mode === 'mock') {
        return this.mockLedger.calculateFiatFee(amount);
      }
      return this.request<CalculateFeeResult>('/transfers/fiat/calculate-fee', {
        method: 'GET',
        query: { amount },
      });
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
      return this.request<KycVerificationResult>('/kyc/verifications', {
        method: 'POST',
        body: { method, identityNumber },
        idempotencyKey,
      });
    },
  };
}
