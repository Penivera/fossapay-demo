'use client';

import React, { use, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, Copy, FlaskConical } from 'lucide-react';
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

  const basePath = typeof window !== 'undefined' && window.location.pathname.startsWith('/ajosphere') ? '/ajosphere' : '';

  const [pendingPayment, setPendingPayment] = useState<any | null>(null);
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [copied, setCopied] = useState(false);
  const verifyingRef = useRef(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`${basePath}/api/clubs/${id}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kycMethod,
          identityNumber: identityNumber.trim(),
          accountNumber: account.accountNumber,
          bankCode: account.bankCode,
          accountName: account.accountName,
          bankName: account.bankName,
        }),
      });
      const data = await res.json();
      if (data.status === 'success') {
        setJoined(data.data);
      } else if (data.status === 'payment_required') {
        setPendingPayment(data.data);
        setError(null);
      } else {
        setError(data.message || 'Failed to join');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmPayment = async (simulate = false) => {
    if (!pendingPayment?.pendingId || verifyingRef.current) return;
    verifyingRef.current = true;
    setVerifyingPayment(true);
    setError(null);
    try {
      const res = await fetch(`${basePath}/api/clubs/${id}/join/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pendingId: pendingPayment.pendingId, simulate }),
      });
      const data = await res.json();
      if (data.status === 'success') {
        setJoined(data.data);
        setPendingPayment(null);
      } else {
        setError(data.message || 'Payment not confirmed yet. Please complete the transfer and try again.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      verifyingRef.current = false;
      setVerifyingPayment(false);
    }
  };

  useEffect(() => {
    if (!pendingPayment?.pendingId || joined) return;
    let active = true;
    let inFlight = false;
    const ac = new AbortController();

    const interval = setInterval(async () => {
      if (!active || inFlight || verifyingRef.current) return;
      inFlight = true;
      try {
        const res = await fetch(`${basePath}/api/clubs/${id}/join/confirm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pendingId: pendingPayment.pendingId }),
          signal: ac.signal,
        });
        const data = await res.json();
        if (active && data.status === 'success') {
          setJoined(data.data);
          setPendingPayment(null);
        }
      } catch {} finally {
        inFlight = false;
      }
    }, 4000);

    return () => {
      active = false;
      ac.abort();
      clearInterval(interval);
    };
  }, [id, basePath, pendingPayment?.pendingId, joined]);

  return (
    <Page narrow className="max-w-xl">
      <Link href={`/club/${id}`} className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-ink-2 transition hover:text-ink"><ArrowLeft className="h-4 w-4" /> Back to club</Link>

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
      ) : pendingPayment ? (
        <Card className="space-y-6">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset bg-brand/10 text-brand ring-brand/20">
              Verification Fee Required
            </span>
            <h1 className="mt-3 text-title text-ink">Verify your {pendingPayment.kycMethod}</h1>
            <p className="mt-1 text-sm text-ink-2">
              Transfer the verification fee to confirm your identity ({pendingPayment.accountName}) and complete joining the club.
            </p>
          </div>

          <div className="rounded-xl bg-subtle p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">{pendingPayment.checkout.bankName}</span>
              <span className="text-xs text-muted">Expires in 30m</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <p className="tabular text-3xl font-semibold tracking-wide text-ink">
                {pendingPayment.checkout.accountNumber}
              </p>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  navigator.clipboard.writeText(pendingPayment.checkout.accountNumber);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1800);
                }}
              >
                {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <div className="space-y-1.5 pt-2 border-t border-line/60 text-xs">
              <div className="flex items-center justify-between text-muted">
                <span>Verification fee ({pendingPayment.kycMethod})</span>
                <span className="tabular">₦{Number(pendingPayment.checkout.amount || pendingPayment.fee).toLocaleString('en-NG')}</span>
              </div>
              <div className="flex items-center justify-between text-muted">
                <span>FossaPay checkout processing fee</span>
                <span className="tabular">₦{Number(pendingPayment.checkout.fee || 100).toLocaleString('en-NG')}</span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-line/40 text-sm font-semibold text-ink">
                <span>Total amount payable</span>
                <span className="tabular">
                  ₦{Number(pendingPayment.checkout.amountPayable || pendingPayment.fee).toLocaleString('en-NG')}
                </span>
              </div>
            </div>
          </div>

          <p className="text-xs text-muted">
            Transfer the exact amount above from your banking app. This bills the minimum amount accepted by FossaPay to cover the {pendingPayment.kycMethod} verification.
          </p>

          {error && <Notice tone="danger">{error}</Notice>}

          <Button
            size="lg"
            block
            loading={verifyingPayment}
            onClick={() => handleConfirmPayment(false)}
          >
            I have made the transfer
          </Button>

          {isMock && (
            <Button
              variant="soft"
              block
              loading={verifyingPayment}
              onClick={() => handleConfirmPayment(true)}
            >
              <FlaskConical className="h-4 w-4" /> Simulate fee payment (Sandbox)
            </Button>
          )}

          <Button
            variant="ghost"
            block
            onClick={() => {
              setPendingPayment(null);
              setError(null);
            }}
          >
            Cancel and edit details
          </Button>
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
