'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Intro, Points, Stage } from '@fossapay/ui';
import { OffRampCard } from '../components/OffRampCard';
import { TelemetryTerminal, TelemetryStep } from '../components/TelemetryTerminal';
import { ReceiptModal } from '../components/ReceiptModal';
import { useNear } from '../providers/NearProvider';

type ScreenState = 'input' | 'telemetry' | 'receipt';

export default function OffRampPage() {
  const [screenState, setScreenState] = useState<ScreenState>('input');
  const { signDebit } = useNear();

  // Active Execution Telemetry
  const [sessionId, setSessionId] = useState('');
  const [progressPercent, setProgressPercent] = useState(10);
  const [telemetrySteps, setTelemetrySteps] = useState<TelemetryStep[]>([
    {
      id: 1,
      label: 'Origin Transaction Broadcast',
      detail: 'Awaiting wallet authorization...',
      status: 'pending',
    },
    {
      id: 2,
      label: 'Solver Match & Intent Execution',
      detail: 'Routing cross-chain liquidation to Solana USDC',
      status: 'pending',
    },
    {
      id: 3,
      label: 'FossaPay Fiat Disbursement',
      detail: 'Initiating payout from FossaPay master wallet',
      status: 'pending',
    },
    {
      id: 4,
      label: 'Bank Settlement (NIBSS)',
      detail: 'Clearing to recipient commercial bank account',
      status: 'pending',
    },
  ]);

  // Settled Receipt
  const [finalReceipt, setFinalReceipt] = useState<any>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const basePath = typeof window !== 'undefined' && window.location.pathname.startsWith('/near-offramp') ? '/near-offramp' : '';

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
      const createRes = await fetch(`${basePath}/api/intents/create`, {
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
            }, 600);
          }
        } catch (err) {
          console.error('SSE parse error:', err);
        }
      };

      // Prompt Debit from user wallet
      const txHash = await signDebit(details.depositAddress, details.amountIn);

      // Trigger backend execution
      await fetch(`${basePath}/api/intents/${intentId}/execute`, {
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
      await fetch(`${basePath}/api/intents/${sessionId}/retry`, {
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
    <Stage
      intro={
        <Intro
          title={
            <>
              Crypto in.
              <br />
              <span className="text-brand">Naira out.</span>
            </>
          }
          lead="Sell tokens from any major chain and receive naira in a Nigerian bank account within minutes."
        >
          <Points
            items={[
              'Pay from Arbitrum, Base, Ethereum, Solana or NEAR',
              'Account name verified with the bank before you send',
              'Paid out by FossaPay, safe to retry, never sent twice',
            ]}
          />
        </Intro>
      }
    >
      {screenState === 'input' && <OffRampCard onInitiate={handleInitiate} />}

      {screenState === 'telemetry' && (
        <TelemetryTerminal steps={telemetrySteps} progressPercent={progressPercent} sessionId={sessionId} onRetry={handleRetry} isRetrying={isRetrying} />
      )}

      {screenState === 'receipt' && finalReceipt && <ReceiptModal receipt={finalReceipt} onReset={handleReset} />}
    </Stage>
  );
}
