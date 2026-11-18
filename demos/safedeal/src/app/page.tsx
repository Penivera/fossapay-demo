'use client';

import React, { useState } from 'react';
import { ArrowRight, Check, Copy } from 'lucide-react';
import { BankAccountPicker, Button, ButtonLink, Card, Field, Input, Intro, Points, Stage, Textarea, emptyBankAccount, useMode, type BankAccountValue } from '@fossapay/ui';

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Field label={label}>
      <div className="flex gap-2">
        <Input readOnly value={value} onFocus={(e) => e.currentTarget.select()} className="tabular text-sm" />
        <Button
          variant="secondary"
          onClick={() => {
            navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          }}
        >
          {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
    </Field>
  );
}

export default function CreateDealPage() {
  const { isMock } = useMode();

  // Sample values pre-fill in the sandbox only
  const [title, setTitle] = useState(isMock ? 'iPhone 13, 128GB Midnight' : '');
  const [description, setDescription] = useState(isMock ? 'Brand new, open box. 100% battery health.' : '');
  const [price, setPrice] = useState(isMock ? '420000' : '');
  const [sellerName, setSellerName] = useState(isMock ? 'Tunde Balogun' : '');
  const [sellerPhone, setSellerPhone] = useState(isMock ? '08099887766' : '');
  const [account, setAccount] = useState<BankAccountValue>(isMock ? { bankCode: '058', bankName: '', accountNumber: '9988776655', accountName: '' } : emptyBankAccount);

  const [createdDeal, setCreatedDeal] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account.accountName) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          price,
          inspectionPeriodSeconds: 15,
          seller: { name: sellerName, phone: sellerPhone, bankName: account.bankName || 'Commercial Bank', bankCode: account.bankCode, accountNumber: account.accountNumber, accountName: account.accountName },
        }),
      });
      const json = await res.json();
      if (json.status === 'success') setCreatedDeal(json.data);
      else setError(json.message || 'Could not create the deal');
    } catch {
      setError('Network error, please try again');
    } finally {
      setIsSubmitting(false);
    }
  };

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const buyerLink = createdDeal ? `${origin}/d/${createdDeal.id}` : '';
  const sellerLink = createdDeal ? `${buyerLink}?sellerToken=${createdDeal.seller.sellerToken}` : '';

  return (
    <Stage
      wide
      intro={
        <Intro
          title={
            <>
              Sell on social.
              <br />
              <span className="text-brand">Get paid safely.</span>
            </>
          }
          lead="Create an escrow link for your WhatsApp or Instagram sale. The buyer's money is held until they confirm the item."
        >
          <Points items={['Buyer pays into a dedicated 30-minute account', 'Funds are locked until delivery is confirmed', 'Disputes go to a mediation desk, refunds are one click']} />
        </Intro>
      }
    >
      {createdDeal ? (
        <Card className="space-y-6">
          <div>
            <p className="text-sm font-medium text-success-ink">Deal link ready</p>
            <h2 className="mt-1 text-xl font-semibold text-ink">{createdDeal.title}</h2>
            <p className="tabular text-sm text-ink-2">₦{Number(createdDeal.price).toLocaleString('en-NG')} · {createdDeal.id}</p>
          </div>
          <CopyRow label="Buyer link, share this on WhatsApp or DM" value={buyerLink} />
          <CopyRow label="Seller link, keep this private" value={sellerLink} />
          <ButtonLink href={`/d/${createdDeal.id}`} size="lg" block>
            Open buyer view <ArrowRight className="h-4 w-4" />
          </ButtonLink>
        </Card>
      ) : (
        <Card>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-[1fr_9.5rem]">
              <Field label="Item">
                <Input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What are you selling?" />
              </Field>
              <Field label="Price (₦)">
                <Input required type="number" min="100" step="1" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" className="tabular" />
              </Field>
            </div>
            <Field label="Description">
              <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Condition, accessories, delivery details" className="min-h-16" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Your name">
                <Input required value={sellerName} onChange={(e) => setSellerName(e.target.value)} />
              </Field>
              <Field label="Phone">
                <Input required inputMode="tel" value={sellerPhone} onChange={(e) => setSellerPhone(e.target.value)} />
              </Field>
            </div>
            <BankAccountPicker label="Where should we pay you?" value={account} onChange={setAccount} />
            {error && <p className="text-sm font-medium text-danger-ink">{error}</p>}
            <Button type="submit" size="lg" block loading={isSubmitting} disabled={!account.accountName}>
              Create escrow link
            </Button>
          </form>
        </Card>
      )}
    </Stage>
  );
}
