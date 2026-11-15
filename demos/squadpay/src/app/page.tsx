'use client';

import React, { useState, useEffect } from 'react';
import { Users, Split, ShieldCheck, CheckCircle2, ArrowRight, Plus, Trash2, Building2, AlertCircle, Copy, Check } from 'lucide-react';

interface Bank {
  name: string;
  code: string;
}

export default function CreateRoomPage() {
  const [title, setTitle] = useState('Dinner at Cactus Restaurant');
  const [totalAmount, setTotalAmount] = useState('60000');
  const [splitMode, setSplitMode] = useState<'equal' | 'itemized'>('equal');

  // Equal Split Participants
  const [equalFriends, setEqualFriends] = useState<string[]>([
    'Tunde Balogun (Host)',
    'Friend A',
    'Friend B',
    'Friend C',
  ]);

  // Itemized Split Participants
  const [itemizedParticipants, setItemizedParticipants] = useState<Array<{ name: string; amount: string }>>([
    { name: 'Tunde Balogun (Host)', amount: '15000' },
    { name: 'Friend A', amount: '15000' },
    { name: 'Friend B', amount: '15000' },
    { name: 'Friend C', amount: '15000' },
  ]);

  // Host Bank Details
  const [banks, setBanks] = useState<Bank[]>([]);
  const [bankCode, setBankCode] = useState('058');
  const [accountNumber, setAccountNumber] = useState('9988776655');
  const [accountName, setAccountName] = useState('TUNDE BALOGUN');
  const [hostPhone, setHostPhone] = useState('08099887766');
  const [isResolving, setIsResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  const [createdRoom, setCreatedRoom] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Load Banks
  useEffect(() => {
    fetch('/api/banks')
      .then((r) => r.json())
      .then((res) => {
        if (res.status === 'success' && Array.isArray(res.data)) {
          setBanks(res.data);
          if (res.data.length > 0 && !bankCode) {
            setBankCode(res.data[0].code);
          }
        }
      })
      .catch(console.error);
  }, []);

  // Bank Resolution
  useEffect(() => {
    if (accountNumber.length !== 10 || !bankCode) {
      setAccountName('');
      return;
    }

    let isCurrent = true;
    setIsResolving(true);
    setResolveError(null);

    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/banks/resolve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accountNumber, bankCode }),
        });
        const json = await res.json();
        if (isCurrent) {
          if (json.status === 'success' && json.data?.accountName) {
            setAccountName(json.data.accountName);
            setResolveError(null);
          } else {
            setAccountName('');
            setResolveError(json.message || 'Account not found');
          }
        }
      } catch {
        if (isCurrent) setResolveError('Bank resolution error');
      } finally {
        if (isCurrent) setIsResolving(false);
      }
    }, 300);

    return () => {
      isCurrent = false;
      clearTimeout(timer);
    };
  }, [accountNumber, bankCode]);

  const handleAddEqualFriend = () => {
    setEqualFriends([...equalFriends, `Friend ${String.fromCharCode(65 + equalFriends.length - 1)}`]);
  };

  const handleRemoveEqualFriend = (index: number) => {
    if (equalFriends.length <= 2) return;
    setEqualFriends(equalFriends.filter((_, i) => i !== index));
  };

  const handleAddItemizedFriend = () => {
    setItemizedParticipants([...itemizedParticipants, { name: `Friend ${itemizedParticipants.length}`, amount: '0' }]);
  };

  const handleRemoveItemizedFriend = (index: number) => {
    if (itemizedParticipants.length <= 2) return;
    setItemizedParticipants(itemizedParticipants.filter((_, i) => i !== index));
  };

  const itemizedTotal = itemizedParticipants.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  const isItemizedMatch = Math.abs(itemizedTotal - (parseFloat(totalAmount) || 0)) < 0.01;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountName) return;

    setIsSubmitting(true);
    try {
      const selectedBank = banks.find((b) => b.code === bankCode);
      const participantInputs =
        splitMode === 'equal'
          ? equalFriends.map((name) => ({ name }))
          : itemizedParticipants.map((p) => ({ name: p.name, amount: p.amount }));

      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          totalAmount,
          splitMode,
          host: {
            name: accountName,
            phone: hostPhone,
            bankName: selectedBank?.name || 'Commercial Bank',
            bankCode,
            accountNumber,
            accountName,
          },
          participantInputs,
        }),
      });

      const json = await res.json();
      if (json.status === 'success') {
        setCreatedRoom(json.data);
      }
    } catch (err) {
      console.error('Room creation failed:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const roomLink = createdRoom ? `${typeof window !== 'undefined' ? window.location.origin : ''}/r/${createdRoom.id}` : '';

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-mono font-semibold mb-3">
          <Split className="w-3.5 h-3.5" />
          <span>AUTOMATED BILL SETTLEMENT</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Create a SquadPay Split Room
        </h1>
        <p className="mt-1.5 text-sm text-slate-400 max-w-xl">
          Split dinners, trips, or group gifts. Each friend pays their dynamic bank transfer checkout. When all shares settle, FossaPay automatically deposits the pool into your bank account.
        </p>
      </div>

      {createdRoom ? (
        <div className="sq-card p-6 sm:p-8 space-y-6 border-violet-500/40 bg-violet-950/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/20 border border-violet-500/40 flex items-center justify-center text-violet-400">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">SquadPay Room Created!</h2>
              <p className="text-xs text-slate-400 font-mono">Room ID: {createdRoom.id}</p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900 border border-slate-700 space-y-2 font-mono text-xs">
            <div className="flex justify-between items-center text-violet-400 font-bold">
              <span>SHARE ROOM LINK (WhatsApp Group)</span>
              <span className="text-[10px] text-slate-400">{createdRoom.participants.length} Friends</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={roomLink}
                className="flex-1 bg-slate-950 px-3 py-2 rounded-lg border border-slate-800 text-slate-300 text-xs"
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(roomLink);
                  setCopiedLink(true);
                  setTimeout(() => setCopiedLink(false), 2000);
                }}
                className="px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-bold transition flex items-center gap-1.5"
              >
                {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedLink ? 'COPIED' : 'COPY'}</span>
              </button>
            </div>
          </div>

          <a
            href={roomLink}
            className="w-full text-center py-3.5 px-4 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-mono text-xs font-bold transition flex items-center justify-center gap-2"
          >
            <span>ENTER ROOM BOARD</span>
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="sq-card p-6 sm:p-8 space-y-6">
          {/* Section 1: Bill & Split Type */}
          <div className="space-y-4">
            <h2 className="text-sm font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <span className="w-5 h-5 rounded-md bg-violet-500/20 text-violet-400 flex items-center justify-center text-xs">1</span>
              <span>BILL DETAILS & SPLIT MODE</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-400">Event / Dinner Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-400">Total Bill (Naira ₦)</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-slate-500 font-mono text-sm">₦</span>
                  <input
                    type="number"
                    required
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-8 pr-4 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>
            </div>

            {/* Split Mode Selector */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSplitMode('equal')}
                className={`py-3 px-4 rounded-xl border font-mono text-xs font-bold transition flex items-center justify-center gap-2 ${
                  splitMode === 'equal'
                    ? 'bg-violet-600/20 border-violet-500 text-violet-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <span>EQUAL SPLIT (EVEN KOBO)</span>
              </button>

              <button
                type="button"
                onClick={() => setSplitMode('itemized')}
                className={`py-3 px-4 rounded-xl border font-mono text-xs font-bold transition flex items-center justify-center gap-2 ${
                  splitMode === 'itemized'
                    ? 'bg-violet-600/20 border-violet-500 text-violet-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <span>CUSTOM ITEMIZED SPLIT</span>
              </button>
            </div>
          </div>

          {/* Section 2: Participants */}
          <div className="space-y-4 pt-4 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-violet-500/20 text-violet-400 flex items-center justify-center text-xs">2</span>
                <span>PARTICIPANTS ({splitMode === 'equal' ? equalFriends.length : itemizedParticipants.length})</span>
              </h2>

              <button
                type="button"
                onClick={splitMode === 'equal' ? handleAddEqualFriend : handleAddItemizedFriend}
                className="text-xs font-mono text-violet-400 hover:text-violet-300 flex items-center gap-1 font-semibold"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>ADD FRIEND</span>
              </button>
            </div>

            {splitMode === 'equal' ? (
              <div className="space-y-2.5">
                {equalFriends.map((friend, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      required
                      value={friend}
                      onChange={(e) => {
                        const copy = [...equalFriends];
                        copy[idx] = e.target.value;
                        setEqualFriends(copy);
                      }}
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
                    />
                    <span className="text-xs font-mono text-slate-400 px-3 py-2 bg-slate-950 rounded-xl border border-slate-800 whitespace-nowrap">
                      ₦ {(parseFloat(totalAmount) / equalFriends.length || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    {equalFriends.length > 2 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveEqualFriend(idx)}
                        className="p-2 text-slate-500 hover:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2.5">
                {itemizedParticipants.map((p, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      required
                      value={p.name}
                      onChange={(e) => {
                        const copy = [...itemizedParticipants];
                        copy[idx].name = e.target.value;
                        setItemizedParticipants(copy);
                      }}
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
                      placeholder="Friend Name"
                    />
                    <div className="relative w-36">
                      <span className="absolute left-3 top-2 text-slate-500 text-xs">₦</span>
                      <input
                        type="number"
                        required
                        value={p.amount}
                        onChange={(e) => {
                          const copy = [...itemizedParticipants];
                          copy[idx].amount = e.target.value;
                          setItemizedParticipants(copy);
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-7 pr-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-violet-500"
                      />
                    </div>
                    {itemizedParticipants.length > 2 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItemizedFriend(idx)}
                        className="p-2 text-slate-500 hover:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}

                {/* Validation Note */}
                <div
                  className={`p-3 rounded-xl border text-xs font-mono flex items-center justify-between ${
                    isItemizedMatch
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : 'bg-red-500/10 border-red-500/30 text-red-400'
                  }`}
                >
                  <span>ITEMIZED SUM: ₦ {itemizedTotal.toLocaleString()}</span>
                  <span>{isItemizedMatch ? '✓ EXACT MATCH' : `DIFF: ₦ ${(parseFloat(totalAmount) - itemizedTotal).toLocaleString()}`}</span>
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Host Settlement Account */}
          <div className="space-y-4 pt-4 border-t border-slate-800">
            <h2 className="text-sm font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <span className="w-5 h-5 rounded-md bg-violet-500/20 text-violet-400 flex items-center justify-center text-xs">3</span>
              <span>HOST SETTLEMENT BANK (AUTOMATIC DIRECT DISBURSAL)</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-400">Host Bank</label>
                <select
                  value={bankCode}
                  onChange={(e) => setBankCode(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-violet-500"
                >
                  {banks.map((b) => (
                    <option key={b.code} value={b.code}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-400">10-Digit NUBAN Account</label>
                <input
                  type="text"
                  maxLength={10}
                  required
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white font-mono tracking-wider focus:outline-none focus:border-violet-500"
                />
              </div>
            </div>

            {/* Account Enquiry Badge */}
            <div>
              {isResolving && (
                <div className="text-xs font-mono text-slate-400 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-violet-400 animate-ping" />
                  <span>Validating host account via FossaPay Bank Enquiry...</span>
                </div>
              )}

              {accountName && !isResolving && (
                <div className="p-3 rounded-xl bg-violet-500/10 border border-violet-500/30 flex items-center gap-2.5 text-xs font-mono text-violet-300">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-violet-400" />
                  <div>
                    <span className="font-bold">CONFIRMED HOST ACCOUNT:</span> {accountName}
                  </div>
                </div>
              )}

              {resolveError && !isResolving && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs font-mono text-red-400">
                  {resolveError}
                </div>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !accountName || isResolving || (splitMode === 'itemized' && !isItemizedMatch)}
            className="w-full py-4 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-mono text-sm font-bold transition shadow-lg shadow-violet-600/25 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
          >
            <Users className="w-4 h-4" />
            <span>{isSubmitting ? 'CREATING SQUADPAY ROOM...' : 'CREATE ROOM & GET SHARE LINK'}</span>
          </button>
        </form>
      )}
    </div>
  );
}
