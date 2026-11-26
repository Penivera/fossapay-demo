import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { FossaPayClient, defaultMockLedger } from '@fossapay/client';
import { getDealStatusRank, isTerminalDealStatus, shouldAcceptDealUpdate, type DealStatus } from './dealStatus';

export type { DealStatus };

const DB_FILE = path.join(os.tmpdir(), 'safedeal_deals.json');

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
  private reconcileInFlight = new Map<string, Promise<Deal | undefined>>();

  constructor() {
    this.fossaClient = new FossaPayClient({
      mode: process.env.FOSSAPAY_MODE === 'live' ? 'live' : 'mock',
      mockLedger: defaultMockLedger,
    });
    this.loadFromDisk();
    if (this.deals.size === 0) {
      this.seedDemoDeal();
    }
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const data = JSON.parse(raw);
        if (Array.isArray(data)) {
          for (const d of data) {
            if (d && d.id) {
              this.deals.set(d.id, d);
            }
          }
        }
      }
    } catch (err) {
      console.warn('[SafeDealStore] Failed to load deals from disk:', err);
    }
  }

  private saveToDisk(): void {
    try {
      const data = Array.from(this.deals.values());
      fs.writeFileSync(DB_FILE, JSON.stringify(data), 'utf-8');
    } catch (err) {
      console.warn('[SafeDealStore] Failed to save deals to disk:', err);
    }
  }

  private seedDemoDeal(): void {
    const demoId = 'sd_demo_camera';
    if (!this.deals.has(demoId)) {
      const deal: Deal = {
        id: demoId,
        title: 'Fujifilm X-T30 II Camera Kit',
        description: 'Mint condition mirrorless camera with 18-55mm lens kit and extra battery.',
        price: '350000',
        inspectionPeriodSeconds: 86400,
        seller: {
          name: 'Chukwudi Nnamdi',
          phone: '08031234567',
          email: 'chukwudi@safedeal.ng',
          bankName: 'Guaranty Trust Bank',
          bankCode: '058',
          accountNumber: '0123456789',
          accountName: 'CHUKWUDI NNAMDI',
          customerId: 'cus_demo_seller',
          walletId: 'wal_demo_seller',
          sellerToken: 'stk_demo_seller_secret',
        },
        status: 'DRAFT',
        history: [
          {
            status: 'DRAFT',
            timestamp: new Date().toISOString(),
            note: 'Demo escrow deal initialized.',
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.deals.set(demoId, deal);
      this.saveToDisk();
    }
  }

  private async findOrCreateCustomer(params: {
    name: string;
    phone: string;
    email?: string;
    role: 'seller' | 'buyer';
  }): Promise<{ id: string; email?: string; phoneNumber?: string }> {
    const cleanPhone = (params.phone || '').replace(/\D/g, '');
    const email =
      params.email?.trim() ||
      (cleanPhone
        ? `${params.role}_${cleanPhone}@safedeal.ng`
        : `${params.role}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}@safedeal.ng`);

    const nameParts = (params.name || '').trim().split(/\s+/).filter(Boolean);
    const firstName = (nameParts[0] || (params.role === 'seller' ? 'Seller' : 'Buyer')).replace(/\s+/g, '') || 'User';
    const lastName = ((nameParts.length > 1 ? nameParts[nameParts.length - 1] : '') || (params.role === 'seller' ? 'Merchant' : 'Customer')).replace(/\s+/g, '') || 'Account';

    try {
      return await this.fossaClient.customers.create({
        firstName,
        lastName,
        email,
        phoneNumber: params.phone || '08012345678',
        dateOfBirth: '1990-01-01',
        address: 'Commercial Avenue',
        city: 'Lagos',
        country: 'Nigeria',
      });
    } catch (err: any) {
      if (err.message && err.message.toLowerCase().includes('already exists')) {
        const list = await this.fossaClient.customers.list({ limit: 100 });
        const existing = list.find(
          (c) =>
            (c.email && c.email.toLowerCase() === email.toLowerCase()) ||
            (cleanPhone && c.phoneNumber && c.phoneNumber.replace(/\D/g, '') === cleanPhone)
        );
        if (existing) {
          return existing;
        }
      }
      throw err;
    }
  }

  async createDeal(params: {
    title: string;
    description: string;
    price: string;
    inspectionPeriodSeconds?: number;
    seller: {
      name: string;
      phone: string;
      email?: string;
      bankName: string;
      bankCode: string;
      accountNumber: string;
      accountName: string;
    };
  }): Promise<Deal> {
    const id = `sd_${crypto.randomBytes(4).toString('hex')}`;
    const sellerToken = `stk_${crypto.randomBytes(8).toString('hex')}`;

    // Provision seller customer record & fiat wallet (reusing existing if present)
    const sellerCust = await this.findOrCreateCustomer({
      name: params.seller.name,
      phone: params.seller.phone,
      email: params.seller.email,
      role: 'seller',
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
        email: sellerCust.email || params.seller.email || 'seller@safedeal.ng',
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
    this.saveToDisk();
    this.notify(deal);
    return deal;
  }

  getDeal(id: string): Deal | undefined {
    let deal = this.deals.get(id);
    if (!deal) {
      this.loadFromDisk();
      deal = this.deals.get(id);
    }
    return deal;
  }

  syncDeal(incoming: Deal): Deal {
    if (!incoming || !incoming.id || !incoming.seller) {
      throw new Error('Invalid deal data');
    }
    const normalized: Deal = {
      ...incoming,
      history: Array.isArray(incoming.history) ? incoming.history : [],
    };
    const existing = this.getDeal(normalized.id);
    if (!existing) {
      this.deals.set(normalized.id, normalized);
      this.saveToDisk();
      this.notify(normalized, false);
      return normalized;
    }

    const existingRank = getDealStatusRank(existing.status);
    const incomingRank = getDealStatusRank(normalized.status);
    if (incomingRank < existingRank) {
      return existing;
    }
    if (incomingRank === existingRank && isTerminalDealStatus(existing.status)) {
      return existing;
    }
    if (shouldAcceptDealUpdate(existing, normalized)) {
      this.deals.set(normalized.id, normalized);
      this.saveToDisk();
      this.notify(normalized, false);
      return normalized;
    }
    return existing;
  }

  async reconcileCheckout(dealId: string): Promise<Deal | undefined> {
    const deal = this.getDeal(dealId);
    if (!deal) return undefined;
    if (deal.status !== 'WAITING_PAYMENT') return deal;

    const pending = this.reconcileInFlight.get(dealId);
    if (pending) return pending;

    const run = (async () => {
      try {
        const reference = deal.checkout?.reference || `ref_${deal.id}`;
        const checkout = await this.fossaClient.checkouts.getCheckoutByReference(reference).catch(() => null);
        const latest = this.getDeal(dealId);
        if (!latest || latest.status !== 'WAITING_PAYMENT') return latest;

        if (checkout && checkout.status === 'completed') {
          if (!latest.checkout) {
            latest.checkout = {
              id: checkout.id,
              reference: checkout.reference,
              accountNumber: checkout.accountNumber,
              bankName: checkout.bankName,
              amountPayable: checkout.amountPayable,
              expiresAt: checkout.expiresAt,
            };
            latest.price = checkout.amount;
          }
          return await this.lockEscrow(latest.id);
        }
      } catch (err) {
        console.warn('[SafeDealStore] Reconcile error:', err);
      }
      return this.getDeal(dealId);
    })();

    this.reconcileInFlight.set(dealId, run);
    try {
      return await run;
    } finally {
      this.reconcileInFlight.delete(dealId);
    }
  }

  listDeals(): Deal[] {
    this.loadFromDisk();
    return Array.from(this.deals.values());
  }

  listDisputedDeals(): Deal[] {
    this.loadFromDisk();
    return Array.from(this.deals.values()).filter((d) => d.status === 'DISPUTED');
  }

  subscribe(dealId: string, callback: DealSubscriber): () => void {
    if (!this.subscribers.has(dealId)) {
      this.subscribers.set(dealId, new Set());
    }
    const set = this.subscribers.get(dealId)!;
    set.add(callback);

    return () => {
      set.delete(callback);
      if (set.size === 0) {
        this.subscribers.delete(dealId);
      }
    };
  }

  private notify(deal: Deal, touchTimestamp = true): void {
    if (touchTimestamp) {
      deal.updatedAt = new Date().toISOString();
    }
    this.saveToDisk();
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
    const deal = this.getDeal(dealId);
    if (!deal) throw new Error(`Deal ${dealId} not found`);

    if (deal.status === 'DRAFT') {
      this.validateTransition('DRAFT', 'WAITING_PAYMENT');
      deal.status = 'WAITING_PAYMENT';
    }

    if (!deal.buyer) {
      const buyerCust = await this.findOrCreateCustomer({
        name: buyer.name,
        phone: buyer.phone,
        email: buyer.email,
        role: 'buyer',
      });

      const buyerWallet = await this.fossaClient.wallets.createFiatWallet({
        customerId: buyerCust.id,
      });

      deal.buyer = {
        name: buyer.name,
        phone: buyer.phone,
        email: buyerCust.email || buyer.email,
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
    const deal = this.getDeal(dealId);
    if (!deal) throw new Error(`Deal ${dealId} not found`);

    // Idempotent if already locked (e.g., concurrent webhook + reconciliation)
    if (getDealStatusRank(deal.status) >= getDealStatusRank('ESCROW_LOCKED')) {
      return deal;
    }

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
    const deal = this.getDeal(dealId);
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
    const deal = this.getDeal(dealId);
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

  async checkAndAutoRelease(dealId: string): Promise<void> {
    const deal = this.getDeal(dealId);
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
    const deal = this.getDeal(dealId);
    if (!deal) throw new Error(`Deal ${dealId} not found`);

    this.validateTransition(deal.status, 'RELEASED');

    // Cancel auto-release timer if still pending
    if (this.autoReleaseTimers.has(dealId)) {
      clearTimeout(this.autoReleaseTimers.get(dealId)!);
      this.autoReleaseTimers.delete(dealId);
    }

    // Step 1: Free wallet-to-wallet transfer
    if (deal.buyer && this.fossaClient.mode !== 'live') {
      try {
        await this.fossaClient.wallets.transferFiat({
          sourceWalletId: deal.buyer.walletId,
          destinationWalletId: deal.seller.walletId,
          amount: deal.price,
          narration: `SafeDeal ${deal.id} internal release`,
          // Stable reference so a retried release can never be mistaken for a new transfer
          reference: `safedeal_release_xfer_${deal.id}`,
        });
      } catch (err) {
        console.warn('[SafeDealStore] Internal wallet transfer skipped or failed:', err);
      }
    }

    // Step 2: Idempotent payout to seller bank account
    const payoutKey = `safedeal_release_payout_${deal.id}_1`;
    let payoutId = `pay_${deal.id}`;
    let payoutRef = `FP_SD_REL_${deal.id.toUpperCase()}`;

    if (deal.seller.accountNumber && deal.seller.accountNumber !== '0000000000' && deal.seller.bankCode !== '000') {
      try {
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
        payoutId = payout.id;
        payoutRef = payout.reference;
      } catch (err: any) {
        console.warn('[SafeDealStore] Master payout call failed:', err?.message || err);
        note = `${note} (Payout note: ${err?.message || 'provider settlement pending'})`;
      }
    }

    deal.status = 'RELEASED';
    deal.releasePayoutId = payoutId;
    deal.releasePayoutRef = payoutRef;

    deal.history.push({
      status: 'RELEASED',
      timestamp: new Date().toISOString(),
      note: `${note} Payout ref: ${payoutRef}`,
    });

    this.notify(deal);
    return deal;
  }

  /**
   * Buyer raises dispute with reason & evidence photo URL
   */
  async raiseDispute(dealId: string, params: { reason: string; evidencePhotoUrl?: string }): Promise<Deal> {
    const deal = this.getDeal(dealId);
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
    const deal = this.getDeal(dealId);
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

// Global singleton attached to globalThis across hot reloads & serverless invocations
const globalForSafeDeal = globalThis as unknown as { __safeDealStore?: SafeDealStore };
export const safeDealStore = globalForSafeDeal.__safeDealStore || new SafeDealStore();
globalForSafeDeal.__safeDealStore = safeDealStore;
