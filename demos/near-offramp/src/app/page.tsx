'use client';

import React, { useState } from 'react';
import { Navbar } from '../components/Navbar';
import { WalletModal } from '../components/WalletModal';
import { OffRampCard } from '../components/OffRampCard';
import { TelemetryTerminal, TelemetryStep } from '../components/TelemetryTerminal';
import { ReceiptModal } from '../components/ReceiptModal';
import { useNear } from '../providers/NearProvider';
import { ShieldCheck, Zap, ArrowRightLeft, Building2, CheckCircle2, Lock, Activity, Sparkles, Layers } from 'lucide-react';

type ScreenState = 'input' | 'telemetry' | 'receipt';

const RECENT_SETTLEMENTS = [
  {
    token: '150 USDT',
    chain: 'Arbitrum',
    naira: '₦ 239,200.00',
    bank: 'Kuda Bank',
    time: '14s ago',
  },
  {
    token: '50 USDC',
    chain: 'Base',
    naira: '₦ 79,700.00',
    bank: 'OPay Digital Services',
    time: '38s ago',
  },
  {
    token: '1.5 SOL',
    chain: 'Solana',
    naira: '₦ 358,800.00',
    bank: 'GTBank',
    time: '1m ago',
  },
  {
    token: '35 NEAR',
    chain: 'NEAR Mainnet',
    naira: '₦ 251,212.50',
    bank: 'Moniepoint MFB',
    time: '2m ago',
  },
];

