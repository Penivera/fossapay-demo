'use client';

import React, { use, useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, Copy, FlaskConical } from 'lucide-react';
import { Badge, Button, ButtonLink, Card, EmptyState, Page, Spinner, useMode } from '@fossapay/ui';
import { getCachedRoomSnapshot, saveCachedRoom } from '../../../lib/clientStorage';
import { isSettledRoomStatus, shouldAcceptRoomUpdate } from '../../../lib/roomStatus';

const naira = (v: number | string) => `₦${Number(v).toLocaleString('en-NG')}`;

export default function RoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: roomId } = use(params);
  const { isMock } = useMode();

  const [room, setRoom] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [sseFailed, setSseFailed] = useState(false);
  const roomRef = useRef<any>(null);
  const basePath = typeof window !== 'undefined' && window.location.pathname.startsWith('/squadpay') ? '/squadpay' : '';

  const applyRoom = useCallback((incoming: any) => {
    if (!incoming?.id) return null;
    let accepted: any = roomRef.current;
    setRoom((prev: any) => {
      if (!shouldAcceptRoomUpdate(prev, incoming)) {
        accepted = prev;
        return prev;
      }
      accepted = incoming;
      roomRef.current = incoming;
      saveCachedRoom(incoming);
      return incoming;
    });
    return accepted;
  }, []);

  const syncRoomToServer = useCallback(
    async (snapshot: any, signal?: AbortSignal) => {
      if (!snapshot?.id || !Array.isArray(snapshot.participants)) return null;
      try {
        const res = await fetch(`${basePath}/api/rooms/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(snapshot),
          signal,
        });
        const json = await res.json().catch(() => null);
        if (json?.status === 'success' && json.data?.id) {
          applyRoom(json.data);
          return json.data;
        }
      } catch {}
      return null;
    },
    [basePath, applyRoom]
  );

  useEffect(() => {
    let active = true;
    const ac = new AbortController();
    let es: EventSource | null = null;
    setSseFailed(false);

    const init = async () => {
      let resolved: any = null;
      try {
        const res = await fetch(`${basePath}/api/rooms/${roomId}`, { signal: ac.signal });
        const json = await res.json().catch(() => null);
        if (json?.status === 'success' && json.data && active) {
          const cached = getCachedRoomSnapshot(roomId);
          if (cached && shouldAcceptRoomUpdate(json.data, cached)) {
            resolved = (await syncRoomToServer(cached, ac.signal)) || cached;
          } else {
            resolved = json.data;
            applyRoom(json.data);
          }
        }
      } catch {
        if (!active) return;
      }

      if (!resolved && active) {
        const cached = getCachedRoomSnapshot(roomId);
        if (cached) {
          applyRoom(cached);
          resolved = cached;
          await syncRoomToServer(cached, ac.signal);
        }
      }

      if (!active) return;
      setLoading(false);

      const latest = roomRef.current || resolved;
      if (!latest || isSettledRoomStatus(latest.status)) {
        return;
      }

      es = new EventSource(`${basePath}/api/rooms/${roomId}/stream`);
      es.onopen = () => {
        if (active) setSseFailed(false);
      };
      es.addEventListener('unavailable', () => {
        es?.close();
        if (active) setSseFailed(true);
      });
      es.onmessage = (ev) => {
        try {
          const parsed = JSON.parse(ev.data);
          if (active && parsed?.id) {
            applyRoom(parsed);
            if (isSettledRoomStatus(parsed.status)) {
              es?.close();
            }
          }
        } catch {}
      };
      es.onerror = () => {
        es?.close();
        if (active) setSseFailed(true);
      };
    };

    init();

    return () => {
      active = false;
      ac.abort();
      es?.close();
    };
  }, [roomId, basePath, applyRoom, syncRoomToServer]);

  // Active polling while room is active to auto-reconcile with FossaPay
  const currentRoomStatus = room?.status as string | undefined;
  useEffect(() => {
    if (!currentRoomStatus || isSettledRoomStatus(currentRoomStatus)) return;

    let active = true;
    let inFlight = false;
    const ac = new AbortController();

    const poll = async () => {
      if (!active || inFlight) return;
      inFlight = true;
      try {
        const res = await fetch(`${basePath}/api/rooms/${roomId}`, { signal: ac.signal });
        const json = await res.json().catch(() => null);
        if (!active) return;
        if (json?.status === 'success' && json.data?.id) {
          applyRoom(json.data);
        } else if (res.status === 404) {
          const snapshot = Array.isArray(roomRef.current?.participants) ? roomRef.current : getCachedRoomSnapshot(roomId);
          if (snapshot) await syncRoomToServer(snapshot, ac.signal);
        }
      } catch {} finally {
        inFlight = false;
      }
    };

    const interval = setInterval(poll, sseFailed ? 3000 : 3500);
    return () => {
      active = false;
      ac.abort();
      clearInterval(interval);
    };
  }, [roomId, basePath, currentRoomStatus, sseFailed, applyRoom, syncRoomToServer]);

  const post = async (key: string, path: string, participantId?: string) => {
    setBusy(key);
    try {
      const body = participantId ? JSON.stringify({ participantId }) : undefined;
      let res = await fetch(`${basePath}/api/rooms/${roomId}/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      let json = await res.json().catch(() => null);
      if ((!res.ok || json?.status !== 'success') && /not found/i.test(json?.message || '')) {
        const snapshot = Array.isArray(roomRef.current?.participants) ? roomRef.current : getCachedRoomSnapshot(roomId);
        if (snapshot && (await syncRoomToServer(snapshot))) {
          res = await fetch(`${basePath}/api/rooms/${roomId}/${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
          });
          json = await res.json().catch(() => null);
        }
      }
      if (json?.status === 'success' && json.data?.id) {
        applyRoom(json.data);
      }
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <div className="flex flex-1 items-center justify-center gap-2 text-muted"><Spinner /> Connecting…</div>;
  if (!room)
    return (
      <Page narrow>
        <EmptyState title="Room not found" description="This link may be wrong, or the demo server restarted and cleared its memory." action={<ButtonLink href={basePath || '/'} variant="secondary">Start a new split</ButtonLink>} />
      </Page>
    );

  const collected = parseFloat(room.collectedAmount) || 0;
  const total = parseFloat(room.totalAmount) || 1;
  const pct = Math.min(100, Math.round((collected / total) * 100));
  const settled = room.status === 'completed' || room.status === 'partially_closed';
  const paidCount = room.participants.filter((p: any) => p.status === 'paid').length;

  return (
    <Page>
      <a href={basePath || '/'} className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-ink-2 transition hover:text-ink"><ArrowLeft className="h-4 w-4" /> New split</a>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-10">
        {/* Summary */}
        <div className="lg:sticky lg:top-24">
          <Card className="space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-title text-ink">{room.title}</h1>
                <p className="mt-1 text-sm text-ink-2">Host: {room.host.name}</p>
              </div>
              <Badge tone={settled ? 'success' : 'brand'} dot>{room.status.replace(/_/g, ' ')}</Badge>
            </div>
            <div>
              <p className="tabular text-4xl font-semibold tracking-tight text-ink">{naira(collected)}</p>
              <p className="tabular text-sm text-muted">of {naira(total)} · {paidCount} of {room.participants.length} paid</p>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-subtle" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-success transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>
            {room.payout ? (
              <p className="rounded-xl bg-success-soft px-4 py-3 text-sm font-medium text-success-ink">
                {naira(room.payout.amount)} paid out to {room.host.bankName}
                <span className="tabular block text-xs font-normal opacity-80">{room.payout.reference}</span>
              </p>
            ) : (
              !settled && (
                <Button variant="secondary" block disabled={collected === 0} loading={busy === 'withdraw'} onClick={() => confirm('Withdraw what has been collected so far to the host bank account?') && post('withdraw', 'partial-withdraw')}>
                  Withdraw {naira(collected)} now
                </Button>
              )
            )}
          </Card>
        </div>

        {/* Participants */}
        <div className="space-y-3">
          {room.participants.map((p: any) => {
            const paid = p.status === 'paid';
            const expired = p.status === 'expired';
            const unsettled = p.status === 'unsettled';
            const open = openId === p.id && p.checkout && !paid && !unsettled;
            return (
              <Card key={p.id} padded={false} className="overflow-hidden">
                <div className="flex items-center justify-between gap-4 p-4 sm:px-5">
                  <div className="flex min-w-0 items-center gap-3.5">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-subtle text-sm font-semibold text-ink-2">{p.name.slice(0, 1).toUpperCase()}</span>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-ink">{p.name}</p>
                      <p className="tabular text-sm text-muted">{naira(p.amount)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {paid ? <Badge tone="success" dot>Paid</Badge> : expired ? <Badge tone="warning" dot>Expired</Badge> : unsettled ? <Badge dot>Unsettled</Badge> : <Badge dot>Pending</Badge>}
                    {!paid && !unsettled && (
                      <Button size="sm" variant={open ? 'secondary' : 'primary'} loading={busy === `co-${p.id}`} onClick={() => { setOpenId(open ? null : p.id); if (!p.checkout) post(`co-${p.id}`, 'checkout', p.id); }}>
                        {open ? 'Hide' : 'Pay share'}
                      </Button>
                    )}
                  </div>
                </div>

                {open && (
                  <div className="space-y-3 border-t border-line bg-subtle/60 p-4 sm:px-5">
                    <p className="text-sm text-ink-2">Transfer exactly <strong className="tabular text-ink">{naira(p.checkout.amountPayable ?? p.amount)}</strong> to</p>
                    <div className="flex items-center justify-between gap-3 rounded-xl bg-surface p-3.5 ring-1 ring-line">
                      <div>
                        <p className="text-xs text-muted">{p.checkout.bankName}</p>
                        <p className="tabular text-2xl font-semibold tracking-wide text-ink">{p.checkout.accountNumber}</p>
                      </div>
                      <Button size="sm" variant="secondary" onClick={() => { navigator.clipboard.writeText(p.checkout.accountNumber); setCopied(p.id); setTimeout(() => setCopied(null), 1800); }}>
                        {copied === p.id ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />} {copied === p.id ? 'Copied' : 'Copy'}
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="primary"
                        loading={busy === `reconcile-${p.id}`}
                        onClick={() => {
                          setBusy(`reconcile-${p.id}`);
                          fetch(`${basePath}/api/rooms/${roomId}`)
                            .then((r) => r.json())
                            .then((res) => {
                              if (res.status === 'success' && res.data) {
                                applyRoom(res.data);
                              }
                            })
                            .finally(() => setBusy(null));
                        }}
                      >
                        I have paid (Verify transfer)
                      </Button>
                      {expired && <Button size="sm" loading={busy === `re-${p.id}`} onClick={() => post(`re-${p.id}`, 'regenerate', p.id)}>Renew account</Button>}
                      {isMock && (
                        <>
                          <Button size="sm" variant="soft" loading={busy === `pay-${p.id}`} onClick={() => post(`pay-${p.id}`, 'simulate-payment', p.id)}><FlaskConical className="h-4 w-4" /> Simulate payment</Button>
                          {!expired && <Button size="sm" variant="ghost" onClick={() => post(`ex-${p.id}`, 'simulate-expiry', p.id)}><FlaskConical className="h-4 w-4" /> Simulate expiry</Button>}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </Page>
  );
}
