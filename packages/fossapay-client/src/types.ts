/**
 * FossaPay Standard API Type Definitions
 * Adheres strictly to ARCHITECTURE.md and product specifications.
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
  sessionId?: string; // UNVERIFIED
}

export interface CalculateFeeResult {
  amount: string;
  fee: string;
  feeBearer: 'customer' | 'merchant' | 'buyer';
  currency: string;
}

export interface CreateCustomerRequest {
  email?: string;
  phoneNumber?: string;
  firstName?: string;
  lastName?: string;
  metadata?: Record<string, unknown>; // UNVERIFIED
}

export interface CustomerRecord {
  id: string;
  email?: string;
  phoneNumber?: string;
  firstName?: string;
  lastName?: string;
  createdAt: string;
  metadata?: Record<string, unknown>; // UNVERIFIED
}

export interface CreateFiatWalletRequest {
  customerId?: string;
  currency?: string;
  accountType?: 'permanent' | 'dedicated'; // UNVERIFIED
}

export interface FiatWalletRecord {
  id: string;
  customerId?: string;
  accountNumber: string;
  accountName: string;
  bankName: string;
  bankCode: string;
  currency: string;
  balance: string;
  createdAt: string;
}

export interface CreateCryptoWalletRequest {
  network: 'solana' | 'stellar';
  customerId?: string; // UNVERIFIED
}

export interface CryptoWalletRecord {
  id: string;
  network: 'solana' | 'stellar';
  address: string;
  tokens: Array<{
    symbol: string;
    balance: string;
    decimals: number;
  }>;
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

export interface TransferFiatRequest {
  sourceWalletId: string;
  destinationWalletId: string;
  amount: string | number;
  currency?: string;
  narration?: string; // UNVERIFIED
}

export interface TransferFiatRecord {
  id: string;
  sourceWalletId: string;
  destinationWalletId: string;
  amount: string;
  fee: string;
  status: 'completed' | 'pending' | 'failed';
  reference: string;
  createdAt: string;
}

export interface CreateCheckoutRequest {
  amount: string | number;
  currency?: string;
  customerId?: string;
  reference?: string;
  feeBearer?: 'customer' | 'merchant' | 'buyer';
  description?: string;
  expiresInMinutes?: number;
  metadata?: Record<string, unknown>; // UNVERIFIED
}

export interface CheckoutRecord {
  id: string;
  reference: string;
  amount: string;
  fee: string;
  amountPayable: string;
  feeBearer: 'customer' | 'merchant' | 'buyer';
  currency: string;
  status: 'pending' | 'completed' | 'expired' | 'failed';
  accountNumber: string;
  bankName: string;
  bankCode: string;
  accountName: string;
  expiresAt: string;
  createdAt: string;
  metadata?: Record<string, unknown>; // UNVERIFIED
}

export interface CreatePayoutRequest {
  accountNumber: string;
  bankCode: string;
  accountName: string;
  amount: string | number;
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
  createdAt: string;
  updatedAt?: string;
  sessionId?: string; // NIBSS session ID
}

export interface KycVerificationRequest {
  method: 'BVN' | 'NIN';
  identityNumber: string;
}

export interface KycVerificationResult {
  id: string;
  method: 'BVN' | 'NIN';
  verified: boolean;
  identityNumberHash: string;
  last4Digits: string;
  fullName: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  phone?: string;
  verifiedAt: string;
}

/**
 * Webhook Payloads
 */

export interface WebhookEnvelope<T = Record<string, unknown>> {
  eventId: string;
  eventType: string;
  data: T;
  timestamp: string;
}

export interface CheckoutCompletedData {
  checkoutId: string;
  reference: string;
  status: 'completed';
  amount: string;
  fee: string;
  amountPayable: string;
  currency: string;
  sender?: {
    accountName?: string;
    accountNumber?: string;
    bankCode?: string;
    bankName?: string;
  };
  paidAt: string;
}

export interface CheckoutExpiredData {
  checkoutId: string;
  reference: string;
  status: 'expired';
  amount: string;
  expiredAt: string;
}

export interface DepositCompletedData {
  depositId: string;
  accountNumber: string;
  accountName?: string;
  bankCode: string;
  amount: string;
  currency: string;
  reference: string;
  sender?: {
    accountName?: string;
    accountNumber?: string;
    bankCode?: string;
  };
  creditedAt: string;
}

export interface PayoutCompletedData {
  payoutId: string;
  reference: string;
  status: 'completed';
  amount: string;
  fee: string;
  accountNumber: string;
  bankCode: string;
  accountName: string;
  sessionId?: string;
  completedAt: string;
}

export interface PayoutFailedData {
  payoutId: string;
  reference: string;
  status: 'failed';
  amount: string;
  accountNumber: string;
  bankCode: string;
  accountName: string;
  failureReason: string;
  failedAt: string;
}

export type CheckoutCompletedWebhook = WebhookEnvelope<CheckoutCompletedData> & { eventType: 'checkout.completed' };
export type CheckoutExpiredWebhook = WebhookEnvelope<CheckoutExpiredData> & { eventType: 'checkout.expired' };
export type DepositCompletedWebhook = WebhookEnvelope<DepositCompletedData> & { eventType: 'deposit.completed' };
export type PayoutCompletedWebhook = WebhookEnvelope<PayoutCompletedData> & { eventType: 'payout.completed' };
export type PayoutFailedWebhook = WebhookEnvelope<PayoutFailedData> & { eventType: 'payout.failed' };

export type FossaPayWebhookEvent =
  | CheckoutCompletedWebhook
  | CheckoutExpiredWebhook
  | DepositCompletedWebhook
  | PayoutCompletedWebhook
  | PayoutFailedWebhook;
