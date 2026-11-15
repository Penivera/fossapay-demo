'use client';

import React, { useState } from 'react';
import { useNear } from '../providers/NearProvider';
import { X, Key, Shield, ArrowRight, ExternalLink, Sparkles, Wallet, Check } from 'lucide-react';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'social' | 'near' | 'evm' | 'sol';

export const WalletModal: React.FC<WalletModalProps> = ({ isOpen, onClose }) => {
  const { connect, isConnected, accountId } = useNear();
  const [activeTab, setActiveTab] = useState<TabType>('social');
  const [notice, setNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleConnectFastAuth = async () => {
    await connect('fastauth');
    onClose();
  };

  const handleConnectDemo = async () => {
    await connect('demo');
    onClose();
  };

  const handleComingSoon = (walletName: string) => {
    setNotice(`${walletName} connector is coming soon. Use Passkey or Demo Wallet for offline demo.`);
    setTimeout(() => setNotice(null), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-slate-900/95 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col backdrop-blur-xl">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
          <div>
            <div className="cf-kicker">SELECT WALLET OR SIGN-IN METHOD</div>
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

        {/* Tab Bar */}
        <div className="grid grid-cols-4 border-b border-slate-700 bg-slate-950/60 p-1 text-center font-mono text-[11px]">
          <button
            onClick={() => setActiveTab('social')}
            className={`py-2 px-1 rounded-lg transition-all ${
              activeTab === 'social'
                ? 'bg-orange-500/15 text-orange-400 font-bold border border-orange-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            SOCIAL / PASSKEYS
          </button>
          <button
            onClick={() => setActiveTab('near')}
            className={`py-2 px-1 rounded-lg transition-all ${
              activeTab === 'near'
                ? 'bg-orange-500/15 text-orange-400 font-bold border border-orange-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            NEAR NATIVE
          </button>
          <button
            onClick={() => setActiveTab('evm')}
            className={`py-2 px-1 rounded-lg transition-all ${
              activeTab === 'evm'
                ? 'bg-orange-500/15 text-orange-400 font-bold border border-orange-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            EVM / MULTI
          </button>
          <button
            onClick={() => setActiveTab('sol')}
            className={`py-2 px-1 rounded-lg transition-all ${
              activeTab === 'sol'
                ? 'bg-orange-500/15 text-orange-400 font-bold border border-orange-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            SOL NATIVE
          </button>
        </div>

        {/* Temporary Notice */}
        {notice && (
          <div className="bg-amber-950/60 border-b border-amber-500/30 px-6 py-2 text-xs font-mono text-amber-300">
            {notice}
          </div>
        )}

        {/* Tab Body */}
        <div className="p-6">
          {activeTab === 'social' && (
            <div className="space-y-3">
              {/* Option 1: Demo Wallet (Always Works Offline) */}
              <button
                onClick={handleConnectDemo}
                className="w-full flex items-center justify-between p-4 bg-orange-950/20 hover:bg-orange-900/30 border border-orange-500/40 rounded-xl transition text-left group"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-orange-400 shadow-sm">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white group-hover:text-orange-300 flex items-center gap-2">
                      Demo Wallet (Offline Sandbox)
                      <span className="cf-badge cf-badge-orange text-[9px]">INSTANT DEMO</span>
                    </div>
                    <div className="text-xs text-slate-400 font-mono mt-0.5">
                      alice.near • 420.50 USDT (No browser extension needed)
                    </div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-orange-400 group-hover:translate-x-0.5 transition" />
              </button>

              {/* Option 2: FastAuth Passkey */}
              <button
                onClick={handleConnectFastAuth}
                className="w-full flex items-center justify-between p-4 bg-slate-950/50 hover:bg-slate-800/60 border border-slate-700 hover:border-slate-600 rounded-xl transition text-left group"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
                    <Key className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white group-hover:text-slate-200">
                      Continue with Passkey / Google (FastAuth)
                    </div>
                    <div className="text-xs text-slate-400 font-mono mt-0.5">
                      NEAR account created automatically in 2 seconds
                    </div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:translate-x-0.5 transition" />
              </button>
            </div>
          )}

          {activeTab === 'near' && (
            <div className="space-y-2">
              <div className="text-xs font-mono uppercase text-slate-400 mb-2">NEAR NATIVE WALLETS</div>
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { name: 'MyNearWallet', icon: 'M' },
                  { name: 'Meteor Wallet', icon: '☄' },
                  { name: 'HERE Wallet (Mobile/TG)', icon: 'H' },
                  { name: 'Sender Wallet', icon: 'S' },
                  { name: 'Bitte Wallet (Mintbase)', icon: 'B' },
                  { name: 'Near Mobile / Ledger', icon: '📱' },
                ].map((w) => (
                  <button
                    key={w.name}
                    onClick={() => handleComingSoon(w.name)}
                    className="p-3 bg-slate-950/50 hover:bg-slate-800/60 border border-slate-700 rounded-xl text-left flex items-center justify-between group transition"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center text-xs font-bold text-orange-400 border border-slate-700">
                        {w.icon}
                      </span>
                      <span className="text-xs font-medium text-slate-200 group-hover:text-white">
                        {w.name}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500">Coming soon</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'evm' && (
            <div className="space-y-2">
              <div className="text-xs font-mono uppercase text-slate-400 mb-2">EVM & MULTI-CHAIN WALLETS</div>
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { name: 'MetaMask (EVM)', icon: '🦊' },
                  { name: 'Rainbow / Coinbase', icon: '🌈' },
                  { name: 'Rabby Wallet', icon: '⚡' },
                  { name: 'WalletConnect (300+)', icon: '🔗' },
                ].map((w) => (
                  <button
                    key={w.name}
                    onClick={() => handleComingSoon(w.name)}
                    className="p-3 bg-slate-950/50 hover:bg-slate-800/60 border border-slate-700 rounded-xl text-left flex items-center justify-between group transition"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center text-xs font-bold text-orange-400 border border-slate-700">
                        {w.icon}
                      </span>
                      <span className="text-xs font-medium text-slate-200 group-hover:text-white">
                        {w.name}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500">Coming soon</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'sol' && (
            <div className="space-y-2">
              <div className="text-xs font-mono uppercase text-slate-400 mb-2">SOLANA NATIVE</div>
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { name: 'Phantom (Solana)', icon: '👻' },
                  { name: 'Solflare', icon: '☀️' },
                ].map((w) => (
                  <button
                    key={w.name}
                    onClick={() => handleComingSoon(w.name)}
                    className="p-3 bg-slate-950/50 hover:bg-slate-800/60 border border-slate-700 rounded-xl text-left flex items-center justify-between group transition"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center text-xs font-bold text-orange-400 border border-slate-700">
                        {w.icon}
                      </span>
                      <span className="text-xs font-medium text-slate-200 group-hover:text-white">
                        {w.name}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500">Coming soon</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-700 bg-slate-950/60 flex items-center justify-between text-[11px] text-slate-400 font-mono">
          <span className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-orange-400" />
            <span>NEAR WALLET SELECTOR SPEC</span>
          </span>
          <span className="text-slate-400">@hot-labs/near-connect</span>
        </div>
      </div>
    </div>
  );
};
