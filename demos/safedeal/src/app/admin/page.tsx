'use client';

import React, { useEffect, useState } from 'react';
import { BankAccountPicker, Badge, Button, Card, Dialog, EmptyState, Notice, Page, PageHeader, Spinner, emptyBankAccount, type BankAccountValue } from '@fossapay/ui';

const naira = (v: number | string) => `₦${Number(v).toLocaleString('en-NG')}`;

export default function AdminMediationPage() {
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refundDeal, setRefundDeal] = useState<any>(null);
  const [account, setAccount] = useState<BankAccountValue>(emptyBankAccount);
  const [busy, setBusy] = useState<string | null>(null);

  const load = () =>
    fetch('/api/admin/deals')
      .then((r) => r.json())
      .then((res) => res.status === 'success' && setDeals(res.data.deals || []))
      .catch(console.error)
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const releaseToSeller = async (id: string) => {
    if (!confirm('Release the escrowed funds to the seller?')) return;
    setBusy(id);
    try {
      await fetch(`/api/deals/${id}/resolve-seller`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note: 'Resolved in favor of seller.' }) });
      await load();
    } finally {
      setBusy(null);
    }
  };

  const refund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundDeal || !account.accountName) return;
    setBusy(refundDeal.id);
    try {
      await fetch(`/api/deals/${refundDeal.id}/refund-buyer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountNumber: account.accountNumber, bankCode: account.bankCode, accountName: account.accountName, resolutionNote: 'Refund disbursed to buyer.' }),
      });
      setRefundDeal(null);
      setAccount(emptyBankAccount);
      await load();
    } finally {
      setBusy(null);
    }
  };

  const disputed = deals.filter((d) => d.status === 'DISPUTED');

  return (
    <Page narrow>
      <PageHeader title="Mediation desk" subtitle="Settle disputed escrows by releasing to the seller or refunding the buyer." />

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-muted"><Spinner /> Loading…</div>
      ) : disputed.length === 0 ? (
        <EmptyState title="No open disputes" description="When a buyer raises a dispute during inspection, it appears here for mediation." />
      ) : (
        <div className="space-y-4">
          {disputed.map((deal) => (
            <Card key={deal.id} className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-ink">{deal.title}</h3>
                  <p className="tabular text-sm text-muted">{deal.id}</p>
                </div>
                <div className="text-right">
                  <p className="tabular text-xl font-semibold text-ink">{naira(deal.price)}</p>
                  <Badge tone="warning" dot>Disputed</Badge>
                </div>
              </div>
              {deal.dispute && (
                <Notice tone="warning" title="Buyer's claim">
                  {deal.dispute.reason}
                  {deal.dispute.evidencePhotoUrl && (
                    <a href={deal.dispute.evidencePhotoUrl} target="_blank" rel="noreferrer" className="mt-2 block font-medium underline underline-offset-2">View photo evidence ↗</a>
                  )}
                </Notice>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <Button loading={busy === deal.id} onClick={() => releaseToSeller(deal.id)}>Release to seller</Button>
                <Button variant="secondary" disabled={busy === deal.id} onClick={() => setRefundDeal(deal)}>Refund buyer</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={Boolean(refundDeal)} onClose={() => setRefundDeal(null)} title="Refund the buyer">
        <form onSubmit={refund} className="space-y-5 p-5">
          <BankAccountPicker label="Buyer's refund account" value={account} onChange={setAccount} />
          <div className="grid grid-cols-2 gap-3">
            <Button variant="secondary" onClick={() => setRefundDeal(null)}>Cancel</Button>
            <Button type="submit" variant="danger" disabled={!account.accountName} loading={busy === refundDeal?.id}>Send refund</Button>
          </div>
        </form>
      </Dialog>
    </Page>
  );
}
