'use client';

import React, { useMemo, useState } from 'react';
import { Check, Search } from 'lucide-react';
import { Dialog, Input } from '@fossapay/ui';

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

export const BankSearchModal: React.FC<BankSearchModalProps> = ({ isOpen, onClose, banks, selectedBankCode, onSelectBank }) => {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    const list = q ? banks.filter((b) => b.name.toLowerCase().includes(q) || b.code.includes(q)) : banks;
    return list.slice(0, 150); // the live directory has ~800 entries
  }, [banks, query]);

  return (
    <Dialog open={isOpen} onClose={onClose} title="Choose a bank" className="sm:h-[34rem]">
      <div className="sticky top-0 z-10 bg-surface p-4 pb-2">
        <Input autoFocus leading={<Search className="h-4 w-4" />} placeholder="Search by bank name or code" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <ul className="p-2">
        {filtered.map((b) => (
          <li key={b.code}>
            <button
              onClick={() => {
                onSelectBank(b);
                setQuery('');
                onClose();
              }}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition hover:bg-subtle"
            >
              <span>
                <span className="block text-[15px] font-medium text-ink">{b.name}</span>
                <span className="tabular block text-xs text-muted">{b.code}</span>
              </span>
              {selectedBankCode === b.code && <Check className="h-4 w-4 text-brand" />}
            </button>
          </li>
        ))}
        {filtered.length === 0 && <li className="px-3 py-10 text-center text-sm text-muted">{banks.length === 0 ? 'Loading banks…' : 'No banks match your search'}</li>}
      </ul>
    </Dialog>
  );
};
