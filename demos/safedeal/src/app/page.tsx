'use client';

import React, { useState, useEffect } from 'react';
import { Shield, Sparkles, CheckCircle2, Copy, Check, ArrowRight, Clock, Building2, AlertCircle } from 'lucide-react';

interface Bank {
  name: string;
  code: string;
}

export default function CreateDealPage() {
  const [title, setTitle] = useState('iPhone 13 - 128GB Midnight');
  const [description, setDescription] = useState('Brand new open box. 100% battery health. Charger included.');
  const [price, setPrice] = useState('420000');
  const [inspectionSeconds, setInspectionSeconds] = useState(15); // 15 seconds for easy demo testing
  const [sellerName, setSellerName] = useState('Tunde Balogun');
  const [sellerPhone, setSellerPhone] = useState('08099887766');
  const [sellerEmail, setSellerEmail] = useState('tunde@safedeal.ng');

  const [banks, setBanks] = useState<Bank[]>([]);
  const [bankCode, setBankCode] = useState('058');
  const [accountNumber, setAccountNumber] = useState('9988776655');
  const [accountName, setAccountName] = useState('TUNDE BALOGUN');
  const [isResolving, setIsResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  const [createdDeal, setCreatedDeal] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedBuyer, setCopiedBuyer] = useState(false);
  const [copiedSeller, setCopiedSeller] = useState(false);

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

  // Live Bank Resolution
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
            setResolveError(json.message || 'Account could not be resolved');
          }
        }
      } catch {
        if (isCurrent) setResolveError('Resolution error');
      } finally {
        if (isCurrent) setIsResolving(false);
      }
    }, 300);

    return () => {
      isCurrent = false;
      clearTimeout(timer);
    };
  }, [accountNumber, bankCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountName) return;

    setIsSubmitting(true);
    try {
      const selectedBank = banks.find((b) => b.code === bankCode);
      const res = await fetch('/api/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          price,
          inspectionPeriodSeconds: inspectionSeconds,
          seller: {
            name: sellerName,
            phone: sellerPhone,
            email: sellerEmail,
            bankName: selectedBank?.name || 'Commercial Bank',
            bankCode,
            accountNumber,
            accountName,
          },
        }),
      });

      const json = await res.json();
      if (json.status === 'success') {
        setCreatedDeal(json.data);
      }
    } catch (err) {
      console.error('Failed to create deal:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const buyerLink = createdDeal ? `${typeof window !== 'undefined' ? window.location.origin : ''}/d/${createdDeal.id}` : '';
  const sellerLink = createdDeal ? `${buyerLink}?sellerToken=${createdDeal.seller.sellerToken}` : '';

  const copyToClipboard = (text: string, isSeller: boolean) => {
    navigator.clipboard.writeText(text);
    if (isSeller) {
      setCopiedSeller(true);
      setTimeout(() => setCopiedSeller(false), 2000);
    } else {
      setCopiedBuyer(true);
      setTimeout(() => setCopiedBuyer(false), 2000);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Hero Header */}
      <div className="text-center sm:text-left">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono font-semibold mb-3">
          <Shield className="w-3.5 h-3.5" />
          <span>ZERO-TRUST SOCIAL COMMERCE ESCROW</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Create a SafeDeal Escrow Link
        </h1>
        <p className="mt-1.5 text-sm text-slate-400 max-w-xl">
          Lock buyer payment safely with FossaPay before dispatching. Once the buyer confirms delivery, funds settle straight into your commercial bank account with 0% platform fee.
        </p>
      </div>

      {createdDeal ? (
        /* Deal Created Confirmation Card */
        <div className="sd-card p-6 sm:p-8 space-y-6 border-emerald-500/40 bg-emerald-950/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Deal Successfully Created!</h2>
              <p className="text-xs text-slate-400 font-mono">Deal Reference: {createdDeal.id}</p>
            </div>
          </div>

          <div className="space-y-4 font-mono text-xs">
            {/* Shareable Link for Buyer */}
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-700 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-emerald-400 font-bold">1. SHARE WITH BUYER (WhatsApp / DM)</span>
                <span className="text-[10px] text-slate-400">Public Link</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={buyerLink}
                  className="flex-1 bg-slate-950 px-3 py-2 rounded-lg border border-slate-800 text-slate-300 text-xs"
                />
                <button
                  onClick={() => copyToClipboard(buyerLink, false)}
                  className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition flex items-center gap-1.5"
                >
                  {copiedBuyer ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedBuyer ? 'COPIED' : 'COPY'}</span>
                </button>
              </div>
            </div>

            {/* Secret Management Link for Seller */}
            <div className="p-4 rounded-xl bg-slate-900/80 border border-amber-500/30 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-amber-400 font-bold">2. YOUR SELLER MANAGEMENT LINK (Private)</span>
                <span className="text-[10px] text-amber-400/80">Keep Secret</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={sellerLink}
                  className="flex-1 bg-slate-950 px-3 py-2 rounded-lg border border-slate-800 text-slate-300 text-xs"
                />
                <button
                  onClick={() => copyToClipboard(sellerLink, true)}
                  className="px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold transition flex items-center gap-1.5"
                >
                  {copiedSeller ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedSeller ? 'COPIED' : 'COPY'}</span>
                </button>
              </div>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            <a
              href={buyerLink}
              target="_blank"
              rel="noreferrer"
              className="flex-1 text-center py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-bold transition flex items-center justify-center gap-2"
            >
              <span>OPEN BUYER VIEW</span>
              <ArrowRight className="w-4 h-4" />
            </a>
            <a
              href={sellerLink}
              target="_blank"
              rel="noreferrer"
              className="flex-1 text-center py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-xs font-bold transition border border-slate-700 flex items-center justify-center gap-2"
            >
              <span>OPEN SELLER DASHBOARD</span>
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      ) : (
        /* Create Deal Form */
        <form onSubmit={handleSubmit} className="sd-card p-6 sm:p-8 space-y-6">
          {/* Section 1: Item Details */}
          <div className="space-y-4">
            <h2 className="text-sm font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <span className="w-5 h-5 rounded-md bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs">1</span>
              <span>ITEM DETAILS & ESCROW AMOUNT</span>
            </h2>

            <div className="space-y-1.5">
              <label className="text-xs font-mono text-slate-400">Item Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                placeholder="e.g. Sony WH-1000XM5 Headphones"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-400">Price (Naira ₦)</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-slate-500 font-mono text-sm">₦</span>
                  <input
                    type="number"
                    required
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-8 pr-4 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                    placeholder="420000"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Inspection Window (Demo Mode)</span>
                </label>
                <select
                  value={inspectionSeconds}
                  onChange={(e) => setInspectionSeconds(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                >
                  <option value={15}>15 Seconds (Fast Demo)</option>
                  <option value={60}>1 Minute</option>
                  <option value={3600}>1 Hour</option>
                  <option value={86400}>24 Hours (Standard Spec)</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono text-slate-400">Description & Agreed Condition</label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                placeholder="Details agreed with buyer on WhatsApp..."
              />
            </div>
          </div>

          {/* Section 2: Seller Payout Bank Details */}
          <div className="space-y-4 pt-4 border-t border-slate-800">
            <h2 className="text-sm font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <span className="w-5 h-5 rounded-md bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs">2</span>
              <span>SELLER PAYOUT DESTINATION (FOSSAPAY VERIFIED)</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-400">Destination Bank</label>
                <select
                  value={bankCode}
                  onChange={(e) => setBankCode(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
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
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white font-mono tracking-wider focus:outline-none focus:border-emerald-500"
                  placeholder="0123456789"
                />
              </div>
            </div>

            {/* Live Name Verification Status */}
            <div>
              {isResolving && (
                <div className="text-xs font-mono text-slate-400 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  <span>Resolving account holder via FossaPay Bank Enquiry...</span>
                </div>
              )}

              {accountName && !isResolving && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2.5 text-xs font-mono text-emerald-400">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <div>
                    <span className="font-bold">VERIFIED BENEFICIARY:</span> {accountName}
                  </div>
                </div>
              )}

              {resolveError && !isResolving && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-2.5 text-xs font-mono text-red-400">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{resolveError}</span>
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Seller Contact */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-800">
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-slate-400">Seller WhatsApp / Phone</label>
              <input
                type="text"
                required
                value={sellerPhone}
                onChange={(e) => setSellerPhone(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-slate-400">Seller Name</label>
              <input
                type="text"
                required
                value={sellerName}
                onChange={(e) => setSellerName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !accountName || isResolving}
            className="w-full py-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-mono text-sm font-bold transition shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
          >
            <Shield className="w-4 h-4" />
            <span>{isSubmitting ? 'GENERATING ESCROW DEAL...' : 'CREATE DEAL & GET SHAREABLE LINK'}</span>
          </button>
        </form>
      )}
    </div>
  );
}
