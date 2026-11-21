'use client';

import React, { useState } from 'react';
import { ArrowRight, Check, Copy, Plus, Trash2 } from 'lucide-react';
import { BankAccountPicker, Button, ButtonLink, Card, Field, Input, Intro, Notice, Points, Segmented, Stage, emptyBankAccount, useMode, type BankAccountValue } from '@fossapay/ui';

type Row = { name: string; amount: string };

export default function CreateRoomPage() {
  const { isMock } = useMode();

  const [title, setTitle] = useState(isMock ? 'Dinner at Cactus Restaurant' : '');
  const [totalAmount, setTotalAmount] = useState(isMock ? '60000' : '');
  const [mode, setMode] = useState<'equal' | 'itemized'>('equal');
  const [hostName, setHostName] = useState(isMock ? 'Tunde Balogun' : '');
  const [hostPhone, setHostPhone] = useState(isMock ? '08099887766' : '');
  const [friends, setFriends] = useState<Row[]>(isMock ? [{ name: 'Friend A', amount: '15000' }, { name: 'Friend B', amount: '15000' }, { name: 'Friend C', amount: '15000' }] : [{ name: '', amount: '' }]);
  const [hostShare, setHostShare] = useState(isMock ? '15000' : '');
  const [account, setAccount] = useState<BankAccountValue>(isMock ? { bankCode: '058', bankName: '', accountNumber: '9988776655', accountName: '' } : emptyBankAccount);

  const [createdRoom, setCreatedRoom] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const setFriend = (i: number, patch: Partial<Row>) => setFriends((f) => f.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const filled = friends.filter((f) => f.name.trim());

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account.accountName) return;
    setSubmitting(true);
    setError(null);
    try {
      const hostLabel = `${hostName || account.accountName} (Host)`;
      const participantInputs = mode === 'equal' ? [{ name: hostLabel }, ...filled.map((f) => ({ name: f.name }))] : [{ name: hostLabel, amount: hostShare }, ...filled.map((f) => ({ name: f.name, amount: f.amount }))];
      // Itemised: the room total is the sum of the shares (the API requires a total either way)
      const itemisedTotal = participantInputs.reduce((sum, p) => sum + Number((p as { amount?: string }).amount || 0), 0);
      const res = await fetch(`${basePath}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          totalAmount: mode === 'equal' ? totalAmount : String(itemisedTotal),
          splitMode: mode,
          host: { name: account.accountName, phone: hostPhone, bankName: account.bankName || 'Commercial Bank', bankCode: account.bankCode, accountNumber: account.accountNumber, accountName: account.accountName },
          participantInputs,
        }),
      });
      const json = await res.json();
      if (json.status === 'success') setCreatedRoom(json.data);
      else setError(json.message || 'Could not create the room');
    } catch {
      setError('Network error, please try again');
    } finally {
      setSubmitting(false);
    }
  };

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const basePath = typeof window !== 'undefined' && window.location.pathname.startsWith('/squadpay') ? '/squadpay' : '';
  const link = createdRoom ? `${origin}${basePath}/r/${createdRoom.id}` : '';

  return (
    <Stage
      wide
      intro={
        <Intro
          title={
            <>
              Split the bill.
              <br />
              <span className="text-brand">Skip the chasing.</span>
            </>
          }
          lead="Everyone pays their share into their own account. The total lands in yours, automatically."
        >
          <Points items={['Equal splits or itemised, down to the last kobo', 'Live status as each friend pays', 'One payout to your bank when the room is settled']} />
        </Intro>
      }
    >
      {createdRoom ? (
        <Card className="space-y-6">
          <div>
            <p className="text-sm font-medium text-success-ink">Room ready</p>
            <h2 className="mt-1 text-xl font-semibold text-ink">{createdRoom.title}</h2>
            <p className="tabular text-sm text-ink-2">₦{Number(createdRoom.totalAmount).toLocaleString('en-NG')} · {createdRoom.participants.length} people</p>
          </div>
          <Field label="Share this link with your group">
            <div className="flex gap-2">
              <Input readOnly value={link} onFocus={(e) => e.currentTarget.select()} className="tabular text-sm" />
              <Button
                variant="secondary"
                onClick={() => {
                  navigator.clipboard.writeText(link);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1800);
                }}
              >
                {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </Field>
          <ButtonLink href={`${basePath}/r/${createdRoom.id}`} size="lg" block>
            Open room <ArrowRight className="h-4 w-4" />
          </ButtonLink>
        </Card>
      ) : (
        <Card>
          <form onSubmit={submit} className="space-y-4">
            <Field label="What's the bill for?">
              <Input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Dinner, trip, rent…" />
            </Field>

            <Segmented className="w-full" value={mode} onChange={setMode} options={[{ value: 'equal', label: 'Split equally' }, { value: 'itemized', label: 'Custom amounts' }]} />

            {mode === 'equal' && (
              <Field label="Total (₦, whole naira)">
                <Input required type="number" min="1" step="1" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} className="tabular" />
              </Field>
            )}

            <div className="space-y-2.5">
              <p className="text-sm font-medium text-ink-2">People</p>
              <div className="grid gap-2.5 sm:grid-cols-2">
                <Input required placeholder="Your name (host)" value={hostName} onChange={(e) => setHostName(e.target.value)} />
                <Input required inputMode="tel" placeholder="Your phone" value={hostPhone} onChange={(e) => setHostPhone(e.target.value)} />
              </div>
              {mode === 'itemized' && <Input type="number" min="1" step="1" placeholder="Your share (₦)" value={hostShare} onChange={(e) => setHostShare(e.target.value)} className="tabular" />}
              <div className={mode === 'equal' ? 'grid gap-2.5 sm:grid-cols-2' : 'space-y-2.5'}>
              {friends.map((f, i) => (
                <div key={i} className="flex gap-2.5">
                  <Input placeholder={`Friend ${i + 1}`} value={f.name} onChange={(e) => setFriend(i, { name: e.target.value })} />
                  {mode === 'itemized' && <Input type="number" min="1" step="1" placeholder="₦" value={f.amount} onChange={(e) => setFriend(i, { amount: e.target.value })} className="tabular w-32" />}
                  <button type="button" aria-label="Remove" disabled={friends.length === 1} onClick={() => setFriends((x) => x.filter((_, j) => j !== i))} className="rounded-lg px-2 text-muted transition hover:bg-subtle hover:text-danger disabled:opacity-30">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              </div>
              <Button variant="ghost" size="sm" onClick={() => setFriends((f) => [...f, { name: '', amount: '' }])}>
                <Plus className="h-4 w-4" /> Add friend
              </Button>
            </div>

            <BankAccountPicker label="Where should the money go?" value={account} onChange={setAccount} />
            {error && <Notice tone="danger">{error}</Notice>}
            <Button type="submit" size="lg" block loading={submitting} disabled={!account.accountName || filled.length === 0}>
              Create room
            </Button>
          </form>
        </Card>
      )}
    </Stage>
  );
}
