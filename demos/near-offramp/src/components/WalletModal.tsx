'use client';

import React from 'react';
import { useNear } from '../providers/NearProvider';
import { X, Key, Shield, ArrowRight, ExternalLink, Sparkles } from 'lucide-react';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WalletModal: React.FC<WalletModalProps> = ({ isOpen, onClose }) => {
  const { connect } = useNear();

  if (!isOpen) return null;

  const handlePasskey = async () => {
    await connect('fastauth');
    onClose();
  };

  const handleLaunchNearConnect = async () => {
    onClose();
    await connect('manifest');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-slate-900/90 border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden flex flex-col backdrop-blur-xl">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between">
          <div>
            <div className="cf-kicker">AUTHENTICATION // MULTI-CHAIN</div>
            <h3 className="text-base font-bold text-white font-sans mt-0.5">
              Connect to NEAR & Multi-Chain
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-3.5">
          {/* Option 1: FastAuth Passkey */}
          <button
            onClick={handlePasskey}
            className="w-full flex items-center justify-between p-4 bg-slate-950/50 hover:bg-slate-800/60 border border-white/[0.08] hover:border-orange-500/40 rounded-xl transition-all duration-200 group text-left shadow-sm hover:shadow-orange-500/5"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400 shadow-sm">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-white group-hover:text-orange-400 transition-colors">
                  FastAuth & Google Passkey
                </div>
                <div className="text-xs text-slate-400 font-mono mt-0.5">
                  Instant 2-sec non-custodial MPC login
                </div>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-orange-400 transition transform group-hover:translate-x-0.5" />
          </button>

          {/* Option 2: Full NEAR Connect Manifest (All Wallets) */}
          <button
            onClick={handleLaunchNearConnect}
            className="w-full flex items-center justify-between p-4 bg-slate-950/50 hover:bg-slate-800/60 border border-white/[0.08] hover:border-slate-600 rounded-xl transition-all duration-200 group text-left shadow-sm"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-slate-800/80 border border-white/[0.08] flex items-center justify-center text-slate-200 shadow-sm">
                <ExternalLink className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-white group-hover:text-slate-200 transition-colors">
                  All Wallets (NEAR Connect)
                </div>
                <div className="text-xs text-slate-400 font-mono mt-0.5">
                  HOT, Meteor, HERE, EVM, Ledger, Bitte
                </div>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-slate-200 transition transform group-hover:translate-x-0.5" />
          </button>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-white/[0.06] bg-slate-950/40 flex items-center justify-between text-[11px] text-slate-400 font-mono">
          <span className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-orange-400" />
            <span>SANDBOXED MANIFEST SPEC</span>
          </span>
          <span className="text-slate-400">@hot-labs/near-connect</span>
        </div>
      </div>
    </div>
  );
};
