'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import {
  Users,
  Calendar,
  CreditCard,
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
  Copy,
  FastForward,
  Play,
  RotateCcw,
  Bell,
  FileText,
  Lock,
  ChevronRight,
  TrendingUp,
  RefreshCw,
} from 'lucide-react';
import { AjoClub, AjoMember, AjoRound, SimulatedDay } from '@/lib/clubStore';

export default function ClubDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [club, setClub] = useState<AjoClub | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // SSE Stream subscription
  useEffect(() => {
    let eventSource: EventSource | null = null;

    const connectSSE = () => {
      eventSource = new EventSource(`/api/clubs/${id}/stream`);

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setClub(data);
          setLoading(false);
        } catch (err) {
          console.error('[SSE] Failed to parse club data:', err);
        }
      };

      eventSource.onerror = () => {
        eventSource?.close();
        // Fallback fetch
        fetch(`/api/clubs/${id}`)
          .then((r) => r.json())
          .then((d) => {
            if (d.status === 'success') {
              setClub(d.data);
              setLoading(false);
            }
          })
          .catch(console.error);
      };
    };

    connectSSE();

    return () => {
      eventSource?.close();
    };
  }, [id]);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  // Actions
  const handleSimulateDeposit = async (memberId: string) => {
    setActionLoading(true);
    try {
      await fetch(`/api/clubs/${id}/simulate-deposit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId }),
      });
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAdvanceDay = async (targetDay: SimulatedDay) => {
    setActionLoading(true);
    try {
      await fetch(`/api/clubs/${id}/advance-time`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetDay }),
      });
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAdvanceRound = async () => {
    setActionLoading(true);
    try {
      await fetch(`/api/clubs/${id}/advance-round`, {
        method: 'POST',
      });
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleResolveDefaulter = async (action: 'wait' | 'disburse-partial') => {
    setActionLoading(true);
    try {
      await fetch(`/api/clubs/${id}/resolve-defaulter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  // Helper to simulate all uncredited members paying
  const handleSimulateAllPay = async () => {
    if (!club) return;
    const currentRound = club.rounds[club.currentRound - 1];
    if (!currentRound) return;

    setActionLoading(true);
    for (const mem of club.members) {
      const alreadyPaid = currentRound.contributions.some((c) => c.memberId === mem.id);
      if (!alreadyPaid) {
        await fetch(`/api/clubs/${id}/simulate-deposit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ memberId: mem.id }),
        });
      }
    }
    setActionLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 font-mono">
        <RefreshCw className="w-5 h-5 animate-spin mr-2 text-emerald-500" /> Loading Ajo Club...
      </div>
    );
  }

  if (!club) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-center space-y-4">
        <p className="text-rose-400 font-bold">Club not found</p>
        <Link href="/" className="px-4 py-2 rounded-xl bg-slate-800 text-white text-xs">
          Return to Clubs
        </Link>
      </div>
    );
  }

  const currentRound = club.rounds[club.currentRound - 1];
  const targetKobo = currentRound ? Number(currentRound.targetPotAmount) : 0;
  const collectedKobo = currentRound ? Number(currentRound.collectedPotAmount) : 0;
  const progressPercent = targetKobo > 0 ? Math.min(100, Math.round((collectedKobo / targetKobo) * 100)) : 0;
  const isHeldDeficit = currentRound?.status === 'HELD_DEFICIT';
  const isFullPot = currentRound?.status === 'POT_FULL' || collectedKobo >= targetKobo;
  const isDisbursed = currentRound?.status === 'DISBURSED' || currentRound?.status === 'DISBURSED_PARTIAL';

  const days: SimulatedDay[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col pb-16">
      {/* Top Navbar */}
      <header className="border-b border-emerald-950 bg-slate-900/90 backdrop-blur sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center font-bold text-white text-sm"
            >
              AS
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-base sm:text-lg text-white tracking-tight">{club.name}</h1>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-mono border border-emerald-500/20">
                  {club.status}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono">
                Round {club.currentRound} of {club.totalRounds} • ₦{Number(club.contributionAmount).toLocaleString('en-NG')}/week
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {club.members.length < club.totalRounds && (
              <Link
                href={`/club/${club.id}/join`}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white transition shadow-sm"
              >
                + Join ({club.members.length}/{club.totalRounds})
              </Link>
            )}
            <button
              onClick={() => handleCopy(`${window.location.origin}/club/${club.id}/join`, 'invite')}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-mono transition flex items-center gap-1.5"
            >
              <Copy className="w-3.5 h-3.5" />
              {copiedText === 'invite' ? 'Copied Link!' : 'Invite Link'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl w-full mx-auto px-4 py-8 space-y-8 flex-1">
        {/* Simulation Control Panel ("Time Machine") */}
        <section className="p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/60 border border-emerald-800/40 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <FastForward className="w-5 h-5 text-emerald-400" />
              <div>
                <h2 className="font-bold text-white text-sm">Demo Simulation Desk (Time Machine)</h2>
                <p className="text-xs text-slate-400">Advance the day, trigger member payments, and simulate Friday disbursals</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 font-mono text-xs text-slate-400">
              <span>Simulated Day:</span>
              <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                {club.simulatedDay}
              </span>
            </div>
          </div>

          {/* Days buttons & Actions */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs font-mono text-slate-400 mr-1">Advance Day:</span>
            {days.map((day) => (
              <button
                key={day}
                onClick={() => handleAdvanceDay(day)}
                disabled={actionLoading}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono font-semibold transition ${
                  club.simulatedDay === day
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/40'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                }`}
              >
                {day}
              </button>
            ))}

            <div className="h-4 w-[1px] bg-slate-800 mx-2 hidden sm:block" />

            <button
              onClick={handleSimulateAllPay}
              disabled={actionLoading || isDisbursed}
              className="px-3.5 py-1.5 rounded-xl bg-teal-800/70 hover:bg-teal-700 text-teal-200 text-xs font-semibold font-mono transition flex items-center gap-1.5 disabled:opacity-50"
            >
              <CreditCard className="w-3.5 h-3.5" /> Simulate All 5 Pay
            </button>

            {isDisbursed && club.currentRound < club.totalRounds && (
              <button
                onClick={handleAdvanceRound}
                disabled={actionLoading}
                className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold font-mono transition flex items-center gap-1.5 shadow-md shadow-emerald-900/40"
              >
                Advance to Round #{club.currentRound + 1} <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Defaulter / Deficit Warning Banner */}
          {isHeldDeficit && (
            <div className="p-4 rounded-2xl bg-amber-950/70 border border-amber-600/60 space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-amber-200">
                    Disbursal Held! Deficit Detected on Friday
                  </h4>
                  <p className="text-xs text-amber-300/80 leading-relaxed">
                    Not all members contributed for Round #{club.currentRound}. The lump sum pot is incomplete (
                    ₦{Number(currentRound.collectedPotAmount).toLocaleString('en-NG')} of ₦{Number(currentRound.targetPotAmount).toLocaleString('en-NG')}).
                    Automated SMS reminders have been logged. As Club Admin, choose how to proceed:
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  onClick={() => handleResolveDefaulter('wait')}
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-amber-600/50 text-amber-200 text-xs font-bold font-mono transition"
                >
                  Option A: Wait for Defaulter
                </button>
                <button
                  onClick={() => handleResolveDefaulter('disburse-partial')}
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 text-xs font-bold font-mono transition shadow"
                >
                  Option B: Disburse Partial Pot (₦{Number(currentRound.collectedPotAmount).toLocaleString('en-NG')})
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Active Round Card */}
        {currentRound && (
          <section className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-mono text-emerald-400 uppercase tracking-wider block mb-1">
                  Active Cycle
                </span>
                <h3 className="text-2xl font-black text-white">
                  Round #{currentRound.roundNumber} Pot:{' '}
                  <span className="text-emerald-400">
                    ₦{Number(currentRound.collectedPotAmount).toLocaleString('en-NG')}
                  </span>
                  <span className="text-slate-500 font-normal text-lg">
                    {' '}/ ₦{Number(currentRound.targetPotAmount).toLocaleString('en-NG')}
                  </span>
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`text-xs px-3 py-1 rounded-full font-mono font-bold border ${
                    isDisbursed
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : isHeldDeficit
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : isFullPot
                      ? 'bg-teal-500/20 text-teal-300 border-teal-500/40'
                      : 'bg-slate-800 text-slate-300 border-slate-700'
                  }`}
                >
                  {currentRound.status}
                </span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                <span>Contribution Progress</span>
                <span className="font-bold text-white">{progressPercent}%</span>
              </div>
              <div className="w-full h-3 rounded-full bg-slate-950 overflow-hidden border border-slate-800">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Recipient Details */}
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4 font-mono text-xs">
              <div>
                <span className="text-slate-500 block text-[11px]">Round #{currentRound.roundNumber} Designated Beneficiary</span>
                <span className="font-bold text-white text-sm">{currentRound.recipientName}</span>
                {isDisbursed && currentRound.payoutTxHash && (
                  <span className="text-[11px] text-emerald-400 block mt-0.5">
                    NIBSS Settlement Session: {currentRound.payoutTxHash}
                  </span>
                )}
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Idempotency Payout Key</span>
                <span className="text-xs text-slate-300">
                  ajo_payout_{club.id}_round{currentRound.roundNumber}
                </span>
              </div>
            </div>
          </section>
        )}

        {/* 5-Round Rotation Schedule */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-emerald-400" /> 5-Round Rotation Schedule
            </h3>
            <span className="text-xs text-slate-400 font-mono">1 Recipient Per Week</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            {club.rounds.map((round) => {
              const isCurrent = round.roundNumber === club.currentRound;
              const isDone = round.status === 'DISBURSED' || round.status === 'DISBURSED_PARTIAL';
              return (
                <div
                  key={round.roundNumber}
                  className={`p-4 rounded-2xl border transition flex flex-col justify-between space-y-3 ${
                    isCurrent
                      ? 'bg-emerald-950/40 border-emerald-500/70 shadow-lg shadow-emerald-950/50'
                      : isDone
                      ? 'bg-slate-900/40 border-slate-800 opacity-80'
                      : 'bg-slate-900/60 border-slate-800/70'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-emerald-400">
                        Round {round.roundNumber}
                      </span>
                      {isDone && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                    </div>
                    <p className="text-xs font-bold text-white truncate" title={round.recipientName}>
                      {round.recipientName}
                    </p>
                  </div>

                  <div className="font-mono text-[11px] space-y-1 border-t border-slate-800/80 pt-2">
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Pot:</span>
                      <span className="text-white font-semibold">
                        ₦{Number(round.targetPotAmount).toLocaleString('en-NG')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Status:</span>
                      <span
                        className={`font-semibold ${
                          isDone
                            ? 'text-emerald-400'
                            : round.status === 'HELD_DEFICIT'
                            ? 'text-amber-400'
                            : 'text-slate-300'
                        }`}
                      >
                        {round.status === 'WAITING_CONTRIBUTIONS' ? 'Collecting' : round.status}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Members & Dedicated Accounts Grid */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-400" /> Club Members & Permanent Dedicated Accounts
              </h3>
              <p className="text-xs text-slate-400">
                Each member holds a dedicated Providus Bank NUBAN for recurring weekly deposits
              </p>
            </div>
            <span className="text-xs font-mono text-slate-400">
              {club.members.length} / {club.totalRounds} Verified
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {club.members.map((member) => {
              const contribution = currentRound?.contributions.find((c) => c.memberId === member.id);
              const hasContributed = !!contribution;

              return (
                <div
                  key={member.id}
                  className={`p-5 rounded-2xl border transition flex flex-col justify-between space-y-4 ${
                    hasContributed
                      ? 'bg-slate-900/90 border-emerald-500/40 shadow-sm'
                      : 'bg-slate-900/60 border-slate-800'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-sm text-white">{member.name}</h4>
                        <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-mono mt-0.5">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>KYC Verified (...{member.bvnOrNinLast4})</span>
                        </div>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-mono">
                        Slot #{member.rotationPosition}
                      </span>
                    </div>

                    {/* Dedicated Account Card */}
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1 font-mono text-xs">
                      <div className="flex items-center justify-between text-slate-400">
                        <span>Permanent Dedicated NUBAN</span>
                        <button
                          onClick={() => handleCopy(member.dedicatedAccountNumber, member.id)}
                          className="hover:text-white transition"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-sm font-bold text-white tracking-wider">
                        {member.dedicatedAccountNumber}
                      </p>
                      <p className="text-[11px] text-slate-500">{member.dedicatedBankName}</p>
                    </div>

                    {/* Payout Bank Info */}
                    <div className="text-[11px] text-slate-400 font-mono">
                      <span>Payout Target: </span>
                      <span className="text-slate-200">
                        {member.payoutBankName} ({member.payoutAccountNumber})
                      </span>
                    </div>
                  </div>

                  {/* Contribution Status & Action */}
                  <div className="border-t border-slate-800/80 pt-3 flex items-center justify-between gap-2">
                    <div>
                      {hasContributed ? (
                        <span className="inline-flex items-center gap-1 text-xs font-mono text-emerald-400 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Paid (₦{Number(contribution.amount).toLocaleString('en-NG')})
                        </span>
                      ) : (
                        <span className="text-xs font-mono text-amber-400 font-semibold">
                          Pending Round {club.currentRound}
                        </span>
                      )}
                    </div>

                    {!hasContributed && !isDisbursed && (
                      <button
                        onClick={() => handleSimulateDeposit(member.id)}
                        disabled={actionLoading}
                        className="px-3 py-1 rounded-lg bg-emerald-600/80 hover:bg-emerald-500 text-white font-mono text-xs transition"
                      >
                        Simulate Deposit
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Dual Column: Audit Ledger & Reminder Log */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Audit Ledger */}
          <section className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-400" /> Immutable Audit Ledger
              </h3>
              <span className="text-xs font-mono text-slate-500">
                {club.auditLedger.length} events
              </span>
            </div>

            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {club.auditLedger.slice().reverse().map((entry) => (
                <div
                  key={entry.id}
                  className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/70 text-xs space-y-1 font-mono"
                >
                  <div className="flex items-center justify-between text-slate-500 text-[10px]">
                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-emerald-300">
                      {entry.type}
                    </span>
                    <span>{new Date(entry.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <p className="text-slate-300 text-[11px] leading-relaxed">{entry.description}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Automated Reminders Log */}
          <section className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Bell className="w-4 h-4 text-teal-400" /> Notification & Reminder Log
              </h3>
              <span className="text-xs font-mono text-slate-500">
                {club.reminderLog.length} alerts
              </span>
            </div>

            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {club.reminderLog.length === 0 ? (
                <p className="text-xs text-slate-500 p-4 text-center font-mono">
                  No automated alerts triggered yet. Reminders are dispatched when members default.
                </p>
              ) : (
                club.reminderLog.slice().reverse().map((rem) => (
                  <div
                    key={rem.id}
                    className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/70 text-xs space-y-1 font-mono"
                  >
                    <div className="flex items-center justify-between text-slate-500 text-[10px]">
                      <span className="px-1.5 py-0.5 rounded bg-teal-950 text-teal-300">
                        {rem.channel} • Round {rem.roundNumber}
                      </span>
                      <span>{new Date(rem.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-slate-300 text-[11px] leading-relaxed">{rem.message}</p>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
