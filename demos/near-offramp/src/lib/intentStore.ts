import { FossaPayClient, defaultMockLedger } from '@fossapay/client';
import { defaultSolver } from './solver';

export interface TelemetryStepData {
  id: number;
  label: string;
  detail: string;
  status: 'pending' | 'active' | 'completed' | 'error';
  txHash?: string;
}

export interface OfframpSession {
  intentId: string;
  quoteId: string;
  status:
    | 'created'
    | 'origin_confirmed'
    | 'solver_matched'
    | 'solver_delivered'
    | 'payout_initiating'
    | 'payout_processing'
    | 'payout_completed'
    | 'payout_failed';
  progressPercent: number;
  steps: TelemetryStepData[];
  originAsset: {
    symbol: string;
    chain: string;
  };
  amountIn: string;
  minReceivedUsdc: string;
  netNgn: string;
  exchangeRateNgn: string;
  recipient: {
    accountNumber: string;
    accountName: string;
    bankCode: string;
    bankName: string;
  };
  payoutId?: string;
  payoutReference?: string;
  nibssSessionId?: string;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
  attempt: number;
}

type SessionSubscriber = (session: OfframpSession) => void;

class IntentStore {
  private sessions = new Map<string, OfframpSession>();
  private subscribers = new Map<string, Set<SessionSubscriber>>();
  private fossaClient: FossaPayClient;

  constructor() {
    this.fossaClient = new FossaPayClient({
      mode: process.env.FOSSAPAY_MODE === 'live' ? 'live' : 'mock',
      mockLedger: defaultMockLedger,
    });
  }

  createSession(params: {
    quoteId: string;
    originAsset: { symbol: string; chain: string };
    amountIn: string;
    minReceivedUsdc: string;
    netNgn: string;
    exchangeRateNgn: string;
    recipient: {
      accountNumber: string;
      accountName: string;
      bankCode: string;
      bankName: string;
    };
  }): OfframpSession {
    const intentId = `int_${Date.now().toString(36)}`;
    const session: OfframpSession = {
      intentId,
      quoteId: params.quoteId,
      status: 'created',
      progressPercent: 10,
      steps: [
        {
          id: 1,
          label: 'ORIGIN TRANSACTION BROADCAST',
          detail: 'Awaiting wallet authorization...',
          status: 'pending',
        },
        {
          id: 2,
          label: 'SOLVER MATCH & NEAR INTENT EXECUTION',
          detail: 'Intent solvers route to Solana USDC',
          status: 'pending',
        },
        {
          id: 3,
          label: 'FOSSAPAY FIAT DISBURSEMENT',
          detail: `Direct Master Payout to ${params.recipient.bankName}`,
          status: 'pending',
        },
        {
          id: 4,
          label: 'INTER-BANK SETTLEMENT (NIBSS)',
          detail: 'Clearing to destination commercial bank',
          status: 'pending',
        },
      ],
      originAsset: params.originAsset,
      amountIn: params.amountIn,
      minReceivedUsdc: params.minReceivedUsdc,
      netNgn: params.netNgn,
      exchangeRateNgn: params.exchangeRateNgn,
      recipient: params.recipient,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      attempt: 1,
    };

    this.sessions.set(intentId, session);
    return session;
  }

  getSession(intentId: string): OfframpSession | undefined {
    return this.sessions.get(intentId);
  }

  subscribe(intentId: string, callback: SessionSubscriber): () => void {
    if (!this.subscribers.has(intentId)) {
      this.subscribers.set(intentId, new Set());
    }
    const set = this.subscribers.get(intentId)!;
    set.add(callback);

    return () => {
      set.delete(callback);
      if (set.size === 0) {
        this.subscribers.delete(intentId);
      }
    };
  }

  private notify(session: OfframpSession): void {
    session.updatedAt = new Date().toISOString();
    const set = this.subscribers.get(session.intentId);
    if (set) {
      for (const cb of set) {
        try {
          cb(session);
        } catch (err) {
          console.error('[IntentStore] subscriber error:', err);
        }
      }
    }
  }

