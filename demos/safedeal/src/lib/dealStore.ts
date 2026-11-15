import crypto from 'node:crypto';
import { FossaPayClient, defaultMockLedger } from '@fossapay/client';

export type DealStatus =
  | 'DRAFT'
  | 'WAITING_PAYMENT'
  | 'ESCROW_LOCKED'
  | 'DISPATCHED'
  | 'INSPECTION_PERIOD'
  | 'RELEASED'
  | 'DISPUTED'
  | 'REFUNDED';

export interface Deal {
  id: string;
  title: string;
  description: string;
  price: string;
  inspectionPeriodSeconds: number;
  inspectionStartedAt?: string;
  inspectionExpiresAt?: string;

  seller: {
    name: string;
    phone: string;
    email: string;
    bankName: string;
    bankCode: string;
    accountNumber: string;
    accountName: string;
    customerId: string;
    walletId: string;
    sellerToken: string;
  };

  buyer?: {
    name: string;
    phone: string;
    email?: string;
    customerId: string;
    walletId: string;
    refundBankCode?: string;
    refundAccountNumber?: string;
    refundAccountName?: string;
  };

  checkout?: {
    id: string;
    reference: string;
    accountNumber: string;
    bankName: string;
    amountPayable: string;
    expiresAt: string;
  };

  status: DealStatus;
  history: Array<{ status: DealStatus; timestamp: string; note: string }>;

  dispute?: {
    reason: string;
    evidencePhotoUrl?: string;
    raisedAt: string;
    resolvedAt?: string;
    resolutionNote?: string;
  };

  releasePayoutId?: string;
  releasePayoutRef?: string;
  refundPayoutId?: string;
  refundPayoutRef?: string;

  createdAt: string;
  updatedAt: string;
}

type DealSubscriber = (deal: Deal) => void;

const LEGAL_TRANSITIONS: Record<DealStatus, DealStatus[]> = {
  DRAFT: ['WAITING_PAYMENT'],
  WAITING_PAYMENT: ['ESCROW_LOCKED'],
  ESCROW_LOCKED: ['DISPATCHED'],
  DISPATCHED: ['INSPECTION_PERIOD'],
  INSPECTION_PERIOD: ['RELEASED', 'DISPUTED'],
  DISPUTED: ['RELEASED', 'REFUNDED'],
  RELEASED: [],
  REFUNDED: [],
};

class SafeDealStore {
  private deals = new Map<string, Deal>();
  private subscribers = new Map<string, Set<DealSubscriber>>();
  private fossaClient: FossaPayClient;
  private autoReleaseTimers = new Map<string, NodeJS.Timeout>();

  constructor() {
    this.fossaClient = new FossaPayClient({
      mode: process.env.FOSSAPAY_MODE === 'live' ? 'live' : 'mock',
      mockLedger: defaultMockLedger,
    });
  }

