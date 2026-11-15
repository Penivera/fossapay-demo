'use client';

import React, { useState, useMemo } from 'react';
import { X, Search, Check, Coins } from 'lucide-react';

export interface Asset {
  symbol: string;
  name: string;
  chain: string;
  id: string;
  decimals: number;
}

export const ALL_SUPPORTED_ASSETS: Asset[] = [
  { symbol: 'USDT', name: 'Tether USD', chain: 'Arbitrum', id: 'nep141:arbitrum-usdt.omft.near', decimals: 6 },
  { symbol: 'USDC', name: 'USD Coin', chain: 'Base', id: 'nep141:base-usdc.omft.near', decimals: 6 },
  { symbol: 'USDC', name: 'USD Coin', chain: 'Arbitrum', id: 'nep141:arbitrum-usdc.omft.near', decimals: 6 },
  { symbol: 'ETH', name: 'Ethereum', chain: 'Base', id: 'nep141:base-eth.omft.near', decimals: 18 },
  { symbol: 'ETH', name: 'Ethereum', chain: 'Arbitrum', id: 'nep141:arb-eth.omft.near', decimals: 18 },
  { symbol: 'ETH', name: 'Ethereum', chain: 'Ethereum', id: 'nep141:eth.omft.near', decimals: 18 },
  { symbol: 'SOL', name: 'Solana Native', chain: 'Solana', id: 'nep141:sol.omft.near', decimals: 9 },
  { symbol: 'USDC', name: 'USD Coin', chain: 'Solana', id: 'nep141:solana-usdc.omft.near', decimals: 6 },
  { symbol: 'NEAR', name: 'NEAR Protocol', chain: 'NEAR', id: 'wrap.near', decimals: 24 },
];

const CHAINS = ['ALL', 'Arbitrum', 'Base', 'Ethereum', 'Solana', 'NEAR'];

interface TokenSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedAsset: Asset;
  onSelectAsset: (asset: Asset) => void;
}

export const TokenSelectModal: React.FC<TokenSelectModalProps> = ({
  isOpen,
  onClose,
  selectedAsset,
  onSelectAsset,
}) => {
  const [selectedChain, setSelectedChain] = useState('ALL');
  const [query, setQuery] = useState('');

  const filteredAssets = useMemo(() => {
    return ALL_SUPPORTED_ASSETS.filter((a) => {
      const matchChain = selectedChain === 'ALL' || a.chain === selectedChain;
      const q = query.toLowerCase().trim();
      const matchQuery =
        !q ||
        a.symbol.toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q) ||
        a.chain.toLowerCase().includes(q);
      return matchChain && matchQuery;
    });
  }, [selectedChain, query]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-slate-900/90 border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] backdrop-blur-xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between">
          <div>
            <div className="cf-kicker">CROSS-CHAIN INVENTORY</div>
            <h3 className="text-base font-bold text-white font-sans mt-0.5">
              Select Token to Sell
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Chain Filter Badges */}
        <div className="px-5 py-3 border-b border-white/[0.06] bg-slate-950/40 flex items-center gap-1.5 overflow-x-auto text-[11px] font-mono">
          {CHAINS.map((chain) => (
            <button
              key={chain}
              onClick={() => setSelectedChain(chain)}
              className={`px-3 py-1 rounded-full transition whitespace-nowrap ${
                selectedChain === chain
                  ? 'bg-gradient-to-r from-orange-500 to-amber-600 text-white font-bold shadow-sm shadow-orange-500/20'
                  : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-700/80'
              }`}
            >
              {chain}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="p-4 border-b border-white/[0.06] bg-slate-950/40">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by token symbol or network..."
              className="w-full bg-slate-950/60 border border-white/[0.08] focus:border-orange-500/50 focus:ring-2 focus:ring-orange-500/15 rounded-xl pl-10 pr-4 py-2.5 font-sans text-xs text-slate-100 outline-none transition placeholder:text-slate-500"
            />
          </div>
        </div>

        {/* Assets List */}
        <div className="p-3 overflow-y-auto divide-y divide-white/[0.04] flex-1 space-y-1">
          {filteredAssets.length === 0 ? (
            <div className="py-8 text-center text-xs font-mono text-slate-500">
              No matching assets found for "{query}"
            </div>
          ) : (
            filteredAssets.map((asset) => {
              const isSelected =
                asset.id === selectedAsset.id && asset.chain === selectedAsset.chain;
              return (
                <button
                  key={`${asset.chain}-${asset.symbol}-${asset.id}`}
                  onClick={() => {
                    onSelectAsset(asset);
                    onClose();
                  }}
                  className={`w-full p-3 rounded-xl flex items-center justify-between transition text-left ${
                    isSelected
                      ? 'bg-orange-500/10 text-orange-400 font-semibold border border-orange-500/20'
                      : 'hover:bg-slate-800/50 text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400 text-xs font-bold shrink-0">
                      {asset.symbol.slice(0, 3)}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">{asset.symbol}</div>
                      <div className="text-[10px] text-slate-400 font-sans">
                        {asset.name} • <span className="font-mono text-slate-300">{asset.chain}</span>
                      </div>
                    </div>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-orange-400" />}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