  async executeSession(
    intentId: string,
    options: { originTxHash?: string; simulatePayoutFailure?: boolean } = {}
  ): Promise<OfframpSession> {
    const session = this.sessions.get(intentId);
    if (!session) {
      throw new Error(`Intent session ${intentId} not found`);
    }

    // Step 1: Origin Transaction Confirmed
    const originTxHash = options.originTxHash || `0x4f8a${Date.now().toString(16)}9c2e`;
    session.status = 'origin_confirmed';
    session.steps[0].status = 'completed';
    session.steps[0].detail = `${session.amountIn} ${session.originAsset.symbol} debited on ${session.originAsset.chain}`;
    session.steps[0].txHash = originTxHash;
    session.steps[1].status = 'active';
    session.steps[1].detail = 'Solvers matching intent with zero slippage...';
    session.progressPercent = 35;
    this.notify(session);

    // Step 2: Solver Match & Delivery to Solana Master Vault
    await new Promise((r) => setTimeout(r, 600));
    const solverRes = await defaultSolver.executeIntent(session.quoteId, originTxHash);
    session.status = 'solver_delivered';
    session.steps[1].status = 'completed';
    session.steps[1].detail = `Delivered ${session.minReceivedUsdc} USDC to FossaPay Solana Master Vault`;
    session.steps[1].txHash = solverRes.solverTxHash;
    session.steps[2].status = 'active';
    session.steps[2].detail = `Initiating POST /payouts for ₦${session.netNgn}...`;
    session.progressPercent = 70;
    this.notify(session);

    // Step 3: Payout Initiation
    await new Promise((r) => setTimeout(r, 400));
    if (options.simulatePayoutFailure) {
      session.status = 'payout_failed';
      session.failureReason = 'Simulated banking clearing timeout. Safe to retry.';
      session.steps[2].status = 'error';
      session.steps[2].detail = 'Clearing network timeout. Click "Retry Settlement" to re-dispatch.';
      this.notify(session);
      return session;
    }

    return this.dispatchPayout(session);
  }

  async retryPayout(intentId: string): Promise<OfframpSession> {
    const session = this.sessions.get(intentId);
    if (!session) {
      throw new Error(`Intent session ${intentId} not found`);
    }

    session.steps[2].status = 'active';
    session.steps[2].detail = `Retrying payout with original idempotency key offramp_payout_${intentId}_1...`;
    session.failureReason = undefined;
    this.notify(session);

    return this.dispatchPayout(session);
  }

  private async dispatchPayout(session: OfframpSession): Promise<OfframpSession> {
    // Exact idempotency key required by ARCHITECTURE.md: offramp_payout_<intentId>_1
    const idempotencyKey = `offramp_payout_${session.intentId}_1`;

    try {
      const payout = await this.fossaClient.payouts.createMasterPayout(
        {
          accountNumber: session.recipient.accountNumber,
          bankCode: session.recipient.bankCode,
          accountName: session.recipient.accountName,
          amount: session.netNgn,
          narration: `NEAR Off-Ramp ${session.intentId}`,
          reference: `FP_PAY_${session.intentId.toUpperCase()}`,
        },
        idempotencyKey
      );

      session.payoutId = payout.id;
      session.payoutReference = payout.reference;
      session.nibssSessionId = payout.sessionId || `100004${Date.now()}841`;

      session.steps[2].status = 'completed';
      session.steps[2].detail = `FossaPay Ref: ${payout.reference}`;
      session.steps[3].status = 'active';
      session.steps[3].detail = 'Awaiting NIBSS clearing acknowledgment...';
      session.progressPercent = 88;
      this.notify(session);

      // Step 4: Final Settlement
      await new Promise((r) => setTimeout(r, 600));
      session.status = 'payout_completed';
      session.steps[3].status = 'completed';
      session.steps[3].detail = 'Settled to beneficiary commercial bank account';
      session.progressPercent = 100;
      this.notify(session);

      return session;
    } catch (err: any) {
      session.status = 'payout_failed';
      session.failureReason = err.message || 'Payout dispatch failed';
      session.steps[2].status = 'error';
      session.steps[2].detail = `Payout failed: ${session.failureReason}. Retry available.`;
      this.notify(session);
      return session;
    }
  }

  /**
   * payout.failed / payout.reversed: the beneficiary was NOT paid. Per FossaPay docs, never auto-create a
   * replacement payout; surface the failure so an operator/user decides (retry reuses the original key).
   */
  handlePayoutFailedWebhook(payoutId: string, reference: string, eventType: string): boolean {
    for (const session of this.sessions.values()) {
      if (session.payoutId === payoutId || session.payoutReference === reference) {
        const reversed = eventType === 'payout.reversed';
        session.status = 'payout_failed';
        session.failureReason = reversed
          ? 'Payout reversed by FossaPay; funds returned to the master wallet'
          : 'Payout failed at FossaPay; contact support if funds remain reserved';
        session.steps[2].status = 'error';
        session.steps[2].detail = session.failureReason;
        this.notify(session);
        return true;
      }
    }
    return false;
  }

  handlePayoutCompletedWebhook(payoutId: string, reference: string, sessionId?: string): boolean {
    for (const session of this.sessions.values()) {
      if (session.payoutId === payoutId || session.payoutReference === reference) {
        session.status = 'payout_completed';
        session.steps[2].status = 'completed';
        session.steps[3].status = 'completed';
        session.steps[3].detail = 'Settled to beneficiary commercial bank account';
        session.progressPercent = 100;
        if (sessionId) session.nibssSessionId = sessionId;
        this.notify(session);
        return true;
      }
    }
    return false;
  }
}

// Global singleton to preserve sessions across hot reloads
const globalForIntent = globalThis as unknown as { __offrampIntentStore?: IntentStore };
export const intentStore = globalForIntent.__offrampIntentStore || new IntentStore();
if (process.env.NODE_ENV !== 'production') {
  globalForIntent.__offrampIntentStore = intentStore;
}
