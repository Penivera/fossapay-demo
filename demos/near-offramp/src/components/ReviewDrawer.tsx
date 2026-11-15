'use client';

import React from 'react';
import { X, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';
import type { Asset } from './TokenSelectModal';

interface ReviewDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  data: {
    originAsset: Asset;
    amountIn: string;
    minReceivedUsdc: string;
    netNgn: number;
    accountNumber: string;
    bankName: string;
    accountName: string;
    exchangeRateNgn: number;
  };
}

export const ReviewDrawer: React.FC<ReviewDrawerProps> = ({
  isOpen,
  onClose,
  onConfirm,
  data,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-slate-900/90 border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden flex flex-col backdrop-blur-xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between">
          <div>
            <div className="cf-kicker">PRE-FLIGHT VERIFICATION</div>
            <h3 className="text-base font-bold text-white font-sans mt-0.5">
              Confirm Off-Ramp Intent
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 font-mono text-xs">
          <div className="p-4 rounded-xl bg-gradient-to-r from-orange-500/15 via-amber-500/10 to-transparent border border-orange-500/25 text-orange-200 flex items-center justify-between">
            <span className="font-semibold text-slate-300">Origin Asset:</span>
            <span className="text-base font-bold text-orange-400">
              {data.amountIn} {data.originAsset.symbol} <span className="text-xs text-slate-400 font-sans">({data.originAsset.chain})</span>
            </span>
          </div>

          <div className="space-y-2.5 py-3 border-y border-white/[0.06] text-slate-400">
            <div className="flex justify-between">
              <span>BENEFICIARY:</span>
              <span className="text-white font-bold">{data.accountName}</span>
            </div>
            <div className="flex justify-between">
              <span>DESTINATION BANK:</span>
              <span className="text-slate-200">{data.bankName}</span>
            </div>
            <div className="flex justify-between">
              <span>ACCOUNT NUMBER:</span>
              <span className="text-slate-200">{data.accountNumber}</span>
            </div>
            <div className="flex justify-between">
              <span>SOLVER EXCHANGE RATE:</span>
              <span className="text-slate-200">
                1 {data.originAsset.symbol} ≈ ₦{data.exchangeRateNgn.toLocaleString()} NGN
              </span>
            </div>
            <div className="flex justify-between">
              <span>FOSSAPAY PAYOUT FEE:</span>
              <span className="text-slate-200">₦ 50.00 (Included)</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-950/20 via-slate-950/70 to-slate-950/70 border border-emerald-500/25 flex items-center justify-between">
            <span className="text-slate-300 font-medium">Guaranteed Net Payout:</span>
            <span className="text-2xl font-bold text-white tracking-tight">
              ₦ {data.netNgn.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-emerald-400">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>Zero solver slippage guaranteed via NEAR 1Click Protocol.</span>
          </div>
        </div>

        {/* Actions */}
        <div className="p-5 border-t border-white/[0.08] bg-slate-950/60 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 font-mono text-xs font-semibold border border-white/[0.08] transition"
          >
            CANCEL
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-mono text-xs font-bold transition shadow-lg shadow-orange-500/25 active:scale-[0.99] flex items-center justify-center gap-2"
          >
            <span>CONFIRM & EXECUTE</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
