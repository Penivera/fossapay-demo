'use client';

import React from 'react';
import { useNear } from '../providers/NearProvider';
import { Wallet, LogOut, ShieldCheck, Zap, Activity } from 'lucide-react';

interface NavbarProps {
  onOpenWalletModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenWalletModal }) => {
  const { accountId, isConnected, disconnect } = useNear();

  return (
    <header className="w-full border-b border-white/[0.07] bg-slate-950/70 backdrop-blur-xl sticky top-0 z-40 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand & Technical Kicker */}
        <div className="flex items-center gap-3.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500/20 to-amber-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400 shadow-sm shadow-orange-500/20">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-sans font-bold text-base text-white tracking-tight">
                NairaBridge
              </span>
              <span className="cf-badge cf-badge-orange text-[9px] py-0.5">INTENTS</span>
            </div>
            <div className="cf-kicker text-[10px] text-slate-400">
              NEAR // FOSSAPAY GATEWAY
            </div>
          </div>
        </div>

        {/* Live Network & Telemetry Ticker (Desktop) */}
        <div className="hidden md:flex items-center gap-6 text-xs font-mono text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-slate-300">NIBSS Rails</span>
            <span className="text-slate-500">99.98% SLA</span>
          </div>

          <div className="h-3 w-px bg-slate-800" />

          <div className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-orange-400" />
            <span className="text-slate-300">Avg Settlement:</span>
            <span className="text-orange-400 font-semibold">8.4s</span>
          </div>
        </div>

        {/* Security & Wallet Controls */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 font-mono">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-[11px] text-slate-300">NON-CUSTODIAL</span>
          </div>

          {isConnected ? (
            <div className="flex items-center gap-2 bg-slate-900/80 border border-white/[0.08] rounded-xl p-1 pl-3 shadow-inner">
              <span className="font-mono text-xs text-slate-200">
                {accountId && accountId.length > 16
                  ? `${accountId.slice(0, 6)}...${accountId.slice(-4)}`
                  : accountId}
              </span>
              <button
                onClick={disconnect}
                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-rose-400 transition"
                title="Disconnect Wallet"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenWalletModal}
              className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-mono text-xs font-semibold px-4 py-2 rounded-xl transition shadow-lg shadow-orange-500/20 active:scale-[0.98]"
            >
              <Wallet className="w-4 h-4" />
              <span>CONNECT WALLET</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