export default function OffRampPage() {
  const [screenState, setScreenState] = useState<ScreenState>('input');
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const { signDebit } = useNear();

  // Active Execution Telemetry
  const [sessionId, setSessionId] = useState('');
  const [progressPercent, setProgressPercent] = useState(10);
  const [telemetrySteps, setTelemetrySteps] = useState<TelemetryStep[]>([
    {
      id: 1,
      label: 'ORIGIN TRANSACTION BROADCAST',
      detail: 'Awaiting user wallet approval...',
      status: 'active',
    },
    {
      id: 2,
      label: 'SOLVER MATCH & NEAR INTENT EXECUTION',
      detail: 'Market makers routing to Solana USDC',
      status: 'pending',
    },
    {
      id: 3,
      label: 'FOSSAPAY FIAT DISBURSEMENT',
      detail: 'Initiating Master Wallet Payout API',
      status: 'pending',
    },
    {
      id: 4,
      label: 'INTER-BANK SETTLEMENT (NIBSS)',
      detail: 'Clearing to destination commercial bank',
      status: 'pending',
    },
  ]);

  // Settled Receipt
  const [finalReceipt, setFinalReceipt] = useState<any>(null);

  const handleInitiate = async (details: any) => {
    const newSessionId = `int_${Date.now().toString(36)}`;
    setSessionId(newSessionId);
    setScreenState('telemetry');
    setProgressPercent(20);

    // Step 1: Debit from user wallet
    const txHash = await signDebit(details.depositAddress, details.amountIn);

    setTelemetrySteps((prev) => [
      {
        ...prev[0],
        status: 'completed',
        detail: `${details.amountIn} ${details.originAsset.symbol} debited on ${details.originAsset.chain}`,
        txHash,
      },
      {
        ...prev[1],
        status: 'active',
        detail: 'Solvers matched intent with zero slippage',
      },
      prev[2],
      prev[3],
    ]);
    setProgressPercent(50);

    // Step 2: Solvers fulfill cross-chain swap to Solana USDC
    await new Promise((r) => setTimeout(r, 1800));

    setTelemetrySteps((prev) => [
      prev[0],
      {
        ...prev[1],
        status: 'completed',
        detail: 'Delivered USDC to FossaPay Solana Master Vault',
        txHash: '5KNv91bc7Xp1',
      },
      {
        ...prev[2],
        status: 'active',
        detail: `Calling POST /api/v1/payouts for ₦${details.netNgn.toLocaleString()}`,
      },
      prev[3],
    ]);
    setProgressPercent(75);

    // Step 3: Trigger FossaPay Payout via Backend
    try {
      const payoutRes = await fetch('/api/payout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteId: details.quoteId,
          accountNumber: details.accountNumber,
          bankCode: details.bankCode,
          accountName: details.accountName,
          amountNgn: details.netNgn,
          originTxHash: txHash,
        }),
      });
      const payoutJson = await payoutRes.json();
      const payoutData = payoutJson.data;

      setTelemetrySteps((prev) => [
        prev[0],
        prev[1],
        {
          ...prev[2],
          status: 'completed',
          detail: `Reference: ${payoutData?.reference || 'FP_PAY_e4b1a8c9'}`,
        },
        {
          ...prev[3],
          status: 'active',
          detail: 'NIBSS network settlement confirmation in progress',
        },
      ]);
      setProgressPercent(90);

      await new Promise((r) => setTimeout(r, 1400));

      setTelemetrySteps((prev) => [
        prev[0],
        prev[1],
        prev[2],
        {
          ...prev[3],
          status: 'completed',
          detail: 'Funds confirmed in beneficiary account',
        },
      ]);
      setProgressPercent(100);

      // Transition to Receipt
      await new Promise((r) => setTimeout(r, 700));
      setFinalReceipt({
        id: payoutData?.id || 'pay_01',
        reference: payoutData?.reference || 'FP_PAY_e4b1a8c9',
        amount: String(details.netNgn),
        fee: '50.00',
        recipient: {
          accountNumber: details.accountNumber,
          accountName: details.accountName,
          bankCode: details.bankCode,
          bankName: details.bankName,
        },
        originAsset: details.originAsset.symbol,
        originAmount: parseFloat(details.amountIn),
        nibssSessionId: payoutData?.nibssSessionId || `100004${Date.now()}841`,
        createdAt: new Date().toISOString(),
      });
      setScreenState('receipt');
    } catch (e) {
      console.error('Payout failed:', e);
    }
  };

  const handleReset = () => {
    setScreenState('input');
    setProgressPercent(10);
    setFinalReceipt(null);
  };

  return (
    <div className="min-h-screen bg-[#090d16] bg-ambient-radial text-slate-100 flex flex-col font-sans selection:bg-orange-500/30 selection:text-white relative">
      {/* Micro-dot ambient background pattern */}
      <div className="absolute inset-0 bg-dot-pattern opacity-40 pointer-events-none" />

      <Navbar onOpenWalletModal={() => setIsWalletModalOpen(true)} />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 lg:py-12 relative z-10">
        {/* Top Header & Breadcrumb */}
        <div className="mb-8 lg:mb-12 text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 font-mono text-xs mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>CROSS-CHAIN INTENTS ➔ SOLANA USDC ➔ FOSSAPAY NGN</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white">
            Instant Cross-Chain Liquidation to Naira
          </h1>
          <p className="text-sm sm:text-base text-slate-400 max-w-3xl mt-2 font-normal leading-relaxed">
            Non-custodial off-ramp powered by NEAR 1Click solver intents and FossaPay direct Nigerian banking rails. Sell crypto on any chain, receive instant NGN in your bank account in 12 seconds.
          </p>

          {/* Quick Metrics Bar */}
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/[0.06] backdrop-blur-md">
              <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Settlement SLA</div>
              <div className="text-base sm:text-lg font-bold font-mono text-emerald-400 mt-0.5 flex items-center gap-1">
                <Zap className="w-4 h-4" />
                ~8.4s Direct
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/[0.06] backdrop-blur-md">
              <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Intent Protocol</div>
              <div className="text-base sm:text-lg font-bold font-mono text-orange-400 mt-0.5">
                NEAR 1Click
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/[0.06] backdrop-blur-md">
              <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Fiat Rail</div>
              <div className="text-base sm:text-lg font-bold font-mono text-white mt-0.5">
                FossaPay Core
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/[0.06] backdrop-blur-md">
              <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Bank Coverage</div>
              <div className="text-base sm:text-lg font-bold font-mono text-slate-200 mt-0.5">
                100+ Banks (NIBSS)
              </div>
            </div>
          </div>
        </div>

        {/* Master Desktop Split Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Main Interaction Column (Left) */}
          <div className="lg:col-span-7 w-full">
            {screenState === 'input' && (
              <OffRampCard
                onOpenWalletModal={() => setIsWalletModalOpen(true)}
                onInitiate={handleInitiate}
              />
            )}

            {screenState === 'telemetry' && (
              <TelemetryTerminal
                steps={telemetrySteps}
                progressPercent={progressPercent}
                sessionId={sessionId}
              />
            )}

            {screenState === 'receipt' && finalReceipt && (
              <ReceiptModal receipt={finalReceipt} onReset={handleReset} />
            )}
          </div>

          {/* Desktop Protocol Intel & Live Feed Column (Right) */}
          <div className="lg:col-span-5 w-full space-y-6">
            {/* Live Settlement Stream */}
            <div className="p-6 rounded-2xl cf-card-dark space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-orange-400" />
                  <span className="cf-kicker text-slate-200">LIVE SOLVER ACTIVITY</span>
                </div>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </div>

              <div className="space-y-3 font-mono text-xs">
                {RECENT_SETTLEMENTS.map((tx, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-slate-950/40 border border-white/[0.04] flex items-center justify-between hover:border-white/[0.08] transition"
                  >
                    <div>
                      <div className="text-white font-bold flex items-center gap-1.5">
                        <span>{tx.token}</span>
                        <span className="text-[10px] font-sans text-slate-400 font-normal">on {tx.chain}</span>
                      </div>
                      <div className="text-[11px] text-emerald-400 font-semibold mt-0.5">
                        ➔ {tx.naira}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-slate-300 text-[11px] flex items-center gap-1 justify-end">
                        <Building2 className="w-3 h-3 text-slate-400" />
                        <span>{tx.bank}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {tx.time}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Architecture Explainer Card */}
            <div className="p-6 rounded-2xl cf-card-dark space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-white/[0.08]">
                <Layers className="w-4 h-4 text-orange-400" />
                <span className="cf-kicker text-slate-200">HOW THE INTENT EXECUTES</span>
              </div>

              <div className="space-y-3.5 text-xs text-slate-300 font-sans">
                <div className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-md bg-orange-500/15 text-orange-400 font-mono text-[10px] font-bold flex items-center justify-center shrink-0 border border-orange-500/30">
                    1
                  </span>
                  <div>
                    <div className="font-semibold text-white">Single-Use Deposit Debit</div>
                    <p className="text-slate-400 text-[11px] mt-0.5">
                      Your wallet sends tokens to an ephemeral 1Click deposit address. No unlimited ERC-20 approvals required.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-md bg-orange-500/15 text-orange-400 font-mono text-[10px] font-bold flex items-center justify-center shrink-0 border border-orange-500/30">
                    2
                  </span>
                  <div>
                    <div className="font-semibold text-white">Solver Matching & Solana Fulfillment</div>
                    <p className="text-slate-400 text-[11px] mt-0.5">
                      NEAR solvers route tokens to Solana USDC and transfer them directly into the FossaPay Master Vault.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-md bg-emerald-500/15 text-emerald-400 font-mono text-[10px] font-bold flex items-center justify-center shrink-0 border border-emerald-500/30">
                    3
                  </span>
                  <div>
                    <div className="font-semibold text-white">Instant Inter-Bank Settlement</div>
                    <p className="text-slate-400 text-[11px] mt-0.5">
                      FossaPay triggers an idempotent Master Payout API call, disbursing Naira over NIBSS to your bank in seconds.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Protocol Guarantees */}
            <div className="p-5 rounded-2xl tender-surface-secondary space-y-2.5 font-mono text-[11px] text-slate-400">
              <div className="flex items-center gap-2 text-slate-200 font-semibold">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>NON-CUSTODIAL & IDEMPOTENT</span>
              </div>
              <p className="text-slate-400 leading-relaxed font-sans text-xs">
                Every payout includes a cryptographic idempotency key preventing double-clearing, with live NUBAN name matching verified before settlement.
              </p>
            </div>
          </div>
        </div>

        {/* Footer Protocol Tags */}
        <div className="mt-12 pt-6 border-t border-white/[0.06] flex flex-wrap items-center justify-between text-xs text-slate-400 gap-4">
          <div className="flex items-center gap-2">
            <span className="cf-badge cf-badge-slate">NEAR PROTOCOL</span>
            <span className="cf-badge cf-badge-slate">CHAIN ABSTRACTION</span>
            <span className="cf-badge cf-badge-orange">SOLANA USDC</span>
            <span className="cf-badge cf-badge-green">FOSSAPAY NGN RAILS</span>
          </div>
          <div className="font-mono text-[11px] text-slate-400">
            ENGINEERED WITH NEAR INTENTS & FOSSAPAY CORE API
          </div>
        </div>
      </main>

      {/* Wallet Connection Modal */}
      <WalletModal
        isOpen={isWalletModalOpen}
        onClose={() => setIsWalletModalOpen(false)}
      />
    </div>
  );
}
