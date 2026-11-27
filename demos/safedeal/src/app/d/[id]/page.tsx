'use client';

import React, { use, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, Check, Copy, FlaskConical } from 'lucide-react';
import { Badge, Button, ButtonLink, Card, Dialog, EmptyState, Field, Input, Notice, Page, Spinner, Steps, Textarea, useMode, type StepItem } from '@fossapay/ui';
import { saveCachedDeal, getCachedDealSnapshot } from '../../../lib/clientStorage';
import { isTerminalDealStatus, shouldAcceptDealUpdate } from '../../../lib/dealStatus';

const FLOW = ['WAITING_PAYMENT', 'ESCROW_LOCKED', 'DISPATCHED', 'INSPECTION_PERIOD', 'RELEASED'] as const;
const FLOW_LABELS: Array<{ title: string; detail: string }> = [
  { title: 'Buyer pays', detail: 'Transfer to the escrow account' },
  { title: 'Funds locked', detail: 'Held safely by FossaPay' },
  { title: 'Item dispatched', detail: 'Seller sends the item' },
  { title: 'Inspection', detail: 'Buyer checks the item' },
  { title: 'Seller paid', detail: 'Funds released to the seller' },
];

const statusTone = (s: string) => (s === 'RELEASED' ? 'success' : s === 'DISPUTED' ? 'warning' : s === 'REFUNDED' ? 'neutral' : 'brand');
const naira = (v: number | string) => `₦${Number(v).toLocaleString('en-NG')}`;

