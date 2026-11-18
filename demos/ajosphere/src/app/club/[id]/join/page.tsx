'use client';

import React, { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check } from 'lucide-react';
import { BankAccountPicker, Button, Card, CardTitle, Field, Input, Notice, Page, Rows, Segmented, emptyBankAccount, useMode, type BankAccountValue } from '@fossapay/ui';

export default function JoinClubPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { isMock } = useMode();

  const [kycMethod, setKycMethod] = useState<'BVN' | 'NIN'>('BVN');
  const [identityNumber, setIdentityNumber] = useState(isMock ? '22233344455' : '');
  const [account, setAccount] = useState<BankAccountValue>(isMock ? { bankCode: '058', bankName: '', accountNumber: '9988776655', accountName: '' } : emptyBankAccount);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState<any | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/clubs/${id}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kycMethod, identityNumber: identityNumber.trim(), accountNumber: account.accountNumber, bankCode: account.bankCode }),
      });
      const data = await res.json();
      if (data.status === 'success') setJoined(data.data);
      else setError(data.message || 'Failed to join');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Page narrow className="max-w-xl">
      <a href={`/club/${id}`} className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-ink-2 transition hover:text-ink"><ArrowLeft className="h-4 w-4" /> Back to club</a>

      {joined ? (
        <Card className="space-y-6">
          <div className="text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success-soft text-success"><Check className="h-6 w-6" strokeWidth={2.5} /></span>
            <h1 className="mt-4 text-title text-ink">You're in</h1>
            <p className="text-ink-2">{joined.member.name} · position #{joined.member.rotationPosition}</p>
          </div>
          <div className="rounded-xl bg-subtle p-4">
            <p className="text-sm text-muted">Your dedicated contribution account · {joined.member.dedicatedBankName}</p>
            <p className="tabular mt-1 text-3xl font-semibold tracking-wide text-ink">{joined.member.dedicatedAccountNumber}</p>
          </div>
          <Button size="lg" block onClick={() => router.push(`/club/${id}`)}>Open club dashboard</Button>
        </Card>
      ) : (
        <Card>
          <CardTitle title="Join this club" description="Verify who you are and set up your payout and deposit accounts." />
          <form onSubmit={submit} className="space-y-5">
            <Segmented value={kycMethod} onChange={setKycMethod} className="w-full" options={[{ value: 'BVN', label: 'BVN' }, { value: 'NIN', label: 'NIN' }]} />
            <Field label={`11-digit ${kycMethod}`} hint="Used once to confirm your name matches your bank account. We keep only a hash and the last 4 digits.">
              <Input required inputMode="numeric" maxLength={11} value={identityNumber} onChange={(e) => setIdentityNumber(e.target.value.replace(/\D/g, ''))} className="tabular" />
            </Field>
            <BankAccountPicker label="Payout account" value={account} onChange={setAccount} />
            {!isMock && <Notice tone="warning">FossaPay charges per lookup: ₦70 for a BVN, ₦120 for a NIN.</Notice>}
            {error && <Notice tone="danger">{error}</Notice>}
            <Button type="submit" size="lg" block loading={submitting} disabled={!account.accountName || identityNumber.length !== 11}>Verify and join</Button>
          </form>
        </Card>
      )}
    </Page>
  );
}