  async createDeal(params: {
    title: string;
    description: string;
    price: string;
    inspectionPeriodSeconds?: number;
    seller: {
      name: string;
      phone: string;
      email: string;
      bankName: string;
      bankCode: string;
      accountNumber: string;
      accountName: string;
    };
  }): Promise<Deal> {
    const id = `sd_${crypto.randomBytes(4).toString('hex')}`;
    const sellerToken = `stk_${crypto.randomBytes(8).toString('hex')}`;

    // Provision seller customer record & fiat wallet
    const sellerCust = await this.fossaClient.customers.create({
      firstName: params.seller.name.split(' ')[0] || params.seller.name,
      lastName: params.seller.name.split(' ')[1] || 'Seller',
      email: params.seller.email,
      phoneNumber: params.seller.phone,
    });

    const sellerWallet = await this.fossaClient.wallets.createFiatWallet({
      customerId: sellerCust.id,
    });

    const deal: Deal = {
      id,
      title: params.title,
      description: params.description,
      price: params.price,
      inspectionPeriodSeconds: params.inspectionPeriodSeconds || 86400, // 24 hours default
      seller: {
        ...params.seller,
        customerId: sellerCust.id,
        walletId: sellerWallet.id,
        sellerToken,
      },
      status: 'DRAFT',
      history: [
        {
          status: 'DRAFT',
          timestamp: new Date().toISOString(),
          note: 'Deal created by seller',
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.deals.set(id, deal);
    this.notify(deal);
    return deal;
  }

  getDeal(id: string): Deal | undefined {
    return this.deals.get(id);
  }

  listDeals(): Deal[] {
    return Array.from(this.deals.values());
  }

  listDisputedDeals(): Deal[] {
    return Array.from(this.deals.values()).filter((d) => d.status === 'DISPUTED');
  }

  subscribe(dealId: string, callback: DealSubscriber): () => void {
    if (!this.subscribers.has(dealId)) {
      this.subscribers.set(dealId, new Set());
    }
    const set = this.subscribers.get(dealId)!;
    set.add(callback);

    const deal = this.deals.get(dealId);
    if (deal) callback(deal);

    return () => {
      set.delete(callback);
      if (set.size === 0) {
        this.subscribers.delete(dealId);
      }
    };
  }

  private notify(deal: Deal): void {
    deal.updatedAt = new Date().toISOString();
    const set = this.subscribers.get(deal.id);
    if (set) {
      for (const cb of set) {
        try {
          cb(deal);
        } catch (err) {
          console.error('[SafeDealStore] Subscriber notification error:', err);
        }
      }
    }
  }

  private validateTransition(current: DealStatus, next: DealStatus): void {
    const allowed = LEGAL_TRANSITIONS[current];
    if (!allowed || !allowed.includes(next)) {
      throw new Error(`Illegal state transition from ${current} to ${next}. Allowed: ${allowed.join(', ') || 'none'}`);
    }
  }

  /**
   * Buyer initiates escrow deposit by requesting virtual account
   */
  async initiateCheckout(
    dealId: string,
    buyer: { name: string; phone: string; email?: string }
  ): Promise<Deal> {
    const deal = this.deals.get(dealId);
    if (!deal) throw new Error(`Deal ${dealId} not found`);

    if (deal.status === 'DRAFT') {
      this.validateTransition('DRAFT', 'WAITING_PAYMENT');
      deal.status = 'WAITING_PAYMENT';
    }

    if (!deal.buyer) {
      const buyerCust = await this.fossaClient.customers.create({
        firstName: buyer.name.split(' ')[0] || buyer.name,
        lastName: buyer.name.split(' ')[1] || 'Buyer',
        phoneNumber: buyer.phone,
        email: buyer.email,
      });

      const buyerWallet = await this.fossaClient.wallets.createFiatWallet({
        customerId: buyerCust.id,
      });

      deal.buyer = {
        name: buyer.name,
        phone: buyer.phone,
        email: buyer.email,
        customerId: buyerCust.id,
        walletId: buyerWallet.id,
      };
    }

    if (!deal.checkout) {
      const idempotencyKey = `safedeal_checkout_${deal.id}_1`;
      const checkoutRecord = await this.fossaClient.checkouts.createCheckout(
        {
          amount: deal.price,
          currency: 'NGN',
          feeBearer: 'customer', // buyer pays fee
          reference: `ref_${deal.id}`,
          customerId: deal.buyer.customerId,
          description: `SafeDeal Escrow: ${deal.title}`,
        },
        idempotencyKey
      );

      deal.checkout = {
        id: checkoutRecord.id,
        reference: checkoutRecord.reference,
        accountNumber: checkoutRecord.accountNumber,
        bankName: checkoutRecord.bankName,
        amountPayable: checkoutRecord.amountPayable,
        expiresAt: checkoutRecord.expiresAt,
      };

      deal.history.push({
        status: 'WAITING_PAYMENT',
        timestamp: new Date().toISOString(),
        note: `Dynamic checkout generated for buyer (${checkoutRecord.accountNumber} at ${checkoutRecord.bankName})`,
      });
    }

    this.notify(deal);
    return deal;
  }

  /**
   * Fired upon checkout.completed webhook (or simulated deposit)
   */
  async lockEscrow(dealId: string): Promise<Deal> {
    const deal = this.deals.get(dealId);
    if (!deal) throw new Error(`Deal ${dealId} not found`);

    this.validateTransition(deal.status, 'ESCROW_LOCKED');
    deal.status = 'ESCROW_LOCKED';

    // Credit buyer wallet in mock ledger to reflect escrow locked
    if (deal.buyer) {
      const buyerWallet = defaultMockLedger.fiatWallets.get(deal.buyer.walletId);
      if (buyerWallet) {
        buyerWallet.balance = deal.price;
      }
    }

    deal.history.push({
      status: 'ESCROW_LOCKED',
      timestamp: new Date().toISOString(),
      note: `₦${deal.price} verified and locked in escrow. Seller authorized to dispatch.`,
    });

    this.notify(deal);
    return deal;
  }

  /**
   * Seller marks package as dispatched (courier drop-off)
   */
  async dispatchPackage(dealId: string): Promise<Deal> {
    const deal = this.deals.get(dealId);
    if (!deal) throw new Error(`Deal ${dealId} not found`);

    this.validateTransition(deal.status, 'DISPATCHED');
    deal.status = 'DISPATCHED';

    deal.history.push({
      status: 'DISPATCHED',
      timestamp: new Date().toISOString(),
      note: 'Item dispatched via courier. Tracking active.',
    });

    this.notify(deal);
    return deal;
  }

  /**
   * Courier confirms package drop-off to buyer -> inspection window begins
   */
  async startInspection(dealId: string): Promise<Deal> {
    const deal = this.deals.get(dealId);
    if (!deal) throw new Error(`Deal ${dealId} not found`);

    this.validateTransition(deal.status, 'INSPECTION_PERIOD');
    deal.status = 'INSPECTION_PERIOD';

    const now = Date.now();
    deal.inspectionStartedAt = new Date(now).toISOString();
    deal.inspectionExpiresAt = new Date(now + deal.inspectionPeriodSeconds * 1000).toISOString();

    deal.history.push({
      status: 'INSPECTION_PERIOD',
      timestamp: deal.inspectionStartedAt,
      note: `Package delivered. ${deal.inspectionPeriodSeconds}s inspection window started.`,
    });

    // Schedule auto-release timer
    if (this.autoReleaseTimers.has(dealId)) {
      clearTimeout(this.autoReleaseTimers.get(dealId)!);
    }

    const timer = setTimeout(() => {
      this.checkAndAutoRelease(dealId).catch(console.error);
    }, deal.inspectionPeriodSeconds * 1000);

    this.autoReleaseTimers.set(dealId, timer);

    this.notify(deal);
    return deal;
  }

  private async checkAndAutoRelease(dealId: string): Promise<void> {
    const deal = this.deals.get(dealId);
    if (deal && deal.status === 'INSPECTION_PERIOD') {
      console.log(`[SafeDeal] Auto-releasing deal ${dealId} due to inspection expiration`);
      await this.releaseFunds(dealId, 'Inspection countdown expired without dispute. Funds automatically released to seller.');
    }
  }

  /**
   * Buyer approves goods OR auto-release expires OR admin resolves in favor of seller
   * 1. Free internal wallet transfer: buyer wallet -> seller wallet
   * 2. Payout to seller bank account with idempotency key
   */
  async releaseFunds(dealId: string, note = 'Buyer approved goods. Funds released.'): Promise<Deal> {
    const deal = this.deals.get(dealId);
    if (!deal) throw new Error(`Deal ${dealId} not found`);

    this.validateTransition(deal.status, 'RELEASED');

    // Cancel auto-release timer if still pending
    if (this.autoReleaseTimers.has(dealId)) {
      clearTimeout(this.autoReleaseTimers.get(dealId)!);
      this.autoReleaseTimers.delete(dealId);
    }

    // Step 1: Free wallet-to-wallet transfer
    if (deal.buyer) {
      await this.fossaClient.wallets.transferFiat({
        sourceWalletId: deal.buyer.walletId,
        destinationWalletId: deal.seller.walletId,
        amount: deal.price,
        narration: `SafeDeal ${deal.id} internal release`,
      });
    }

    // Step 2: Idempotent payout to seller bank account
    const payoutKey = `safedeal_release_payout_${deal.id}_1`;
    const payout = await this.fossaClient.payouts.createMasterPayout(
      {
        accountNumber: deal.seller.accountNumber,
        bankCode: deal.seller.bankCode,
        accountName: deal.seller.accountName,
        amount: deal.price,
        narration: `SafeDeal payout for ${deal.title}`,
        reference: `FP_SD_REL_${deal.id.toUpperCase()}`,
      },
      payoutKey
    );

    deal.status = 'RELEASED';
    deal.releasePayoutId = payout.id;
    deal.releasePayoutRef = payout.reference;

    deal.history.push({
      status: 'RELEASED',
      timestamp: new Date().toISOString(),
      note: `${note} Payout ref: ${payout.reference}`,
    });

    this.notify(deal);
    return deal;
  }

  /**
   * Buyer raises dispute with reason & evidence photo URL
   */
  async raiseDispute(dealId: string, params: { reason: string; evidencePhotoUrl?: string }): Promise<Deal> {
    const deal = this.deals.get(dealId);
    if (!deal) throw new Error(`Deal ${dealId} not found`);

    this.validateTransition(deal.status, 'DISPUTED');

    // Cancel auto-release timer
    if (this.autoReleaseTimers.has(dealId)) {
      clearTimeout(this.autoReleaseTimers.get(dealId)!);
      this.autoReleaseTimers.delete(dealId);
    }

    deal.status = 'DISPUTED';
    deal.dispute = {
      reason: params.reason,
      evidencePhotoUrl: params.evidencePhotoUrl,
      raisedAt: new Date().toISOString(),
    };

    deal.history.push({
      status: 'DISPUTED',
      timestamp: new Date().toISOString(),
      note: `Dispute raised: ${params.reason}. Escalated to admin mediation.`,
    });

    this.notify(deal);
    return deal;
  }

  /**
   * Admin mediation resolves dispute by refunding buyer
   */
  async refundBuyer(
    dealId: string,
    params: {
      accountNumber: string;
      bankCode: string;
      accountName: string;
      resolutionNote?: string;
    }
  ): Promise<Deal> {
    const deal = this.deals.get(dealId);
    if (!deal) throw new Error(`Deal ${dealId} not found`);

    this.validateTransition(deal.status, 'REFUNDED');

    const refundKey = `safedeal_refund_payout_${deal.id}_1`;
    const payout = await this.fossaClient.payouts.createMasterPayout(
      {
        accountNumber: params.accountNumber,
        bankCode: params.bankCode,
        accountName: params.accountName,
        amount: deal.price,
        narration: `SafeDeal refund for ${deal.title}`,
        reference: `FP_SD_REF_${deal.id.toUpperCase()}`,
      },
      refundKey
    );

    deal.status = 'REFUNDED';
    deal.refundPayoutId = payout.id;
    deal.refundPayoutRef = payout.reference;

    if (deal.dispute) {
      deal.dispute.resolvedAt = new Date().toISOString();
      deal.dispute.resolutionNote = params.resolutionNote || 'Refunded to buyer following evidence review';
    }

    deal.history.push({
      status: 'REFUNDED',
      timestamp: new Date().toISOString(),
      note: `Dispute resolved in favor of buyer. Refunded ₦${deal.price} to ${params.accountName}. Ref: ${payout.reference}`,
    });

    this.notify(deal);
    return deal;
  }
}

// Hot-reload global singleton
const globalForSafeDeal = globalThis as unknown as { __safeDealStore?: SafeDealStore };
export const safeDealStore = globalForSafeDeal.__safeDealStore || new SafeDealStore();
if (process.env.NODE_ENV !== 'production') {
  globalForSafeDeal.__safeDealStore = safeDealStore;
}