export default function DealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: dealId } = use(params);
  const sellerToken = useSearchParams().get('sellerToken');
  const { isMock } = useMode();
  const basePath = typeof window !== 'undefined' && window.location.pathname.startsWith('/safedeal') ? '/safedeal' : '';

  const [deal, setDeal] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const [buyerName, setBuyerName] = useState(isMock ? 'Chidinma Okonkwo' : '');
  const [buyerPhone, setBuyerPhone] = useState(isMock ? '08011223344' : '');
  const [buyerEmail, setBuyerEmail] = useState(isMock ? 'chidinma@safedeal.ng' : '');

  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [disputePhoto, setDisputePhoto] = useState<File | null>(null);

  const [remaining, setRemaining] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const dealRef = useRef<any>(null);
  const autoReleaseCheckedRef = useRef(false);

  const isSeller = Boolean(sellerToken && deal?.seller?.sellerToken === sellerToken);

  const applyDeal = useCallback(
    (incoming: any) => {
      if (!incoming?.id) return null;
      let accepted: any = dealRef.current;
      setDeal((prev: any) => {
        if (!shouldAcceptDealUpdate(prev, incoming)) {
          accepted = prev;
          return prev;
        }
        accepted = incoming;
        dealRef.current = incoming;
        const role = sellerToken && incoming?.seller?.sellerToken === sellerToken ? 'seller' : 'buyer';
        saveCachedDeal(incoming, role);
        return incoming;
      });
      return accepted;
    },
    [sellerToken]
  );

  const syncDealToServer = useCallback(
    async (snapshot: any, signal?: AbortSignal) => {
      if (!snapshot?.id || !snapshot?.seller) return null;
      try {
        const r = await fetch(`${basePath}/api/deals/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deal: snapshot }),
          signal,
        });
        const res = await r.json().catch(() => null);
        if (res?.status === 'success' && res.data?.id) {
          applyDeal(res.data);
          return res.data;
        }
      } catch {}
      return null;
    },
    [basePath, applyDeal]
  );

  useEffect(() => {
    let active = true;
    const ac = new AbortController();
    let es: EventSource | null = null;

    const init = async () => {
      let resolved: any = null;

      try {
        const res = await fetch(`${basePath}/api/deals/${dealId}?reconcile=1`, { signal: ac.signal });
        const data = await res.json().catch(() => null);
        if (data?.status === 'success' && data.data && active) {
          const cached = getCachedDealSnapshot(dealId);
          if (cached && shouldAcceptDealUpdate(data.data, cached)) {
            resolved = (await syncDealToServer(cached, ac.signal)) || cached;
          } else {
            resolved = data.data;
            applyDeal(data.data);
          }
        }
      } catch {
        if (!active) return;
      }

      if (!resolved && active) {
        const cached = getCachedDealSnapshot(dealId);
        if (cached) {
          applyDeal(cached);
          resolved = cached;
          await syncDealToServer(cached, ac.signal);
        }
      }

      if (!active) return;
      setLoading(false);

      const latest = dealRef.current || resolved;
      if (!latest || isTerminalDealStatus(latest.status)) {
        return;
      }

      es = new EventSource(`${basePath}/api/deals/${dealId}/stream`);
      es.addEventListener('unavailable', () => {
        es?.close();
      });
      es.onmessage = (ev) => {
        try {
          const d = JSON.parse(ev.data);
          if (active && d?.id) {
            applyDeal(d);
            if (isTerminalDealStatus(d.status)) {
              es?.close();
            }
          }
        } catch {}
      };
      es.onerror = () => {
        es?.close();
      };
    };

    init();

    return () => {
      active = false;
      ac.abort();
      es?.close();
    };
  }, [dealId, basePath, applyDeal, syncDealToServer]);

  useEffect(() => {
    if (deal?.status !== 'INSPECTION_PERIOD' || !deal.inspectionExpiresAt) {
      setRemaining(null);
      autoReleaseCheckedRef.current = false;
      return;
    }
    const tick = () => {
      const secs = Math.max(0, Math.floor((new Date(deal.inspectionExpiresAt).getTime() - Date.now()) / 1000));
      setRemaining(secs);
      if (secs === 0 && !autoReleaseCheckedRef.current) {
        autoReleaseCheckedRef.current = true;
        setTimeout(() => {
          fetch(`${basePath}/api/deals/${dealId}`)
            .then((r) => r.json())
            .then((res) => res?.status === 'success' && res.data && applyDeal(res.data))
            .catch(() => null);
        }, 500);
      }
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [deal?.status, deal?.inspectionExpiresAt, basePath, dealId, applyDeal]);

  const act = async (key: string, path: string, init?: RequestInit) => {
    setBusy(key);
    try {
      let res = await fetch(`${basePath}/api/deals/${dealId}/${path}`, { method: 'POST', ...init });
      let json = await res.json().catch(() => null);
      if ((!res.ok || json?.status !== 'success') && /not found/i.test(json?.message || '')) {
        const snapshot = dealRef.current?.seller ? dealRef.current : getCachedDealSnapshot(dealId);
        if (snapshot && (await syncDealToServer(snapshot))) {
          res = await fetch(`${basePath}/api/deals/${dealId}/${path}`, { method: 'POST', ...init });
          json = await res.json().catch(() => null);
        }
      }
      if (json?.status === 'success' && json.data?.id) {
        applyDeal(json.data);
      }
    } finally {
      setBusy(null);
    }
  };

  const startCheckout = (e: React.FormEvent) => {
    e.preventDefault();
    act('checkout', 'checkout', {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: buyerName, phone: buyerPhone, email: buyerEmail.trim() || undefined }),
    });
  };

  const submitDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy('dispute');
    try {
      let evidencePhotoUrl: string | undefined;
      if (disputePhoto) {
        const fd = new FormData();
        fd.append('photo', disputePhoto);
        const up = await (await fetch(`${basePath}/api/deals/${dealId}/upload`, { method: 'POST', body: fd })).json();
        if (up.status === 'success') evidencePhotoUrl = up.data.url;
      }
      const res = await fetch(`${basePath}/api/deals/${dealId}/dispute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: disputeReason, evidencePhotoUrl }),
      });
      const json = await res.json().catch(() => null);
      if (json?.status === 'success' && json.data?.id) {
        applyDeal(json.data);
      }
      setDisputeOpen(false);
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 text-muted">
        <Spinner /> Loading deal…
      </div>
    );
  }
  if (!deal) {
    return (
      <Page narrow>
        <EmptyState title="Deal not found" description="This link may be wrong, or the demo server restarted and cleared its memory." action={<ButtonLink href={basePath || '/'} variant="secondary">Create a new deal</ButtonLink>} />
      </Page>
    );
  }

  const idx = FLOW.indexOf((deal.status === 'DISPUTED' || deal.status === 'REFUNDED' ? 'INSPECTION_PERIOD' : deal.status) as (typeof FLOW)[number]);
  const steps: StepItem[] = FLOW_LABELS.map((s, i) => ({
    ...s,
    status: deal.status === 'RELEASED' || i < idx ? 'done' : i === idx ? (deal.status === 'DISPUTED' ? 'error' : 'active') : 'pending',
  }));

  return (
    <Page>
      <a href={basePath || '/'} className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-ink-2 transition hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> New deal
      </a>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-10">
        {/* Left: deal summary and timeline */}
        <div className="space-y-6">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-title text-ink">{deal.title}</h1>
              <Badge tone={statusTone(deal.status) as any} dot>
                {deal.status.replace(/_/g, ' ').toLowerCase()}
              </Badge>
            </div>
            {deal.description && <p className="mt-2 max-w-xl text-lead text-ink-2">{deal.description}</p>}
            <p className="tabular mt-4 text-4xl font-semibold tracking-tight text-ink">{naira(deal.price)}</p>
            <p className="text-sm text-muted">held in escrow</p>
          </div>

          {isSeller && <Notice tone="info">You are viewing this deal as the seller.</Notice>}

          <Card>
            <Steps steps={steps} />
          </Card>
        </div>

        {/* Right: the action for the current state */}
        <div className="lg:sticky lg:top-24">
          <Card className="space-y-5">
            {deal.status === 'DRAFT' && !isSeller && (
              <form onSubmit={startCheckout} className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold text-ink">Your details</h2>
                  <p className="text-sm text-ink-2">We'll create a one-time account for you to pay into.</p>
                </div>
                <Field label="Name"><Input required value={buyerName} onChange={(e) => setBuyerName(e.target.value)} /></Field>
                <Field label="Phone"><Input required inputMode="tel" value={buyerPhone} onChange={(e) => setBuyerPhone(e.target.value)} /></Field>
                <Field label="Email (optional)"><Input type="email" value={buyerEmail} onChange={(e) => setBuyerEmail(e.target.value)} placeholder="name@example.com" /></Field>
                <Button type="submit" size="lg" block loading={busy === 'checkout'}>Continue to payment</Button>
              </form>
            )}
            {deal.status === 'DRAFT' && isSeller && <p className="text-ink-2">Waiting for the buyer to open the link and start payment.</p>}

            {deal.status === 'WAITING_PAYMENT' && deal.checkout && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold text-ink">Pay {naira(deal.checkout.amountPayable ?? deal.price)}</h2>
                  <p className="text-sm text-ink-2">Make one transfer of the exact amount to this account.</p>
                </div>
                <div className="rounded-xl bg-subtle p-4">
                  <p className="text-sm text-muted">{deal.checkout.bankName}</p>
                  <div className="mt-1 flex items-center justify-between gap-3">
                    <p className="tabular text-3xl font-semibold tracking-wide text-ink">{deal.checkout.accountNumber}</p>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        navigator.clipboard.writeText(deal.checkout.accountNumber);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1800);
                      }}
                    >
                      {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                      {copied ? 'Copied' : 'Copy'}
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-muted">The account expires after 30 minutes. This page updates automatically when payment arrives.</p>
                <Button
                  size="lg"
                  block
                  loading={busy === 'reconcile'}
                  onClick={async () => {
                    setBusy('reconcile');
                    try {
                      const url = `${basePath}/api/deals/${dealId}?reconcile=1`;
                      let r = await fetch(url);
                      if (r.status === 404) {
                        const snapshot = dealRef.current?.seller ? dealRef.current : getCachedDealSnapshot(dealId);
                        if (snapshot && (await syncDealToServer(snapshot))) {
                          r = await fetch(url);
                        }
                      }
                      const res = await r.json().catch(() => null);
                      if (res?.status === 'success' && res.data) {
                        applyDeal(res.data);
                      }
                    } finally {
                      setBusy(null);
                    }
                  }}
                >
                  I have paid (Verify transfer)
                </Button>
                {isMock && (
                  <Button variant="soft" block loading={busy === 'pay'} onClick={() => act('pay', 'simulate-payment')}>
                    <FlaskConical className="h-4 w-4" /> Simulate buyer payment
                  </Button>
                )}
              </div>
            )}

            {deal.status === 'ESCROW_LOCKED' && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold text-ink">Payment received</h2>
                  <p className="text-sm text-ink-2">The funds are locked in escrow. Waiting for the seller to dispatch.</p>
                </div>
                {isSeller ? (
                  <Button size="lg" block loading={busy === 'dispatch'} onClick={() => act('dispatch', 'dispatch')}>Mark as dispatched</Button>
                ) : (
                  <Notice tone="neutral">The seller is preparing your item.</Notice>
                )}
              </div>
            )}

            {deal.status === 'DISPATCHED' && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold text-ink">On its way</h2>
                  <p className="text-sm text-ink-2">The item is with the courier.</p>
                </div>
                <Button size="lg" block loading={busy === 'deliver'} onClick={() => act('deliver', 'simulate-delivery')}>
                  Confirm package received
                </Button>
              </div>
            )}

            {deal.status === 'INSPECTION_PERIOD' && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold text-ink">Inspect your item</h2>
                  <p className="text-sm text-ink-2">
                    Funds release automatically {remaining !== null ? <strong className="tabular text-ink">in {remaining}s</strong> : 'soon'} unless you raise a dispute.
                  </p>
                </div>
                <Button size="lg" block loading={busy === 'release'} onClick={() => act('release', 'release')}>Accept and release funds</Button>
                <Button variant="secondary" block onClick={() => setDisputeOpen(true)}>Raise a dispute</Button>
              </div>
            )}

            {deal.status === 'RELEASED' && (
              <div className="space-y-2 text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success-soft text-success"><Check className="h-6 w-6" strokeWidth={2.5} /></span>
                <h2 className="text-lg font-semibold text-ink">Deal complete</h2>
                <p className="text-sm text-ink-2">Paid out to {deal.seller?.bankName} · {deal.seller?.accountNumber}</p>
              </div>
            )}

            {deal.status === 'DISPUTED' && (
              <div className="space-y-3">
                <Notice tone="warning" title="Dispute under review">{deal.dispute?.reason}</Notice>
                <ButtonLink href={`${basePath}/admin`} variant="secondary" block>Open mediation desk</ButtonLink>
              </div>
            )}

            {deal.status === 'REFUNDED' && <Notice tone="neutral" title="Refunded">The buyer has been refunded.</Notice>}
          </Card>
        </div>
      </div>

      <Dialog open={disputeOpen} onClose={() => setDisputeOpen(false)} title="Raise a dispute">
        <form onSubmit={submitDispute} className="space-y-4 p-5">
          <Field label="What went wrong?">
            <Textarea required rows={4} value={disputeReason} onChange={(e) => setDisputeReason(e.target.value)} placeholder="Describe the problem with the item" />
          </Field>
          <Field label="Photo evidence (optional)">
            <input type="file" accept="image/*" onChange={(e) => setDisputePhoto(e.target.files?.[0] || null)} className="block w-full text-sm text-ink-2 file:mr-3 file:rounded-lg file:border-0 file:bg-subtle file:px-3 file:py-2 file:text-sm file:font-medium file:text-ink hover:file:bg-line" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="secondary" onClick={() => setDisputeOpen(false)}>Cancel</Button>
            <Button type="submit" variant="danger" loading={busy === 'dispute'}>Submit dispute</Button>
          </div>
        </form>
      </Dialog>
    </Page>
  );
}
