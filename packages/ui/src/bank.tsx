'use client';

import { useEffect, useMemo, useState } from 'react';
import { Field, Input, Select } from './primitives';
import { Spinner } from './primitives';

export interface BankAccountValue {
  bankCode: string;
  bankName: string;
  accountNumber: string;
  /** Name returned by the bank enquiry. Empty until resolved. */
  accountName: string;
}

export const emptyBankAccount: BankAccountValue = { bankCode: '', bankName: '', accountNumber: '', accountName: '' };

interface Bank {
  name: string;
  code: string;
}

/**
 * Bank + NUBAN input that verifies the account holder through `/api/banks` and `/api/banks/resolve`
 * (every demo exposes both). Reports `accountName` only after the bank confirms it, so callers can
 * gate submit on `value.accountName`.
 */
export function BankAccountPicker({ value, onChange, label = 'Bank account', disabled }: { value: BankAccountValue; onChange: (v: BankAccountValue) => void; label?: string; disabled?: boolean }) {
  const [banks, setBanks] = useState<Bank[]>([]);
  const [filter, setFilter] = useState('');
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/banks')
      .then((r) => r.json())
      .then((res) => res.status === 'success' && Array.isArray(res.data) && setBanks(res.data))
      .catch(() => setError('Could not load the bank list'));
  }, []);

  const options = useMemo(() => {
    const q = filter.toLowerCase().trim();
    const list = q ? banks.filter((b) => b.name.toLowerCase().includes(q) || b.code.includes(q)) : banks;
    // Always keep the selected bank present so the control never shows a blank value
    const selected = banks.find((b) => b.code === value.bankCode);
    return selected && !list.includes(selected) ? [selected, ...list] : list;
  }, [banks, filter, value.bankCode]);

  useEffect(() => {
    if (value.accountNumber.length !== 10 || !value.bankCode) {
      setError(null);
      return;
    }
    let current = true;
    setResolving(true);
    setError(null);
    const t = setTimeout(async () => {
      try {
        const res = await fetch('/api/banks/resolve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accountNumber: value.accountNumber, bankCode: value.bankCode }),
        });
        const json = await res.json();
        if (!current) return;
        if (json.status === 'success' && json.data?.accountName) {
          onChange({ ...value, accountName: json.data.accountName });
        } else {
          onChange({ ...value, accountName: '' });
          setError(json.message || 'Account not found');
        }
      } catch {
        if (current) {
          onChange({ ...value, accountName: '' });
          setError('Bank directory unreachable');
        }
      } finally {
        if (current) setResolving(false);
      }
    }, 350);
    return () => {
      current = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.accountNumber, value.bankCode]);

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-ink-2">{label}</p>
      {banks.length > 40 && <Input aria-label="Filter banks" placeholder="Search banks by name or code…" value={filter} onChange={(e) => setFilter(e.target.value)} disabled={disabled} />}
      <div className="grid gap-3 sm:grid-cols-[3fr_2fr]">
        <Field className="space-y-1.5">
          <Select
            aria-label="Bank"
            disabled={disabled}
            value={value.bankCode}
            onChange={(e) => {
              const b = banks.find((x) => x.code === e.target.value);
              onChange({ ...value, bankCode: e.target.value, bankName: b?.name ?? '', accountName: '' });
            }}
          >
            <option value="" disabled>
              {banks.length ? 'Select a bank' : 'Loading banks…'}
            </option>
            {options.map((b) => (
              <option key={b.code} value={b.code}>
                {b.name}
              </option>
            ))}
          </Select>
        </Field>
        <Input
          aria-label="Account number"
          inputMode="numeric"
          maxLength={10}
          placeholder="10-digit account number"
          disabled={disabled}
          value={value.accountNumber}
          onChange={(e) => onChange({ ...value, accountNumber: e.target.value.replace(/\D/g, ''), accountName: '' })}
          className="tabular"
        />
      </div>
      <div className="flex min-h-6 items-center text-sm">
        {resolving && (
          <span className="inline-flex items-center gap-2 text-muted">
            <Spinner className="h-4 w-4" /> Verifying account…
          </span>
        )}
        {!resolving && value.accountName && <span className="font-medium text-success-ink">✓ {value.accountName}</span>}
        {!resolving && error && <span className="font-medium text-danger-ink">{error}</span>}
      </div>
    </div>
  );
}
