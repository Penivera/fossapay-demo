'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Navbar } from '../components/Navbar';
import { WalletModal } from '../components/WalletModal';
import { OffRampCard } from '../components/OffRampCard';
import { TelemetryTerminal, TelemetryStep } from '../components/TelemetryTerminal';
import { ReceiptModal } from '../components/ReceiptModal';
import { useNear } from '../providers/NearProvider';

type ScreenState = 'input' | 'telemetry' | 'receipt';

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
      status: 'pending',
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
  const [isRetrying, setIsRetrying] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Clean up SSE connection on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const handleInitiate = async (details: any) => {
    try {
      // Step 0: Create Intent Session on Backend
      const createRes = await fetch('/api/intents/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteId: details.quoteId,
          originAsset: details.originAsset,
          amountIn: details.amountIn,
          minReceivedUsdc: details.minReceivedUsdc,
          netNgn: details.netNgn,
          exchangeRateNgn: details.exchangeRateNgn,
          recipient: {
            accountNumber: details.accountNumber,
            accountName: details.accountName,
            bankCode: details.bankCode,
            bankName: details.bankName,
          },
        }),
      });

      const createJson = await createRes.json();
      if (createJson.status !== 'success') {
        throw new Error(createJson.message || 'Failed to initialize session');
      }

      const session = createJson.data;
      const intentId = session.intentId;
      setSessionId(intentId);
      setScreenState('telemetry');
      setProgressPercent(session.progressPercent || 20);

      // Connect SSE stream for real-time telemetry
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const es = new EventSource(`/api/intents/${intentId}/stream`);
      eventSourceRef.current = es;

      es.onmessage = (event) => {
        try {
          const updated = JSON.parse(event.data);
          if (updated.steps) {
            setTelemetrySteps(updated.steps);
          }
          if (updated.progressPercent !== undefined) {
            setProgressPercent(updated.progressPercent);
          }
          if (updated.status === 'payout_completed') {
            es.close();
            setFinalReceipt({
              id: updated.payoutId || `pay_${intentId.slice(4)}`,
              reference: updated.payoutReference || `FP_PAY_${intentId.toUpperCase()}`,
              amount: String(updated.netNgn),
              fee: '50.00',
              recipient: updated.recipient,
              originAsset: updated.originAsset?.symbol || 'USDT',
              originAmount: updated.amountIn,
              nibssSessionId: updated.nibssSessionId || `100004${Date.now()}841`,
              createdAt: updated.updatedAt || new Date().toISOString(),
            });
            setTimeout(() => {
              setScreenState('receipt');
            }, 800);
          }
        } catch (err) {
          console.error('SSE parse error:', err);
        }
      };

      // Prompt Debit from user wallet
      const txHash = await signDebit(details.depositAddress, details.amountIn);

      // Trigger backend execution
      await fetch(`/api/intents/${intentId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ originTxHash: txHash }),
      });
    } catch (err: any) {
      console.error('Offramp flow error:', err);
    }
  };

  const handleRetry = async () => {
    if (!sessionId) return;
    setIsRetrying(true);
    try {
      await fetch(`/api/intents/${sessionId}/retry`, {
        method: 'POST',
      });
    } catch (err) {
      console.error('Retry failed:', err);
    } finally {
      setIsRetrying(false);
    }
  };

  const handleReset = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setScreenState('input');
    setProgressPercent(10);
    setFinalReceipt(null);
    setSessionId('');
  };

  return (
    <div className="min-h-screen bg-[#090d16] bg-ambient-radial text-slate-100 flex flex-col font-sans selection:bg-orange-500/30 selection:text-white relative">
      <div className="absolute inset-0 bg-dot-pattern opacity-40 pointer-events-none" />

      <Navbar onOpenWalletModal={() => setIsWalletModalOpen(true)} />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 lg:py-12 relative z-10">
        <div className="mb-8 lg:mb-12 text-left">
          <div className="flex items-center gap-2 mb-2">
            <span className="cf-kicker">CROSS-CHAIN LIQUIDATION & SETTLEMENT</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white">
            Instant Naira Payouts for Any Web3 Token.
          </h1>
          <p className="mt-3 text-sm sm:text-base text-slate-400 max-w-2xl font-mono">
            NEAR Intents routes cross-chain solver liquidity to FossaPay&apos;s fiat rails.
            Deposit Arbitrum, Base, Ethereum or Solana tokens and receive cleared NGN in your bank account in 12 seconds.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-7 xl:col-span-8 flex justify-center w-full">
            <div className="w-full max-w-xl">
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
                  onRetry={handleRetry}
                  isRetrying={isRetrying}
                />
              )}

              {screenState === 'receipt' && finalReceipt && (
                <ReceiptModal receipt={finalReceipt} onReset={handleReset} />
              )}
            </div>
          </div>

          <div className="lg:col-span-5 xl:col-span-4 space-y-4">
            <div className="cf-card-dark p-6">
              <div className="cf-kicker mb-3">SYSTEM TELEMETRY</div>
              <div className="space-y-3 text-xs font-mono">
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">SOLVER ROUTING</span>
                  <span className="text-slate-200">NEAR 1Click / Defuse</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">FIAT ENGINE</span>
                  <span className="text-orange-400">FossaPay Master Vault</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">SETTLEMENT RAILS</span>
                  <span className="text-emerald-400">NIBSS Instant Payment</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">SECURITY PROTOCOL</span>
                  <span className="text-slate-200">Strict Idempotency</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">AVERAGE SLA</span>
                  <span className="text-slate-200">~12.4 seconds</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <span className="cf-badge cf-badge-slate">NEAR INTENTS</span>
              <span className="cf-badge cf-badge-slate">SOLANA USDC</span>
              <span className="cf-badge cf-badge-orange">FOSSAPAY RAILS</span>
              <span className="cf-badge cf-badge-green">NIBSS INSTANT</span>
            </div>
          </div>
        </div>
      </main>

      <WalletModal
        isOpen={isWalletModalOpen}
        onClose={() => setIsWalletModalOpen(false)}
      />
    </div>
  );
}
