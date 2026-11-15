'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck,
  CreditCard,
  UserCheck,
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Copy,
  Lock,
  RefreshCw,
} from 'lucide-react';

interface Bank {
  code: string;
  name: string;
}

export default function JoinClubPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [banks, setBanks] = useState<Bank[]>([]);
  const [banksLoading, setBanksLoading] = useState(true);

  // Form state
  const [kycMethod, setKycMethod] = useState<'BVN' | 'NIN'>('BVN');
  const [identityNumber, setIdentityNumber] = useState('22233344455');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [bankCode, setBankCode] = useState('058'); // Default GTBank
  const [accountNumber, setAccountNumber] = useState('9988776655');

  // Account resolution
  const [resolvingAccount, setResolvingAccount] = useState(false);
  const [resolvedAccountName, setResolvedAccountName] = useState<string | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [joinedSuccess, setJoinedSuccess] = useState<any | null>(null);

  useEffect(() => {
    fetch('/api/banks')
      .then((r) => r.json())
      .then((data) => {
        if (data.status === 'success') {
          setBanks(data.data);
          if (data.data.length > 0 && !bankCode) {
            setBankCode(data.data[0].code);
          }
        }
      })
      .catch(console.error)
      .finally(() => setBanksLoading(false));
  }, []);

  // Auto-resolve account name when 10 digits entered
  useEffect(() => {
    const cleanAcct = accountNumber.replace(/\D/g, '');
    if (cleanAcct.length === 10 && bankCode) {
      setResolvingAccount(true);
      setResolveError(null);
      fetch('/api/banks/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountNumber: cleanAcct, bankCode }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.status === 'success') {
            setResolvedAccountName(data.data.accountName);
          } else {
            setResolvedAccountName(null);
            setResolveError(data.message || 'Could not resolve account');
          }
        })
        .catch(() => {
          setResolvedAccountName(null);
          setResolveError('Failed to resolve account name');
        })
        .finally(() => setResolvingAccount(false));
    } else {
      setResolvedAccountName(null);
    }
  }, [accountNumber, bankCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);

    try {
      const res = await fetch(`/api/clubs/${id}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kycMethod,
          identityNumber: identityNumber.trim(),
          accountNumber: accountNumber.trim(),
          bankCode,
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (data.status === 'success') {
        setJoinedSuccess(data.data);
      } else {
        setSubmitError(data.message || 'Failed to join club');
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <Link
          href={`/club/${id}`}
          className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-white transition font-mono"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Club Dashboard
        </Link>

        {joinedSuccess ? (
          <div className="p-8 rounded-3xl bg-slate-900 border border-emerald-500/50 shadow-2xl space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-950 border border-emerald-500/50 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Identity Verified & Joined!</h1>
                <p className="text-xs text-emerald-400 font-mono">
                  Welcome to {joinedSuccess.club.name}
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-800/60 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Verified Member</span>
                <span className="text-sm font-bold text-white">{joinedSuccess.member.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Rotation Slot</span>
                <span className="text-sm font-mono font-bold text-emerald-400">
                  Position #{joinedSuccess.member.rotationPosition} (Collects in Round #{joinedSuccess.member.rotationPosition})
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">KYC Hash (Last 4)</span>
                <span className="text-xs font-mono text-slate-300">
                  ...{joinedSuccess.member.bvnOrNinLast4}
                </span>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-400 block">Your Permanent Dedicated NUBAN</span>
                  <span className="text-lg font-mono font-bold text-white tracking-wider">
                    {joinedSuccess.member.dedicatedAccountNumber}
                  </span>
                  <span className="text-xs text-slate-500 block">
                    {joinedSuccess.member.dedicatedBankName}
                  </span>
                </div>
                <button
                  onClick={() => navigator.clipboard.writeText(joinedSuccess.member.dedicatedAccountNumber)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 flex items-center gap-1 transition"
                >
                  <Copy className="w-3.5 h-3.5" /> Copy
                </button>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed border-t border-slate-800/80 pt-2">
                Save this account in your banking app. Transfer{' '}
                <strong className="text-white">₦{Number(joinedSuccess.club.contributionAmount).toLocaleString('en-NG')}</strong>{' '}
                every Monday to Thursday to fund your rotation rounds automatically.
              </p>
            </div>

            <button
              onClick={() => router.push(`/club/${id}`)}
              className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition shadow-lg shadow-emerald-900/30"
            >
              Enter Club Dashboard
            </button>
          </div>
        ) : (
          <div className="p-8 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl space-y-6">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-700/50 text-emerald-300 text-xs font-mono mb-2">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Automated Onboarding
              </div>
              <h1 className="text-2xl font-bold text-white">Join Ajo Club</h1>
              <p className="text-slate-400 text-xs">
                To guarantee zero defaulters and fraud protection, your identity is verified against your payout bank account.
              </p>
            </div>

            {submitError && (
              <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{submitError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Step 1: KYC */}
              <div className="space-y-4 p-5 rounded-2xl bg-slate-950/60 border border-slate-800/80">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-emerald-400" /> 1. Official Identity Verification (KYC)
                </h3>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setKycMethod('BVN')}
                    className={`py-2.5 rounded-xl text-xs font-semibold border transition ${
                      kycMethod === 'BVN'
                        ? 'bg-emerald-950 border-emerald-500 text-emerald-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    Bank Verification Number (BVN)
                  </button>
                  <button
                    type="button"
                    onClick={() => setKycMethod('NIN')}
                    className={`py-2.5 rounded-xl text-xs font-semibold border transition ${
                      kycMethod === 'NIN'
                        ? 'bg-emerald-950 border-emerald-500 text-emerald-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    National Identity Number (NIN)
                  </button>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">
                    11-digit {kycMethod}
                  </label>
                  <input
                    type="text"
                    maxLength={11}
                    value={identityNumber}
                    onChange={(e) => setIdentityNumber(e.target.value.replace(/\D/g, ''))}
                    placeholder="e.g. 22233344455"
                    required
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 focus:border-emerald-500 text-white font-mono text-sm outline-none"
                  />
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500 pt-1">
                    <Lock className="w-3 h-3 text-emerald-500" />
                    <span>Never stored in plain text. Securely hashed using SHA-256.</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">Email (Optional)</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">Phone (Optional)</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="08012345678"
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Step 2: Payout Account */}
              <div className="space-y-4 p-5 rounded-2xl bg-slate-950/60 border border-slate-800/80">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-teal-400" /> 2. Personal Payout Bank Account
                </h3>
                <p className="text-[11px] text-slate-400">
                  This is the account where your lump sum pot will be automatically disbursed when your round arrives.
                </p>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">Bank</label>
                    <select
                      value={bankCode}
                      onChange={(e) => setBankCode(e.target.value)}
                      disabled={banksLoading}
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs outline-none"
                    >
                      {banks.map((b) => (
                        <option key={b.code} value={b.code}>
                          {b.name} ({b.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">10-Digit Account Number</label>
                    <input
                      type="text"
                      maxLength={10}
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
                      placeholder="0123456789"
                      required
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 focus:border-teal-500 text-white font-mono text-sm outline-none"
                    />
                  </div>

                  {/* NUBAN Resolved Badge */}
                  {resolvingAccount && (
                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-400 flex items-center gap-2 font-mono">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-teal-400" /> Resolving NUBAN account name...
                    </div>
                  )}

                  {resolvedAccountName && (
                    <div className="p-3 rounded-xl bg-teal-950/50 border border-teal-800/60 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-slate-400 block text-[10px]">Account Holder Name</span>
                        <span className="font-bold text-white tracking-wide">{resolvedAccountName}</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 font-mono text-[10px] border border-teal-500/30">
                        Resolved
                      </span>
                    </div>
                  )}

                  {resolveError && (
                    <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-800 text-xs text-rose-300 font-mono">
                      {resolveError}
                    </div>
                  )}
                </div>
              </div>

              {/* Submit CTA */}
              <button
                type="submit"
                disabled={submitting || resolvingAccount}
                className="w-full py-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-sm transition shadow-lg shadow-emerald-900/30 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Verifying Identity & Generating Account...
                  </>
                ) : (
                  <>Complete KYC & Join Club</>
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
