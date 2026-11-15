'use client';

import React, { useState, useMemo } from 'react';
import { X, Search, Check, Building2 } from 'lucide-react';

interface Bank {
  name: string;
  code: string;
}

interface BankSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  banks: Bank[];
  selectedBankCode?: string;
  onSelectBank: (bank: Bank) => void;
}

export const BankSearchModal: React.FC<BankSearchModalProps> = ({
  isOpen,
  onClose,
  banks,
  selectedBankCode,
  onSelectBank,
}) => {
  const [query, setQuery] = useState('');

  const filteredBanks = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return banks;
    return banks.filter(
      (b) => b.name.toLowerCase().includes(q) || b.code.includes(q)
    );
  }, [banks, query]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-slate-900/90 border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] backdrop-blur-xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between">
          <div>
            <div className="cf-kicker">NIGERIAN INSTITUTIONS</div>
            <h3 className="text-base font-bold text-white font-sans mt-0.5">
              Select Destination Bank
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
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
              placeholder="Search by bank name or NIBSS code..."
              className="w-full bg-slate-950/60 border border-white/[0.08] focus:border-orange-500/50 focus:ring-2 focus:ring-orange-500/15 rounded-xl pl-10 pr-4 py-2.5 font-sans text-xs text-slate-100 outline-none transition placeholder:text-slate-500"
            />
          </div>
        </div>

        {/* Bank List */}
        <div className="p-3 overflow-y-auto divide-y divide-white/[0.04] flex-1 space-y-1">
          {filteredBanks.length === 0 ? (
            <div className="py-8 text-center text-xs font-mono text-slate-500">
              No matching banks found for "{query}"
            </div>
          ) : (
            filteredBanks.map((bank) => {
              const isSelected = bank.code === selectedBankCode;
              return (
                <button
                  key={bank.code}
                  onClick={() => {
                    onSelectBank(bank);
                    onClose();
                  }}
                  className={`w-full p-3 rounded-xl flex items-center justify-between transition text-left ${
                    isSelected
                      ? 'bg-orange-500/10 text-orange-400 font-semibold border border-orange-500/20'
                      : 'hover:bg-slate-800/50 text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 shrink-0">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-white">{bank.name}</div>
                      <div className="text-[10px] font-mono text-slate-400">
                        NIBSS Code: {bank.code}
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
