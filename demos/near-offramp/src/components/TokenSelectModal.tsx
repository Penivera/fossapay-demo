'use client';

import React, { useState, useMemo } from 'react';
import { Check, Search } from 'lucide-react';
import { Dialog, Input } from '@fossapay/ui';

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

const CHAINS = ['All', 'Arbitrum', 'Base', 'Ethereum', 'Solana', 'NEAR'];

interface TokenSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedAsset: Asset;
  onSelectAsset: (asset: Asset) => void;
}

export const TokenSelectModal: React.FC<TokenSelectModalProps> = ({ isOpen, onClose, selectedAsset, onSelectAsset }) => {
  const [chain, setChain] = useState('All');
  const [query, setQuery] = useState('');

  const assets = useMemo(() => {
    const q = query.toLowerCase().trim();
    return ALL_SUPPORTED_ASSETS.filter((a) => {
      const okChain = chain === 'All' || a.chain === chain;
      const okQuery = !q || a.symbol.toLowerCase().includes(q) || a.name.toLowerCase().includes(q) || a.chain.toLowerCase().includes(q);
      return okChain && okQuery;
    });
  }, [chain, query]);

  return (
    <Dialog open={isOpen} onClose={onClose} title="Choose a token" className="sm:h-[34rem]">
      <div className="sticky top-0 z-10 space-y-3 bg-surface p-4 pb-2">
        <Input autoFocus leading={<Search className="h-4 w-4" />} placeholder="Search token or network" value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="flex flex-wrap gap-1.5">
          {CHAINS.map((c) => (
            <button
              key={c}
              onClick={() => setChain(c)}
              className={`rounded-full px-3 py-1 text-sm font-medium transition ${chain === c ? 'bg-ink text-white' : 'bg-subtle text-ink-2 hover:bg-line'}`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
      <ul className="p-2">
        {assets.map((a) => {
          const active = a.id === selectedAsset.id;
          return (
            <li key={a.id}>
              <button
                onClick={() => {
                  onSelectAsset(a);
                  onClose();
                }}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition hover:bg-subtle"
              >
                <span className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-subtle text-xs font-semibold text-ink-2">{a.symbol.slice(0, 2)}</span>
                  <span>
                    <span className="block text-[15px] font-medium text-ink">{a.symbol}</span>
                    <span className="block text-xs text-muted">{a.name} on {a.chain}</span>
                  </span>
                </span>
                {active && <Check className="h-4 w-4 text-brand" />}
              </button>
            </li>
          );
        })}
        {assets.length === 0 && <li className="px-3 py-10 text-center text-sm text-muted">No tokens match your search</li>}
      </ul>
    </Dialog>
  );
};
