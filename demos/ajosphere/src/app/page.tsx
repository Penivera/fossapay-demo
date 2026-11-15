'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck,
  CreditCard,
  Users,
  Calendar,
  ArrowRight,
  Plus,
  Lock,
  Sparkles,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';

interface ClubSummary {
  id: string;
  name: string;
  contributionAmount: string;
  totalRounds: number;
  currentRound: number;
  status: string;
  members: Array<{ id: string; name: string }>;
  rounds: Array<{ roundNumber: number; status: string }>;
}

export default function AjoHomePage() {
  const router = useRouter();
  const [clubs, setClubs] = useState<ClubSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    contributionAmount: '20000',
    totalRounds: '5',
  });
  const [error, setError] = useState<string | null>(null);

  const fetchClubs = async () => {
    try {
      const res = await fetch('/api/clubs');
      const data = await res.json();
      if (data.status === 'success') {
        setClubs(data.data);
      }
    } catch (err) {
      console.error('Failed to load clubs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClubs();
  }, []);

  const handleCreateClub = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsCreating(true);

    try {
      const res = await fetch('/api/clubs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          contributionAmount: formData.contributionAmount,
          totalRounds: Number(formData.totalRounds),
        }),
      });

      const data = await res.json();
      if (data.status === 'success') {
        router.push(`/club/${data.data.id}`);
      } else {
        setError(data.message || 'Failed to create club');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navigation */}
      <header className="border-b border-emerald-900/40 bg-slate-900/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center font-bold text-white shadow-lg shadow-emerald-900/40">
              AS
            </div>
            <div>
              <span className="font-bold text-xl tracking-tight text-white flex items-center gap-2">
                AjoSphere
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono border border-emerald-500/30">
                  Esusu 2.0
                </span>
              </span>
              <p className="text-xs text-slate-400">Digital Rotating Savings & Credit Club</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 font-mono hidden sm:inline">
              Powered by FossaPay APIs
            </span>
            <a
              href="#create"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-semibold transition flex items-center gap-1.5 shadow-md shadow-emerald-900/30"
            >
              <Plus className="w-4 h-4" /> Create Club
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-10 space-y-12">
        <section className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-950/80 border border-emerald-700/50 text-emerald-300 text-xs font-mono mb-2">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" /> Automated Nigerian Rotating Savings
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white">
            Trustworthy Ajo with{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400">
              Verified Identities
            </span>{' '}
            and Dedicated NUBANs
          </h1>
          <p className="text-slate-300 text-base sm:text-lg leading-relaxed">
            Eliminate cash theft, manual bookkeeping, and untraceable defaulters. Every member is verified via
            official BVN/NIN checks, gets a permanent virtual account, and collects automated Friday disbursals.
          </p>
        </section>

        {/* Feature Grid */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-emerald-500/40 transition group">
            <div className="w-12 h-12 rounded-xl bg-emerald-950 border border-emerald-700/50 flex items-center justify-center text-emerald-400 mb-4 group-hover:scale-110 transition">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Official KYC Verification</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Every member verifies their identity using BVN or NIN. Name matching prevents pseudonym fraud.
              Full identity numbers are never stored—only cryptographic hashes and last 4 digits.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-emerald-500/40 transition group">
            <div className="w-12 h-12 rounded-xl bg-teal-950 border border-teal-700/50 flex items-center justify-center text-teal-400 mb-4 group-hover:scale-110 transition">
              <CreditCard className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Permanent Dedicated Accounts</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Members receive a permanent Providus Bank NUBAN. They can set up recurring scheduled transfers
              from any Nigerian bank app. Webhooks auto-credit each round instantly.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-emerald-500/40 transition group">
            <div className="w-12 h-12 rounded-xl bg-cyan-950 border border-cyan-700/50 flex items-center justify-center text-cyan-400 mb-4 group-hover:scale-110 transition">
              <Calendar className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Automated Friday Disbursals</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              The full lump sum pot is collected Monday to Thursday and disbursed directly into the designated
              member&apos;s personal bank account on Friday with strict idempotency keys.
            </p>
          </div>
        </section>

        {/* Existing Clubs */}
        <section className="space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-2xl font-bold text-white">Active Savings Clubs</h2>
              <p className="text-slate-400 text-sm">Join an existing club or manage ongoing rotation cycles</p>
            </div>
            <button
              onClick={fetchClubs}
              className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 transition"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-500 font-mono">Loading clubs...</div>
          ) : clubs.length === 0 ? (
            <div className="p-8 text-center bg-slate-900/40 border border-slate-800 rounded-2xl text-slate-400">
              No active clubs found. Create your first club below!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {clubs.map((club) => {
                const totalPot = (Number(club.contributionAmount) * club.totalRounds).toLocaleString('en-NG');
                const isFull = club.members.length >= club.totalRounds;
                return (
                  <div
                    key={club.id}
                    className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 hover:border-emerald-500/50 transition flex flex-col justify-between space-y-4"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="text-xl font-bold text-white">{club.name}</h3>
                        <span className="text-xs px-2.5 py-1 rounded-full font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          Round {club.currentRound}/{club.totalRounds}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3 my-4 p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 font-mono text-xs">
                        <div>
                          <span className="text-slate-500 block">Weekly Contribution</span>
                          <span className="font-semibold text-emerald-400 text-sm">
                            ₦{Number(club.contributionAmount).toLocaleString('en-NG')}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Round Lump Sum Pot</span>
                          <span className="font-semibold text-white text-sm">₦{totalPot}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Members Joined</span>
                          <span className="font-semibold text-slate-200">
                            {club.members.length} / {club.totalRounds}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Club Status</span>
                          <span className="font-semibold text-emerald-400">{club.status}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 pt-2">
                      <Link
                        href={`/club/${club.id}`}
                        className="flex-1 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm transition text-center flex items-center justify-center gap-2"
                      >
                        View Dashboard <ArrowRight className="w-4 h-4" />
                      </Link>
                      {!isFull && (
                        <Link
                          href={`/club/${club.id}/join`}
                          className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition text-center shadow-md shadow-emerald-900/30"
                        >
                          Join Club
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Create Club Section */}
        <section id="create" className="p-8 rounded-3xl bg-slate-900/90 border border-emerald-900/50 shadow-2xl space-y-6">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Plus className="w-5 h-5 text-emerald-400" /> Start a New Ajo Club
            </h2>
            <p className="text-slate-400 text-sm">
              Define the weekly contribution amount and member rotation duration
            </p>
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleCreateClub} className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300">Club Name</label>
              <input
                type="text"
                placeholder="e.g. Lagos Tech Founders Ajo"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-white text-sm outline-none transition"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300">Weekly Contribution (NGN)</label>
              <input
                type="number"
                min="1000"
                step="1000"
                value={formData.contributionAmount}
                onChange={(e) => setFormData({ ...formData, contributionAmount: e.target.value })}
                required
                className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-white text-sm outline-none transition font-mono"
              />
              <span className="text-[11px] text-slate-500">Each member contributes this weekly</span>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300">Total Members / Rounds</label>
              <input
                type="number"
                min="2"
                max="20"
                value={formData.totalRounds}
                onChange={(e) => setFormData({ ...formData, totalRounds: e.target.value })}
                required
                className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-white text-sm outline-none transition font-mono"
              />
              <span className="text-[11px] text-slate-500">e.g. 5 weeks rotation cycle</span>
            </div>

            <div className="md:col-span-3 pt-2">
              <button
                type="submit"
                disabled={isCreating}
                className="w-full sm:w-auto px-8 py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-emerald-900/40 transition flex items-center justify-center gap-2"
              >
                {isCreating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Creating Club...
                  </>
                ) : (
                  <>Create Savings Club</>
                )}
              </button>
            </div>
          </form>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 AjoSphere. Built on FossaPay Financial Infrastructure.</p>
          <div className="flex items-center gap-4 text-slate-400">
            <span>Deterministic Mock Mode</span>
            <span>•</span>
            <span>Timing-safe HMAC-SHA256</span>
            <span>•</span>
            <span>Zero Plaintext BVN/NIN Storage</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
