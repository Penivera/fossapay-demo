'use client';

import React, { useState, useEffect } from 'react';
import { Shield, AlertTriangle, CheckCircle2, RotateCcw, Building2, User, Eye } from 'lucide-react';

export default function AdminMediationPage() {
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Refund modal state
  const [selectedDealForRefund, setSelectedDealForRefund] = useState<any>(null);
  const [buyerAccountNumber, setBuyerAccountNumber] = useState('0123456789');
  const [buyerBankCode, setBuyerBankCode] = useState('999992');
  const [buyerAccountName, setBuyerAccountName] = useState('CHIDINMA OKONKWO');
  const [isProcessing, setIsProcessing] = useState(false);

  const loadDeals = () => {
    fetch('/api/admin/deals')
      .then((r) => r.json())
      .then((res) => {
        if (res.status === 'success') {
          setDeals(res.data.deals || []);
        }
        setLoading(false);
      })
      .catch((e) => {
        console.error('Failed to load deals:', e);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadDeals();
  }, []);

  const handleResolveToSeller = async (dealId: string) => {
    if (!confirm('Are you sure you want to release funds to the seller?')) return;
    setIsProcessing(true);
    try {
      await fetch(`/api/deals/${dealId}/resolve-seller`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: 'Admin reviewed evidence and resolved in favor of seller.' }),
      });
      loadDeals();
    } catch (err) {
      console.error('Resolve failed:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRefundToBuyer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDealForRefund) return;
    setIsProcessing(true);
    try {
      await fetch(`/api/deals/${selectedDealForRefund.id}/refund-buyer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountNumber: buyerAccountNumber,
          bankCode: buyerBankCode,
          accountName: buyerAccountName,
          resolutionNote: 'Admin mediation confirmed item discrepancy. 100% refund disbursed to buyer.',
        }),
      });
      setSelectedDealForRefund(null);
      loadDeals();
    } catch (err) {
      console.error('Refund failed:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const disputedDeals = deals.filter((d) => d.status === 'DISPUTED');

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="text-xs font-mono font-bold text-amber-400">ADMIN MEDIATION DESK</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Escrow Dispute Resolution</h1>
        </div>
        <div className="flex items-center gap-3 font-mono text-xs">
          <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-300">
            TOTAL DEALS: <span className="text-white font-bold">{deals.length}</span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-red-950/40 border border-red-500/30 text-red-300">
            DISPUTES: <span className="font-bold text-red-400">{disputedDeals.length}</span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center font-mono text-xs text-slate-400">Loading mediation desk...</div>
      ) : (
        <div className="space-y-6">
          {disputedDeals.length === 0 ? (
            <div className="sd-card p-12 text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
              <h2 className="text-base font-bold text-white">No Open Disputes</h2>
              <p className="text-xs text-slate-400 font-mono">
                All social commerce transactions are progressing smoothly or settled.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-xs font-mono text-red-400 uppercase tracking-wider font-bold">
                OPEN ESCROW DISPUTES REQUIRING ARBITRATION ({disputedDeals.length})
              </div>

              {disputedDeals.map((deal) => (
                <div key={deal.id} className="sd-card p-6 border-red-500/40 bg-red-950/10 space-y-4 font-mono text-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
                    <div>
                      <span className="text-slate-400 block text-[10px]">DEAL REFERENCE: {deal.id}</span>
                      <h3 className="text-base font-bold text-white font-sans">{deal.title}</h3>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-400 block text-[10px]">LOCKED AMOUNT</span>
                      <span className="text-lg font-bold text-amber-400">
                        ₦ {Number(deal.price).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Parties Info */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-900 border border-slate-800">
                    <div>
                      <span className="text-slate-500 block text-[10px]">SELLER</span>
                      <div className="text-white font-bold">{deal.seller.name}</div>
                      <div className="text-slate-400 text-[11px]">{deal.seller.phone}</div>
                      <div className="text-slate-400 text-[11px]">
                        Bank: {deal.seller.bankName} ({deal.seller.accountNumber})
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">BUYER</span>
                      <div className="text-white font-bold">{deal.buyer?.name || 'Anonymous Buyer'}</div>
                      <div className="text-slate-400 text-[11px]">{deal.buyer?.phone || 'No phone'}</div>
                    </div>
                  </div>

                  {/* Dispute Evidence */}
                  <div className="p-4 rounded-xl bg-slate-950 border border-red-500/30 space-y-2">
                    <span className="text-red-400 font-bold block">BUYER DISPUTE CLAIM:</span>
                    <p className="text-slate-200 font-sans text-xs">{deal.dispute?.reason}</p>
                    {deal.dispute?.evidencePhotoUrl && (
                      <div className="pt-2">
                        <span className="text-slate-400 text-[10px] block mb-1">EVIDENCE PHOTO:</span>
                        <img
                          src={deal.dispute.evidencePhotoUrl}
                          alt="Dispute evidence"
                          className="max-h-52 rounded-lg border border-slate-700"
                        />
                      </div>
                    )}
                  </div>

                  {/* Arbitration Actions */}
                  <div className="pt-2 flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={() => handleResolveToSeller(deal.id)}
                      disabled={isProcessing}
                      className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>RESOLVE & RELEASE TO SELLER</span>
                    </button>

                    <button
                      onClick={() => {
                        setSelectedDealForRefund(deal);
                        if (deal.buyer?.name) setBuyerAccountName(deal.buyer.name);
                      }}
                      disabled={isProcessing}
                      className="flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition flex items-center justify-center gap-2"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>REFUND TO BUYER</span>
                    </button>

                    <a
                      href={`/d/${deal.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition border border-slate-700 flex items-center justify-center gap-1.5"
                    >
                      <Eye className="w-4 h-4" />
                      <span>VIEW DEAL</span>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* All Deals Audit Overview */}
          <div className="pt-8 border-t border-slate-800 space-y-3 font-mono text-xs">
            <div className="text-slate-400 uppercase tracking-wider text-[11px]">ALL SAFE-DEAL RECORDS ({deals.length})</div>
            <div className="divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
              {deals.map((d) => (
                <div key={d.id} className="p-3.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-white font-bold">{d.title}</span>
                    <span className="text-slate-500 ml-2">({d.id})</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-slate-300">₦ {Number(d.price).toLocaleString()}</span>
                    <span className="sd-badge bg-slate-800 text-slate-300 text-[10px]">{d.status}</span>
                    <a href={`/d/${d.id}`} className="text-emerald-400 hover:underline">
                      Open ↗
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Buyer Refund Modal */}
      {selectedDealForRefund && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-4 font-mono text-xs shadow-2xl">
            <div className="flex items-center gap-2 text-blue-400 font-bold text-sm">
              <RotateCcw className="w-5 h-5" />
              <span>CONFIRM BUYER REFUND DISBURSEMENT</span>
            </div>

            <p className="text-slate-400 text-xs font-sans">
              Initiating a FossaPay Master Wallet Payout of{' '}
              <strong className="text-white">₦ {Number(selectedDealForRefund.price).toLocaleString()}</strong> directly to the buyer&apos;s commercial bank.
            </p>

            <form onSubmit={handleRefundToBuyer} className="space-y-3">
              <div>
                <label className="text-slate-400 block mb-1">Buyer Destination Bank</label>
                <select
                  value={buyerBankCode}
                  onChange={(e) => setBuyerBankCode(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white"
                >
                  <option value="999992">OPay Digital Services (999992)</option>
                  <option value="058">Guaranty Trust Bank (058)</option>
                  <option value="090110">Kuda Microfinance Bank (090110)</option>
                  <option value="044">Access Bank (044)</option>
                  <option value="057">Zenith Bank (057)</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Buyer 10-Digit Account Number</label>
                <input
                  type="text"
                  maxLength={10}
                  required
                  value={buyerAccountNumber}
                  onChange={(e) => setBuyerAccountNumber(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Account Holder Name</label>
                <input
                  type="text"
                  required
                  value={buyerAccountName}
                  onChange={(e) => setBuyerAccountName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedDealForRefund(null)}
                  className="flex-1 py-2.5 bg-slate-800 text-slate-300 rounded-lg"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg"
                >
                  {isProcessing ? 'DISBURSING...' : 'DISBURSE REFUND'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
