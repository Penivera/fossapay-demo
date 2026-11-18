/**
 * FossaPay Standard API Type Definitions
 * Adheres strictly to ARCHITECTURE.md and product specifications.
 */

/**
 * Standard FossaPay envelope. Note that `status` is the string 'success' | 'error' on some
 * endpoints and a boolean on others (banks, enquiry, fees); `success` is used by a few reads.
 * Some endpoints (e.g. POST /kyc/verifications) return the payload with no envelope at all.
 */
export interface FossaPayResponse<T> {
  status?: 'success' | 'error' | boolean;
  success?: boolean;
  statusCode?: number;
  message?: string;
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
  middleName?: string;
  lastName?: string;
  /** ISO date (YYYY-MM-DD). Required by the live API. */
  dateOfBirth?: string;
  /** Required by the live API. */
  address?: string;
  /** Required by the live API. */
  city?: string;
  /** Required by the live API. */
  country?: string;
  metadata?: Record<string, unknown>;
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
  accountType?: 'permanent' | 'dedicated';
  /** Live API: display name of the wallet (defaults to `Wallet <customerId>`). */
  walletName?: string;
  /** Live API: your unique reference for the wallet (defaults to `wallet_<customerId>`). */
  walletReference?: string;
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
  narration?: string;
  /** Live API: unique transfer reference (generated when omitted). */
  reference?: string;
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
  /** Whole NGN. The live API rejects fractional amounts. */
  amount: string | number;
  currency?: string;
  /** Mock/demo bookkeeping only; never sent to the live API. */
  customerId?: string;
  /** Live API: required, 1-100 chars of [A-Za-z0-9._:-]. Derived from the idempotency key when omitted. */
  reference?: string;
  feeBearer?: 'customer' | 'merchant' | 'buyer';
  /** Sent live as `metadata.description` (the checkout schema has no top-level description). */
  description?: string;
  /** Mock only. Live checkouts always expire after 30 minutes. */
  expiresInMinutes?: number;
  /** Optional customer contact details (live API `customer`). */
  customer?: { name?: string; email?: string; phoneNumber?: string };
  /** Optional transaction split code (`SPL_` + 16 hex). */
  splitCode?: string;
  metadata?: Record<string, unknown>;
}

export interface CheckoutRecord {
  id: string;
  reference: string;
  amount: string;
  fee: string;
  amountPayable: string;
  feeBearer: 'customer' | 'merchant' | 'buyer';
  currency: string;
  status: 'pending' | 'processing' | 'completed' | 'expired' | 'failed' | 'reversed';
  accountNumber: string;
  bankName: string;
  bankCode?: string;
  accountName: string;
  expiresAt: string;
  createdAt: string;
  settlementAmount?: string;
  account?: {
    type?: string;
    bankName?: string;
    accountName?: string;
    accountNumber?: string;
    expiresAt?: string;
  };
  metadata?: Record<string, unknown>; // UNVERIFIED
}

export interface CreatePayoutRequest {
  accountNumber: string;
  bankCode: string;
  accountName: string;
  /** Looked up from the supported-bank list by `bankCode` when omitted (live mode). */
  bankName?: string;
  /** Whole NGN. The live API rejects fractional amounts. */
  amount: string | number;
  narration?: string;
  /** Live API: required, unique per merchant. Derived from the idempotency key when omitted. */
  reference?: string;
  metadata?: Record<string, unknown>;
}

export interface PayoutRecord {
  id: string;
  reference: string;
  /** `processing` is NON-terminal: wait for the payout.completed/failed/reversed webhook. */
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'reversed';
  amount: string;
  fee: string;
  amountPayable?: string;
  /** Live API: total debited from the master wallet (amount + fee). */
  totalDebited?: string;
  route?: 'same_business' | 'fossapay_cross_business' | 'external_bank';
  transactionId?: string | null;
  providerReference?: string | null;
  recipient: {
    accountNumber: string;
    accountName: string;
    bankCode: string;
    bankName?: string;
  };
  narration?: string;
  createdAt: string;
  updatedAt?: string;
  sessionId?: string; // NIBSS session ID (mock); live exposes providerReference
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
