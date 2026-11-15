'use client';

import React, { useState, useEffect, use } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Shield,
  CheckCircle2,
  Clock,
  Truck,
  AlertTriangle,
  RotateCcw,
  Copy,
  Check,
  Building2,
  ArrowRight,
  Upload,
  User,
  Sparkles,
  Lock,
} from 'lucide-react';

interface DealPageProps {
  params: Promise<{ id: string }>;
}

export default function DealPage({ params }: DealPageProps) {
  const { id: dealId } = use(params);
  const searchParams = useSearchParams();
  const sellerToken = searchParams.get('sellerToken');

  const [deal, setDeal] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Buyer Form State
  const [buyerName, setBuyerName] = useState('Chidinma Okonkwo');
  const [buyerPhone, setBuyerPhone] = useState('08011223344');
  const [buyerEmail, setBuyerEmail] = useState('chidinma@example.com');
  const [isInitiating, setIsInitiating] = useState(false);

  // Dispute Form State
  const [isDisputeOpen, setIsDisputeOpen] = useState(false);
  const [disputeReason, setDisputeReason] = useState('Received counterfeit or damaged item. Screen cracked.');
  const [disputePhotoFile, setDisputePhotoFile] = useState<File | null>(null);
  const [isSubmittingDispute, setIsSubmittingDispute] = useState(false);

  // Countdown timer for inspection window
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [copiedAccount, setCopiedAccount] = useState(false);

  // Connect to SSE Stream
  useEffect(() => {
    let es: EventSource | null = null;

    const connectSSE = () => {
      es = new EventSource(`/api/deals/${dealId}/stream`);

      es.onmessage = (event) => {
        try {
          const updated = JSON.parse(event.data);
          setDeal(updated);
          setLoading(false);
        } catch (err) {
          console.error('SSE parse error:', err);
        }
      };

      es.onerror = () => {
        // Fallback fetch if SSE fails
        fetch(`/api/deals/${dealId}`)
          .then((r) => r.json())
          .then((res) => {
            if (res.status === 'success') setDeal(res.data);
            setLoading(false);
          })
          .catch((e) => setError(e.message));
      };
    };

    connectSSE();

    return () => {
      if (es) es.close();
    };
  }, [dealId]);

  // Inspection Window Countdown Clock
  useEffect(() => {
    if (deal?.status === 'INSPECTION_PERIOD' && deal.inspectionExpiresAt) {
      const updateTimer = () => {
        const expiresAt = new Date(deal.inspectionExpiresAt).getTime();
        const now = Date.now();
        const diff = Math.max(0, Math.floor((expiresAt - now) / 1000));
        setRemainingSeconds(diff);
      };

      updateTimer();
      const interval = setInterval(updateTimer, 1000);
      return () => clearInterval(interval);
    } else {
      setRemainingSeconds(null);
    }
  }, [deal?.status, deal?.inspectionExpiresAt]);

  const isSeller = Boolean(sellerToken && deal?.seller?.sellerToken === sellerToken);

  const handleInitiateBuyerCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsInitiating(true);
    try {
      const res = await fetch(`/api/deals/${dealId}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: buyerName,
          phone: buyerPhone,
          email: buyerEmail,
        }),
      });
      const json = await res.json();
      if (json.status === 'success') {
        setDeal(json.data);
      }
    } catch (err) {
      console.error('Checkout error:', err);
    } finally {
      setIsInitiating(false);
    }
  };

  const handleSimulatePayment = async () => {
    await fetch(`/api/deals/${dealId}/simulate-payment`, { method: 'POST' });
  };

  const handleDispatch = async () => {
    await fetch(`/api/deals/${dealId}/dispatch`, { method: 'POST' });
  };

  const handleSimulateDelivery = async () => {
    await fetch(`/api/deals/${dealId}/simulate-delivery`, { method: 'POST' });
  };

  const handleRelease = async () => {
    await fetch(`/api/deals/${dealId}/release`, { method: 'POST' });
  };

  const handleDisputeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingDispute(true);
    try {
      let evidencePhotoUrl: string | undefined = undefined;

      // Handle photo upload if file selected
      if (disputePhotoFile) {
        const formData = new FormData();
        formData.append('photo', disputePhotoFile);
        const uploadRes = await fetch(`/api/deals/${dealId}/upload`, {
          method: 'POST',
          body: formData,
        });
        const uploadJson = await uploadRes.json();
        if (uploadJson.status === 'success') {
          evidencePhotoUrl = uploadJson.data.url;
        }
      }

      await fetch(`/api/deals/${dealId}/dispute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: disputeReason,
          evidencePhotoUrl,
        }),
      });

      setIsDisputeOpen(false);
    } catch (err) {
      console.error('Dispute failed:', err);
    } finally {
      setIsSubmittingDispute(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center font-mono text-sm text-slate-400">
        Loading SafeDeal escrow session...
      </div>
    );
  }

  if (error || !deal) {
    return (
      <div className="p-8 sd-card border-red-500/30 text-center space-y-2">
        <h2 className="text-lg font-bold text-red-400">Deal Not Found</h2>
        <p className="text-xs text-slate-400 font-mono">Reference: {dealId}</p>
      </div>
    );
  }

  const steps = [
    { key: 'WAITING_PAYMENT', label: 'PAYMENT' },
    { key: 'ESCROW_LOCKED', label: 'ESCROW' },
    { key: 'DISPATCHED', label: 'DISPATCH' },
    { key: 'INSPECTION_PERIOD', label: 'INSPECT' },
    { key: 'RELEASED', label: 'SETTLED' },
  ];

  const getStepStatus = (stepKey: string) => {
    const order = ['DRAFT', 'WAITING_PAYMENT', 'ESCROW_LOCKED', 'DISPATCHED', 'INSPECTION_PERIOD', 'RELEASED'];
    const currentIndex = order.indexOf(deal.status === 'DISPUTED' || deal.status === 'REFUNDED' ? 'INSPECTION_PERIOD' : deal.status);
    const stepIndex = order.indexOf(stepKey);

    if (deal.status === 'RELEASED') return 'completed';
    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'active';
    return 'pending';
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Seller Header Notice Banner */}
      {isSeller && (
        <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-between text-xs font-mono text-amber-300">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="font-bold">SELLER DASHBOARD MODE</span>
            <span>(Private authenticated management view)</span>
          </div>
          <span className="text-[10px] text-amber-400/80">TOKEN: {sellerToken?.slice(0, 8)}...</span>
        </div>
      )}

      {/* Main Deal Summary Card */}
      <div className="sd-card p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono text-slate-400">DEAL ID: {deal.id}</span>
              <span
                className={`sd-badge ${
                  deal.status === 'RELEASED'
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : deal.status === 'DISPUTED'
                    ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                    : deal.status === 'REFUNDED'
                    ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                    : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                }`}
              >
                {deal.status.replace('_', ' ')}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">{deal.title}</h1>
            <p className="text-xs text-slate-400 mt-1">{deal.description}</p>
          </div>

          <div className="text-left sm:text-right bg-slate-900/60 p-3 sm:p-0 rounded-xl border sm:border-0 border-slate-800">
            <div className="text-xs font-mono text-slate-400">ESCROW AMOUNT</div>
            <div className="text-3xl font-mono font-extrabold text-white">
              ₦ {Number(deal.price).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] font-mono text-emerald-400">0% Internal Transfer Fee</div>
          </div>
        </div>

        {/* 5-Step Lifecycle Progress Tracker */}
        <div className="py-2">
          <div className="grid grid-cols-5 gap-1.5 sm:gap-2 text-center font-mono text-[10px] sm:text-xs">
            {steps.map((st) => {
              const status = getStepStatus(st.key);
              return (
                <div
                  key={st.key}
                  className={`py-2 px-1 rounded-lg border transition ${
                    status === 'completed'
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 font-bold'
                      : status === 'active'
                      ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 font-bold animate-pulse'
                      : 'bg-slate-900/40 border-slate-800 text-slate-600'
                  }`}
                >
                  <div>{st.label}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* --- DYNAMIC STATE PANELS --- */}

        {/* 1. WAITING_PAYMENT (Buyer needs to pay or generate virtual account) */}
        {deal.status === 'DRAFT' && !isSeller && (
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-700 space-y-4">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-emerald-400">
              <User className="w-4 h-4" />
              <span>STEP 1: ENTER BUYER INFORMATION TO LOCK ESCROW</span>
            </div>
            <form onSubmit={handleInitiateBuyerCheckout} className="space-y-3 font-mono text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Your Full Name</label>
                  <input
                    type="text"
                    required
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">WhatsApp / Phone Number</label>
                  <input
                    type="text"
                    required
                    value={buyerPhone}
                    onChange={(e) => setBuyerPhone(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={isInitiating}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition flex items-center justify-center gap-2"
              >
                <Lock className="w-4 h-4" />
                <span>{isInitiating ? 'GENERATING CHECKOUT...' : 'PROCEED TO PAY INTO ESCROW'}</span>
              </button>
            </form>
          </div>
        )}

        {/* Checkout Dynamic Account Panel */}
        {deal.status === 'WAITING_PAYMENT' && deal.checkout && (
          <div className="p-6 rounded-2xl bg-slate-900 border border-amber-500/40 space-y-4 font-mono text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-amber-400 font-bold">
                <Clock className="w-4 h-4 animate-spin" />
                <span>AWAITING BUYER BANK TRANSFER</span>
              </div>
              <span className="text-slate-400">Expires in 30 mins</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-slate-950 border border-slate-800">
              <div>
                <span className="text-slate-500 block text-[10px]">BANK NAME</span>
                <span className="text-white font-bold text-sm">{deal.checkout.bankName}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">ACCOUNT NUMBER</span>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400 font-extrabold text-lg tracking-wider">
                    {deal.checkout.accountNumber}
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(deal.checkout.accountNumber);
                      setCopiedAccount(true);
                      setTimeout(() => setCopiedAccount(false), 2000);
                    }}
                    className="p-1 text-slate-400 hover:text-white"
                  >
                    {copiedAccount ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">EXACT AMOUNT PAYABLE</span>
                <span className="text-white font-bold text-sm">₦ {Number(deal.checkout.amountPayable).toLocaleString()}</span>
              </div>
            </div>

            {/* Simulated Payment Trigger for Demo */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <span className="text-slate-500 text-[11px]">
                Demo Mode: Click below to simulate instant inter-bank credit
              </span>
              <button
                onClick={handleSimulatePayment}
                className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition text-xs flex items-center gap-2"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>[ SIMULATE BUYER PAYMENT ]</span>
              </button>
            </div>
          </div>
        )}

        {/* 2. ESCROW_LOCKED (Funds safely held; seller authorized to dispatch) */}
        {deal.status === 'ESCROW_LOCKED' && (
          <div className="p-6 rounded-2xl bg-emerald-950/20 border border-emerald-500/40 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white font-mono">
                  ₦ {Number(deal.price).toLocaleString()} SAFELY LOCKED IN ESCROW
                </h3>
                <p className="text-xs text-slate-400">
                  Funds are secured in FossaPay vault. The seller cannot withdraw until goods arrive and buyer approves.
                </p>
              </div>
            </div>

            {/* Seller Action: Mark Dispatched */}
            {isSeller ? (
              <div className="pt-2">
                <button
                  onClick={handleDispatch}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-bold text-xs rounded-xl transition flex items-center justify-center gap-2"
                >
                  <Truck className="w-4 h-4" />
                  <span>MARK PACKAGE AS DISPATCHED VIA COURIER</span>
                </button>
              </div>
            ) : (
              <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 text-xs font-mono text-slate-300">
                Notification dispatched to seller ({deal.seller.name}). Awaiting courier package dispatch.
              </div>
            )}
          </div>
        )}

        {/* 3. DISPATCHED (In transit) */}
        {deal.status === 'DISPATCHED' && (
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-700 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-orange-400">
                <Truck className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white font-mono">ITEM IN TRANSIT WITH COURIER</h3>
                <p className="text-xs text-slate-400">
                  Seller has handed over package. Awaiting delivery drop-off confirmation.
                </p>
              </div>
            </div>

            {/* Demo button to simulate courier drop-off */}
            <div className="pt-2 flex justify-end">
              <button
                onClick={handleSimulateDelivery}
                className="py-2.5 px-4 bg-orange-600 hover:bg-orange-500 text-white font-mono font-bold text-xs rounded-lg transition flex items-center gap-2"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>[ SIMULATE COURIER DROP-OFF ]</span>
              </button>
            </div>
          </div>
        )}

        {/* 4. INSPECTION_PERIOD (Inspection timer active, Buyer can Accept or Dispute) */}
        {deal.status === 'INSPECTION_PERIOD' && (
          <div className="p-6 rounded-2xl bg-slate-900 border border-amber-500/40 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <Clock className="w-5 h-5 text-amber-400 animate-spin" />
                <div>
                  <h3 className="text-sm font-bold text-white font-mono">INSPECTION WINDOW ACTIVE</h3>
                  <p className="text-xs text-slate-400">Please inspect your delivered package.</p>
                </div>
              </div>

              {/* Countdown clock badge */}
              <div className="text-right font-mono">
                <div className="text-xs text-slate-400">AUTO-RELEASE IN:</div>
                <div className="text-xl font-extrabold text-amber-400">
                  {remainingSeconds !== null ? `${remainingSeconds}s` : 'Calculating...'}
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-400 font-mono">
              If no dispute is raised before the countdown reaches zero, the system will automatically release funds to the seller.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={handleRelease}
                className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-bold text-xs transition shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>ACCEPT GOODS & RELEASE FUNDS</span>
              </button>

              <button
                onClick={() => setIsDisputeOpen(true)}
                className="py-3 px-4 rounded-xl bg-red-950/40 hover:bg-red-900/40 border border-red-500/40 text-red-300 font-mono font-bold text-xs transition flex items-center justify-center gap-2"
              >
                <AlertTriangle className="w-4 h-4" />
                <span>RAISE DISPUTE</span>
              </button>
            </div>
          </div>
        )}

        {/* 5. RELEASED (Celebration & Settlement Details) */}
        {deal.status === 'RELEASED' && (
          <div className="p-6 rounded-2xl bg-emerald-950/20 border border-emerald-500/40 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <span className="sd-badge bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] mb-1">
                  TRANSACTION COMPLETED
                </span>
                <h3 className="text-lg font-bold text-white font-mono">FUNDS RELEASED TO SELLER</h3>
                <p className="text-xs text-slate-400">
                  Settled directly into seller commercial bank account ({deal.seller.bankName} - {deal.seller.accountNumber}).
                </p>
              </div>
            </div>

            {deal.releasePayoutRef && (
              <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 flex justify-between items-center text-xs font-mono">
                <span className="text-slate-400">FOSSAPAY PAYOUT REF:</span>
                <span className="text-emerald-400 font-bold">{deal.releasePayoutRef}</span>
              </div>
            )}
          </div>
        )}

        {/* 6. DISPUTED (Admin Mediation View) */}
        {deal.status === 'DISPUTED' && (
          <div className="p-6 rounded-2xl bg-red-950/20 border border-red-500/40 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <span className="sd-badge bg-red-500/15 text-red-400 border border-red-500/30 text-[10px] mb-1">
                  UNDER MEDIATION
                </span>
                <h3 className="text-lg font-bold text-white font-mono">ESCROW FROZEN: DISPUTE PENDING</h3>
                <p className="text-xs text-slate-400">
                  Funds remain locked in escrow until an admin mediator reviews evidence.
                </p>
              </div>
            </div>

            {deal.dispute && (
              <div className="p-4 bg-slate-900 rounded-xl border border-slate-800 space-y-2 text-xs font-mono">
                <div className="text-slate-400">REASON PROVIDED:</div>
                <div className="text-white font-sans">{deal.dispute.reason}</div>
                {deal.dispute.evidencePhotoUrl && (
                  <div className="pt-2">
                    <span className="text-slate-400 block mb-1">EVIDENCE PHOTO:</span>
                    <img
                      src={deal.dispute.evidencePhotoUrl}
                      alt="Dispute evidence"
                      className="max-h-48 rounded-lg border border-slate-700"
                    />
                  </div>
                )}
              </div>
            )}

            <div className="text-xs font-mono text-slate-400">
              Admin mediators can review and resolve this deal at{' '}
              <a href="/admin" className="text-amber-400 underline font-bold">
                /admin
              </a>
            </div>
          </div>
        )}

        {/* 7. REFUNDED */}
        {deal.status === 'REFUNDED' && (
          <div className="p-6 rounded-2xl bg-blue-950/20 border border-blue-500/40 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
                <RotateCcw className="w-6 h-6" />
              </div>
              <div>
                <span className="sd-badge bg-blue-500/15 text-blue-400 border border-blue-500/30 text-[10px] mb-1">
                  DISPUTE RESOLVED
                </span>
                <h3 className="text-lg font-bold text-white font-mono">FUNDS REFUNDED TO BUYER</h3>
                <p className="text-xs text-slate-400">
                  Dispute resolved in favor of the buyer. Full refund disbursed via Master Wallet Payout.
                </p>
              </div>
            </div>

            {deal.refundPayoutRef && (
              <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 flex justify-between items-center text-xs font-mono">
                <span className="text-slate-400">REFUND PAYOUT REF:</span>
                <span className="text-blue-400 font-bold">{deal.refundPayoutRef}</span>
              </div>
            )}
          </div>
        )}

        {/* Audit Timeline History */}
        <div className="pt-4 border-t border-slate-800 space-y-3 font-mono text-xs">
          <div className="text-slate-400 uppercase tracking-wider text-[11px]">AUDIT TRAIL // ESCROW LEDGER</div>
          <div className="space-y-2">
            {deal.history?.map((h: any, idx: number) => (
              <div key={idx} className="flex items-start gap-2.5 text-slate-300">
                <span className="text-emerald-400">✓</span>
                <span className="text-slate-500 text-[10px] whitespace-nowrap">
                  {new Date(h.timestamp).toLocaleTimeString()}
                </span>
                <span>{h.note}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Dispute Modal */}
      {isDisputeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-4 font-mono text-xs shadow-2xl">
            <div className="flex items-center gap-2 text-red-400 font-bold text-sm">
              <AlertTriangle className="w-5 h-5" />
              <span>RAISE ESCROW DISPUTE</span>
            </div>

            <form onSubmit={handleDisputeSubmit} className="space-y-4">
              <div>
                <label className="text-slate-400 block mb-1">Reason for Dispute</label>
                <textarea
                  rows={3}
                  required
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Upload Evidence Photo (Optional)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setDisputePhotoFile(e.target.files?.[0] || null)}
                  className="w-full text-slate-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-slate-800 file:text-slate-200 file:font-mono file:text-xs"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsDisputeOpen(false)}
                  className="flex-1 py-2.5 bg-slate-800 text-slate-300 rounded-lg"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingDispute}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg"
                >
                  {isSubmittingDispute ? 'SUBMITTING...' : 'SUBMIT DISPUTE'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
