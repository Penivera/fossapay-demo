'use client';

import React, { useState, useEffect, use } from 'react';
import {
  Users,
  CheckCircle2,
  Clock,
  Sparkles,
  Copy,
  Check,
  Building2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Zap,
  RefreshCw,
  XCircle,
} from 'lucide-react';

interface RoomPageProps {
  params: Promise<{ id: string }>;
}

export default function RoomPage({ params }: RoomPageProps) {
  const { id: roomId } = use(params);

  const [room, setRoom] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active selected participant for checkout view
  const [selectedParticipantId, setSelectedParticipantId] = useState<string | null>(null);
  const [copiedAccount, setCopiedAccount] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // SSE Stream
  useEffect(() => {
    let es: EventSource | null = null;

    const connectSSE = () => {
      es = new EventSource(`/api/rooms/${roomId}/stream`);

      es.onmessage = (event) => {
        try {
          const updated = JSON.parse(event.data);
          setRoom(updated);
          setLoading(false);
        } catch (err) {
          console.error('SSE parse error:', err);
        }
      };

      es.onerror = () => {
        fetch(`/api/rooms/${roomId}`)
          .then((r) => r.json())
          .then((res) => {
            if (res.status === 'success') setRoom(res.data);
            setLoading(false);
          })
          .catch((e) => setError(e.message));
      };
    };

    connectSSE();

    return () => {
      if (es) es.close();
    };
  }, [roomId]);

  const handleOpenCheckout = async (participantId: string) => {
    setSelectedParticipantId(participantId);
    try {
      const res = await fetch(`/api/rooms/${roomId}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId }),
      });
      const json = await res.json();
      if (json.status === 'success') {
        setRoom(json.data);
      }
    } catch (err) {
      console.error('Checkout creation error:', err);
    }
  };

  const handleRegenerate = async (participantId: string) => {
    try {
      const res = await fetch(`/api/rooms/${roomId}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId }),
      });
      const json = await res.json();
      if (json.status === 'success') {
        setRoom(json.data);
      }
    } catch (err) {
      console.error('Regenerate error:', err);
    }
  };

  const handleSimulatePayment = async (participantId: string) => {
    setIsProcessing(true);
    try {
      await fetch(`/api/rooms/${roomId}/simulate-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId }),
      });
    } catch (err) {
      console.error('Simulate payment error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSimulateExpiry = async (participantId: string) => {
    try {
      await fetch(`/api/rooms/${roomId}/simulate-expiry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId }),
      });
    } catch (err) {
      console.error('Simulate expiry error:', err);
    }
  };

  const handlePartialWithdraw = async () => {
    if (!confirm('Close room and withdraw the currently collected pool to host bank? Non-paying participants will be marked unsettled.')) {
      return;
    }
    setIsProcessing(true);
    try {
      await fetch(`/api/rooms/${roomId}/partial-withdraw`, {
        method: 'POST',
      });
    } catch (err) {
      console.error('Partial withdraw error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center font-mono text-sm text-slate-400">
        Connecting to SquadPay live settlement room...
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="p-8 sq-card border-red-500/30 text-center space-y-2">
        <h2 className="text-lg font-bold text-red-400">Room Not Found</h2>
        <p className="text-xs text-slate-400 font-mono">Reference: {roomId}</p>
      </div>
    );
  }

  const collected = parseFloat(room.collectedAmount) || 0;
  const total = parseFloat(room.totalAmount) || 1;
  const percentCollected = Math.min(100, Math.round((collected / total) * 100));

  const allPaid = room.participants.every((p: any) => p.status === 'paid');

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Pool Progress Header */}
      <div className="sq-card p-6 sm:p-8 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono text-slate-400">ROOM ID: {room.id}</span>
              <span
                className={`sq-badge ${
                  room.status === 'completed'
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : room.status === 'partially_closed'
                    ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                    : 'bg-violet-500/15 text-violet-400 border border-violet-500/30'
                }`}
              >
                {room.status === 'completed' ? 'ALL SETTLED' : room.status === 'partially_closed' ? 'PARTIALLY WITHDRAWN' : 'LIVE SPLIT'}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">{room.title}</h1>
            <p className="text-xs text-slate-400 mt-1 font-mono">
              Organizer: <span className="text-slate-200">{room.host.name}</span> • Settles to {room.host.bankName}
            </p>
          </div>

          <div className="text-left sm:text-right bg-slate-900/60 p-3 sm:p-0 rounded-xl border sm:border-0 border-slate-800 font-mono">
            <div className="text-xs text-slate-400">COLLECTED POOL</div>
            <div className="text-3xl font-extrabold text-white">
              ₦ {Number(room.collectedAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              <span className="text-xs text-slate-500 font-normal"> / ₦ {Number(room.totalAmount).toLocaleString()}</span>
            </div>
            <div className="text-[11px] text-violet-400">{percentCollected}% Collected</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5 font-mono text-xs">
          <div className="flex justify-between text-slate-400 text-[11px]">
            <span>Live Settlement Progress</span>
            <span>{percentCollected}%</span>
          </div>
          <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-800">
            <div
              className={`h-full transition-all duration-500 ${
                allPaid ? 'bg-emerald-500' : 'bg-gradient-to-r from-violet-500 to-emerald-400'
              }`}
              style={{ width: `${percentCollected}%` }}
            />
          </div>
        </div>

        {/* Completed Host Payout Banner */}
        {room.payout && (
          <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/40 flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <span className="font-bold text-white">
                  AUTOMATIC DIRECT SETTLEMENT DISBURSED (₦ {Number(room.payout.amount).toLocaleString()})
                </span>
                <div className="text-slate-400 text-[11px]">
                  Delivered to Host Bank: {room.host.bankName} ({room.host.accountNumber})
                </div>
              </div>
            </div>
            <div className="text-right">
              <span className="text-slate-400 text-[10px] block">PAYOUT REF:</span>
              <span className="text-emerald-400 font-bold">{room.payout.reference}</span>
            </div>
          </div>
        )}
      </div>

      {/* Grid of Participant Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-mono text-slate-400">
          <span className="uppercase tracking-wider font-bold">PARTICIPANT PAYMENT CARDS (CLICK TO PAY)</span>
          <span>{room.participants.filter((p: any) => p.status === 'paid').length} of {room.participants.length} Paid</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {room.participants.map((p: any) => {
            const isPaid = p.status === 'paid';
            const isExpired = p.status === 'expired';
            const isUnsettled = p.status === 'unsettled';
            const isSelected = selectedParticipantId === p.id;

            return (
              <div
                key={p.id}
                className={`p-5 rounded-2xl border transition-all duration-300 relative overflow-hidden ${
                  isPaid
                    ? 'bg-emerald-950/20 border-emerald-500/40 shadow-lg shadow-emerald-950/30'
                    : isExpired
                    ? 'bg-amber-950/20 border-amber-500/40'
                    : isUnsettled
                    ? 'bg-slate-900/40 border-slate-800 opacity-60'
                    : 'bg-slate-900/90 border-slate-700 hover:border-violet-500/50 shadow-md'
                }`}
              >
                {/* Status Glow for Paid */}
                {isPaid && (
                  <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-xl pointer-events-none" />
                )}

                <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                        isPaid
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {p.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">{p.name}</h3>
                      <span className="text-[10px] font-mono text-slate-400">{p.id}</span>
                    </div>
                  </div>

                  <div className="text-right font-mono">
                    <div className="text-base font-extrabold text-white">
                      ₦ {Number(p.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                    <span
                      className={`sq-badge text-[9px] ${
                        isPaid
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : isExpired
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : isUnsettled
                          ? 'bg-slate-800 text-slate-400'
                          : 'bg-violet-500/15 text-violet-300 border border-violet-500/30'
                      }`}
                    >
                      {isPaid ? 'PAID ✓' : isExpired ? 'EXPIRED' : isUnsettled ? 'UNSETTLED' : 'PENDING'}
                    </span>
                  </div>
                </div>

                {/* Paid Details Confirmation */}
                {isPaid && (
                  <div className="pt-3 flex items-center justify-between text-xs font-mono text-emerald-400">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Settled via Bank Transfer</span>
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {p.paidAt ? new Date(p.paidAt).toLocaleTimeString() : 'Confirmed'}
                    </span>
                  </div>
                )}

                {/* Unsettled Notice */}
                {isUnsettled && (
                  <div className="pt-3 text-xs font-mono text-slate-400">
                    Host closed room and withdrew partial pool. This share remains unpaid.
                  </div>
                )}

                {/* Expired Action */}
                {isExpired && (
                  <div className="pt-3 flex items-center justify-between text-xs font-mono">
                    <span className="text-amber-400">30-min window expired.</span>
                    <button
                      onClick={() => handleRegenerate(p.id)}
                      className="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold transition flex items-center gap-1 text-[11px]"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>REGENERATE ACCOUNT</span>
                    </button>
                  </div>
                )}

                {/* Dynamic Checkout Details (When opened or active) */}
                {!isPaid && !isExpired && !isUnsettled && (
                  <div className="pt-3 space-y-3 font-mono text-xs">
                    {p.checkout ? (
                      <div className="p-3.5 rounded-xl bg-slate-950 border border-violet-500/30 space-y-2">
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-slate-400">VIRTUAL ACCOUNT ({p.checkout.bankName})</span>
                          <span className="text-amber-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> 30m
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-lg font-bold text-violet-300 tracking-wider">
                            {p.checkout.accountNumber}
                          </span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(p.checkout.accountNumber);
                              setCopiedAccount(p.id);
                              setTimeout(() => setCopiedAccount(null), 2000);
                            }}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                          >
                            {copiedAccount === p.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                        <div className="text-[10px] text-slate-500">Ref: {p.checkout.reference}</div>

                        {/* Demo Action Buttons */}
                        <div className="pt-2 flex gap-2">
                          <button
                            onClick={() => handleSimulatePayment(p.id)}
                            disabled={isProcessing}
                            className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] transition flex items-center justify-center gap-1.5"
                          >
                            <Sparkles className="w-3 h-3" />
                            <span>[ SIMULATE PAYMENT ]</span>
                          </button>

                          <button
                            onClick={() => handleSimulateExpiry(p.id)}
                            className="py-2 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-amber-300 text-[11px] transition"
                            title="Simulate 30m timeout"
                          >
                            <Clock className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleOpenCheckout(p.id)}
                        className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold transition flex items-center justify-center gap-1.5"
                      >
                        <span>PAY ₦{Number(p.amount).toLocaleString()} SHARE</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Host Controls */}
      <div className="sq-card p-6 border-slate-800 space-y-3 font-mono text-xs">
        <div className="flex items-center justify-between">
          <span className="text-slate-400 font-bold uppercase tracking-wider text-[11px]">
            HOST CONTROLS & EDGE CASE HANDLING
          </span>
          <span className="text-slate-500 text-[10px]">Idempotency Key: squad_payout_{room.id}</span>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
          <p className="text-slate-400 text-xs font-sans">
            If some friends haven&apos;t paid and the outing has ended, the host can close the room and withdraw the collected pool immediately.
          </p>
          {room.status === 'active' && collected > 0 && !allPaid && (
            <button
              onClick={handlePartialWithdraw}
              disabled={isProcessing}
              className="py-2.5 px-4 rounded-xl bg-amber-600/80 hover:bg-amber-500 text-white font-bold text-xs whitespace-nowrap transition"
            >
              WITHDRAW PARTIAL POOL (₦ {Number(room.collectedAmount).toLocaleString()})
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
