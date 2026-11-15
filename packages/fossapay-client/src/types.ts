/**
 * FossaPay Standard API Types
 */

export interface FossaPayResponse<T> {
  status: 'success' | 'error';
  statusCode: number;
  message: string;
  data: T;
}

export interface SupportedBank {
  name: string;
  code: string;
  slug?: string;
  active?: boolean;
}

export interface BankEnquiryRequest {
  accountNumber: string;
  bankCode: string;
}

export interface BankEnquiryResult {
  accountName: string;
  accountNumber: string;
  bankCode: string;
  bankName?: string;
}

export interface CalculateFeeResult {
  amount: number | string;
  fee: number | string;
  feeBearer?: 'merchant' | 'customer';
  currency?: string;
}

export interface CreatePayoutRequest {
  accountNumber: string;
  bankCode: string;
  accountName: string;
  amount: number | string;
  narration?: string;
  reference?: string;
}

export interface PayoutRecord {
  id: string;
  reference: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'reversed';
  amount: string;
  fee: string;
  amountPayable?: string;
  recipient: {
    accountNumber: string;
    accountName: string;
    bankCode: string;
    bankName?: string;
  };
  narration?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface MasterCryptoWalletToken {
  symbol: string;
  balance: string;
  decimals: number;
}

export interface MasterCryptoWallet {
  id: string;
  network: 'solana' | 'stellar';
  address: string;
  tokens: MasterCryptoWalletToken[];
  status?: string;
}

export interface WebhookEnvelope<T = Record<string, unknown>> {
  eventId: string;
  eventType: string;
  data: T;
  timestamp: string;
}

export interface PayoutWebhookData {
  payoutId: string;
  reference: string;
  status: 'completed' | 'failed' | 'reversed';
  amount: string;
  fee: string;
  accountNumber: string;
  bankCode: string;
  accountName: string;
  narration?: string;
}

export interface CheckoutWebhookData {
  checkoutId: string;
  transactionId?: string;
  reference: string;
  status: 'completed' | 'failed' | 'expired' | 'reversed';
  amount: string;
  fee: string;
  amountPayable: string;
  feeBearer: 'customer' | 'merchant';
  currency: string;
  sender?: {
    accountName?: string;
    accountNumber?: string;
    bankCode?: string;
    bankName?: string;
  };
}
