import type {
  FossaPayResponse,
  SupportedBank,
  BankEnquiryRequest,
  BankEnquiryResult,
  CalculateFeeResult,
  CreatePayoutRequest,
  PayoutRecord,
  MasterCryptoWallet,
} from './types.js';

export interface FossaPayConfig {
  apiKey: string;
  baseUrl?: string;
  fetchFn?: typeof fetch;
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
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetch: typeof fetch;

  constructor(config: FossaPayConfig) {
    if (!config.apiKey) {
      throw new Error('FossaPay apiKey is required.');
    }
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl || 'https://api-production.fossapay.com/api/v1').replace(/\/+$/, '');
    this.fetch = config.fetchFn || globalThis.fetch;
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
      'x-api-key': this.apiKey,
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

  // Transfers & Banking Module
  readonly transfers = {
    getBanks: async (): Promise<SupportedBank[]> => {
      return this.request<SupportedBank[]>('/transfers/banks');
    },

    bankEnquiry: async (params: BankEnquiryRequest): Promise<BankEnquiryResult> => {
      return this.request<BankEnquiryResult>('/transfers/bank-enquiry', {
        method: 'POST',
        body: params,
      });
    },

    calculateFee: async (amount: number | string): Promise<CalculateFeeResult> => {
      return this.request<CalculateFeeResult>('/transfers/fiat/calculate-fee', {
        method: 'GET',
        query: { amount },
      });
    },
  };

  // Master Payouts Module
  readonly payouts = {
    createMasterPayout: async (
      data: CreatePayoutRequest,
      idempotencyKey: string
    ): Promise<PayoutRecord> => {
      if (!idempotencyKey) {
        throw new Error('idempotencyKey is required for createMasterPayout');
      }
      return this.request<PayoutRecord>('/payouts', {
        method: 'POST',
        body: data,
        idempotencyKey,
      });
    },

    getPayoutById: async (payoutId: string): Promise<PayoutRecord> => {
      return this.request<PayoutRecord>(`/payouts/${encodeURIComponent(payoutId)}`);
    },

    getPayoutByReference: async (reference: string): Promise<PayoutRecord> => {
      return this.request<PayoutRecord>(`/payouts/reference/${encodeURIComponent(reference)}`);
    },
  };

  // Wallets Module
  readonly wallets = {
    getMasterCryptoWallet: async (): Promise<MasterCryptoWallet[]> => {
      return this.request<MasterCryptoWallet[]>('/wallets/crypto/master');
    },

    getMasterNgnWallet: async (): Promise<{ id: string; balance: string; accountNumber: string; bankName: string }> => {
      return this.request<{ id: string; balance: string; accountNumber: string; bankName: string }>('/wallets/fiat/master');
    },
  };
}
