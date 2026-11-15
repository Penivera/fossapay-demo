import BigNumber from 'bignumber.js';

// Strict financial BigNumber config
BigNumber.config({
  DECIMAL_PLACES: 2,
  ROUNDING_MODE: BigNumber.ROUND_HALF_UP,
  EXPONENTIAL_AT: [-1e9, 1e9],
});

export interface SolverQuoteRequest {
  originAsset: {
    id: string;
    symbol: string;
    chain: string;
    decimals: number;
  };
  amountIn: string; // e.g. "100.00"
  recipientSolanaAddress?: string;
}

export interface SolverQuoteResult {
  quoteId: string;
  depositAddress: string;
  originAsset: string;
  amountIn: string;
  minReceivedUsdc: string; // e.g. "99.90"
  exchangeRateNgn: string; // e.g. "1595.00"
  fiatPayoutFeeNgn: string; // e.g. "50.00"
  grossNgn: string; // e.g. "159340.50"
  netNgn: string; // e.g. "159290.50"
  estimatedTimeSeconds: number;
  expiresAt: string;
}

export interface SolverExecutionResult {
  intentId: string;
  originTxHash: string;
  solverTxHash: string;
  destinationAddress: string;
  usdcDelivered: string;
  status: 'matched' | 'delivering' | 'delivered' | 'failed';
}

export interface SolverAdapter {
  getQuote(request: SolverQuoteRequest): Promise<SolverQuoteResult>;
  executeIntent(quoteId: string, originTxHash: string): Promise<SolverExecutionResult>;
  getIntentStatus(intentId: string): Promise<SolverExecutionResult>;
}

/**
 * MockSolverAdapter: Simulates NEAR Intents 1Click cross-chain swap
 * Uses zero floating-point math, realistic transaction hashes, and delivers to FossaPay Solana Master Wallet.
 */
export class MockSolverAdapter implements SolverAdapter {
  private readonly defaultRateNgn: string;
  private readonly payoutFeeNgn: string;
  private readonly solanaMasterVault: string;

  constructor(options: { defaultRateNgn?: string; payoutFeeNgn?: string; solanaMasterVault?: string } = {}) {
    this.defaultRateNgn = options.defaultRateNgn || '1595.00';
    this.payoutFeeNgn = options.payoutFeeNgn || '50.00';
    this.solanaMasterVault = options.solanaMasterVault || 'FossaPaySolanaMasterVault1111111111111111111';
  }

  async getQuote(request: SolverQuoteRequest): Promise<SolverQuoteResult> {
    const amountInBn = new BigNumber(request.amountIn);
    if (amountInBn.isNaN() || amountInBn.lte(0)) {
      throw new Error(`Invalid origin asset amount: ${request.amountIn}`);
    }

    // 0.10% solver routing margin -> 99.90 USDC delivered for 100 USDT
    const minReceivedUsdcBn = amountInBn.times(0.9990);
    const minReceivedUsdc = minReceivedUsdcBn.toFixed(4);

    const rateBn = new BigNumber(this.defaultRateNgn);
    const feeBn = new BigNumber(this.payoutFeeNgn);

    const grossNgnBn = minReceivedUsdcBn.times(rateBn);
    const netNgnBn = BigNumber.max(0, grossNgnBn.minus(feeBn));

    const quoteId = `quote_${Date.now().toString(36)}`;
    const prefix = request.originAsset.chain.toLowerCase() === 'solana' ? 'SolDeposit' : '0x3a9f1b4c';
    const depositAddress = `${prefix}${Math.random().toString(16).substring(2, 8)}9c2e`;

    return {
      quoteId,
      depositAddress,
      originAsset: request.originAsset.symbol,
      amountIn: amountInBn.toFixed(2),
      minReceivedUsdc,
      exchangeRateNgn: rateBn.toFixed(2),
      fiatPayoutFeeNgn: feeBn.toFixed(2),
      grossNgn: grossNgnBn.toFixed(2),
      netNgn: netNgnBn.toFixed(2),
      estimatedTimeSeconds: 12,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    };
  }

  async executeIntent(quoteId: string, originTxHash: string): Promise<SolverExecutionResult> {
    const intentId = `int_${quoteId.replace('quote_', '')}`;
    return {
      intentId,
      originTxHash: originTxHash || '0x4f8a91bc72e4859a6c2e',
      solverTxHash: '5KNv91bc7Xp1M8uQvA3sZ',
      destinationAddress: this.solanaMasterVault,
      usdcDelivered: '99.90',
      status: 'delivered',
    };
  }

  async getIntentStatus(intentId: string): Promise<SolverExecutionResult> {
    return {
      intentId,
      originTxHash: '0x4f8a91bc72e4859a6c2e',
      solverTxHash: '5KNv91bc7Xp1M8uQvA3sZ',
      destinationAddress: this.solanaMasterVault,
      usdcDelivered: '99.90',
      status: 'delivered',
    };
  }
}

/**
 * NearIntentsSolverAdapter: Skeleton implementation against the public 1Click API (Defuse / chaindefuser).
 * Marked as an offline-fallback wrapper when 1Click API is unverified or offline.
 */
export class NearIntentsSolverAdapter implements SolverAdapter {
  private readonly baseUrl: string;
  private readonly fallback: MockSolverAdapter;

  constructor(baseUrl = 'https://1click.chaindefuser.com') {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.fallback = new MockSolverAdapter();
  }

  async getQuote(request: SolverQuoteRequest): Promise<SolverQuoteResult> {
    try {
      const res = await fetch(`${this.baseUrl}/v0/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dryRun: true,
          originAsset: request.originAsset.id,
          destinationAsset: 'nep141:solana-usdc.omft.near',
          amountIn: new BigNumber(request.amountIn).times(1e6).toFixed(0),
          recipient: 'FossaPaySolanaMasterVault1111111111111111111',
          deadline: Math.floor(Date.now() / 1000) + 1800,
        }),
      });

      if (!res.ok) {
        throw new Error(`1Click quote returned HTTP ${res.status}`);
      }

      const data = await res.json();
      const amountOutUsdc = new BigNumber(data.amountOut).dividedBy(1e6).toFixed(4);
      const grossNgn = new BigNumber(amountOutUsdc).times(1595.00);
      const netNgn = BigNumber.max(0, grossNgn.minus(50.00));

      return {
        quoteId: `quote_${Date.now().toString(36)}`,
        depositAddress: data.depositAddress,
        originAsset: request.originAsset.symbol,
        amountIn: request.amountIn,
        minReceivedUsdc: amountOutUsdc,
        exchangeRateNgn: '1595.00',
        fiatPayoutFeeNgn: '50.00',
        grossNgn: grossNgn.toFixed(2),
        netNgn: netNgn.toFixed(2),
        estimatedTimeSeconds: 12,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      };
    } catch {
      // Offline fallback
      return this.fallback.getQuote(request);
    }
  }

  async executeIntent(quoteId: string, originTxHash: string): Promise<SolverExecutionResult> {
    return this.fallback.executeIntent(quoteId, originTxHash);
  }

  async getIntentStatus(intentId: string): Promise<SolverExecutionResult> {
    return this.fallback.getIntentStatus(intentId);
  }
}

export const defaultSolver: SolverAdapter = new MockSolverAdapter();
