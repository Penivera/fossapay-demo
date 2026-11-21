'use client';

import React, { use, useEffect, useState } from 'react';
import { AlertTriangle, ArrowLeft, Check, ChevronRight, Copy, FlaskConical } from 'lucide-react';
import { Badge, Button, ButtonLink, Card, CardTitle, EmptyState, Notice, Page, Spinner, useMode } from '@fossapay/ui';
import type { AjoClub, SimulatedDay } from '@/lib/clubStore';

const naira = (v: number | string) => `₦${Number(v).toLocaleString('en-NG')}`;
const DAYS: SimulatedDay[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];

export default function ClubDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { isMock } = useMode();

  const [club, setClub] = useState<AjoClub | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const basePath = typeof window !== 'undefined' && window.location.pathname.startsWith('/ajosphere') ? '/ajosphere' : '';

  useEffect(() => {
    const es = new EventSource(`${basePath}/api/clubs/${id}/stream`);
    es.onmessage = (ev) => {
      try {
        setClub(JSON.parse(ev.data));
      } catch {}
      setLoading(false);
    };
    es.onerror = () => {
      es.close();
      fetch(`${basePath}/api/clubs/${id}`)
        .then((r) => r.json())
        .then((d) => d.status === 'success' && setClub(d.data))
        .finally(() => setLoading(false));
    };
    return () => es.close();
  }, [id, basePath]);

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1800);
  };

  const post = async (path: string, body?: unknown) => {
    setBusy(true);
    try {
      await fetch(`${basePath}/api/clubs/${id}/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    } finally {
      setBusy(false);
    }
  };

  const payAll = async () => {
    if (!club) return;
    const round = club.rounds[club.currentRound - 1];
    if (!round) return;
    setBusy(true);
    for (const m of club.members) {
      if (!round.contributions.some((c) => c.memberId === m.id)) {
        await fetch(`${basePath}/api/clubs/${id}/simulate-deposit`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ memberId: m.id }) });
      }
    }
    setBusy(false);
  };

  if (loading) return <div className="flex flex-1 items-center justify-center gap-2 text-muted"><Spinner /> Loading club…</div>;
  if (!club)
    return (
      <Page narrow>
        <EmptyState title="Club not found" description="This link may be wrong, or the demo server restarted and cleared its memory." action={<ButtonLink href={`${basePath}/`} variant="secondary">Back to clubs</ButtonLink>} />
      </Page>
    );

  const round = club.rounds[club.currentRound - 1];
  const target = round ? Number(round.targetPotAmount) : 0;
  const collected = round ? Number(round.collectedPotAmount) : 0;
  const pct = target > 0 ? Math.min(100, Math.round((collected / target) * 100)) : 0;
  const held = round?.status === 'HELD_DEFICIT';
  const disbursed = round?.status === 'DISBURSED' || round?.status === 'DISBURSED_PARTIAL';

  return (
    <Page>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <a href={`${basePath}/`} className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-2 transition hover:text-ink"><ArrowLeft className="h-4 w-4" /> All clubs</a>
        <div className="flex items-center gap-2">
          {club.members.length < club.totalRounds && <ButtonLink href={`${basePath}/club/${club.id}/join`} size="sm" variant="soft">Join ({club.members.length}/{club.totalRounds})</ButtonLink>}
          <Button size="sm" variant="secondary" onClick={() => {
            const basePath = window.location.pathname.startsWith('/ajosphere') ? '/ajosphere' : '';
            copy(`${window.location.origin}${basePath}/club/${club.id}/join`, 'invite');
          }}>
            {copied === 'invite' ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />} {copied === 'invite' ? 'Copied' : 'Copy invite link'}
          </Button>
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-10">
        {/* Left: round summary */}
        <div className="space-y-4 lg:sticky lg:top-24">
          <Card className="space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-title text-ink">{club.name}</h1>
                <p className="mt-1 text-sm text-ink-2">Round {club.currentRound} of {club.totalRounds}</p>
              </div>
              {round && <Badge tone={disbursed ? 'success' : held ? 'warning' : 'brand'} dot>{round.status.replace(/_/g, ' ').toLowerCase()}</Badge>}
            </div>
            {round && (
              <>
                <div>
                  <p className="text-sm text-muted">Pot for {round.recipientName}</p>
                  <p className="tabular text-4xl font-semibold tracking-tight text-ink">{naira(collected)}</p>
                  <p className="tabular text-sm text-muted">of {naira(target)}</p>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-subtle" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                  <div className={`h-full rounded-full transition-all duration-500 ${held ? 'bg-warning' : 'bg-success'}`} style={{ width: `${pct}%` }} />
                </div>
              </>
            )}
          </Card>

          {held && (
            <Notice tone="warning" title="Friday payout paused: contributions missing">
              <p>The pot has {naira(collected)} of {naira(target)}.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" disabled={busy} onClick={() => post('resolve-defaulter', { action: 'wait' })}>Wait for late payment</Button>
                <Button size="sm" disabled={busy} onClick={() => post('resolve-defaulter', { action: 'disburse-partial' })}>Pay out partial pot</Button>
              </div>
            </Notice>
          )}

          {isMock && (
            <Card className="space-y-3 !p-4">
              <p className="flex items-center gap-2 text-sm font-medium text-ink-2"><FlaskConical className="h-4 w-4 text-brand" /> Sandbox controls</p>
              <div className="flex flex-wrap gap-1.5">
                {DAYS.map((d) => (
                  <button key={d} disabled={busy} onClick={() => post('advance-time', { targetDay: d })} className={`rounded-lg px-2.5 py-1 text-sm font-medium transition ${club.simulatedDay === d ? 'bg-ink text-white' : 'bg-subtle text-ink-2 hover:bg-line'}`}>
                    {d.slice(0, 3)}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                {!disbursed && <Button size="sm" variant="soft" disabled={busy} onClick={payAll}>Everyone pays</Button>}
                {disbursed && club.currentRound < club.totalRounds && <Button size="sm" disabled={busy} onClick={() => post('advance-round')}>Next round <ChevronRight className="h-4 w-4" /></Button>}
              </div>
            </Card>
          )}
        </div>

        {/* Right: members and activity */}
        <div className="space-y-6">
          <Card padded={false}>
            <div className="px-5 pt-5"><CardTitle title="Members" description={`${club.members.length} of ${club.totalRounds} joined`} /></div>
            <ul className="divide-y divide-line">
              {club.members.map((m) => {
                const paid = !!round?.contributions.find((c) => c.memberId === m.id);
                return (
                  <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                    <div className="min-w-0">
                      <p className="font-medium text-ink">{m.name} <span className="text-sm font-normal text-muted">· receives round {m.rotationPosition}</span></p>
                      <button onClick={() => copy(m.dedicatedAccountNumber, m.id)} className="tabular inline-flex items-center gap-1.5 text-sm text-ink-2 transition hover:text-ink">
                        {m.dedicatedBankName} · {m.dedicatedAccountNumber}
                        {copied === m.id ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5 text-muted" />}
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      {paid ? <Badge tone="success" dot>Paid</Badge> : <Badge dot>Pending</Badge>}
                      {isMock && !paid && !disbursed && <Button size="sm" variant="soft" disabled={busy} onClick={() => post('simulate-deposit', { memberId: m.id })}>Simulate</Button>}
                    </div>
                  </li>
                );
              })}
              {club.members.length === 0 && <li className="px-5 py-8 text-center text-sm text-muted">No members yet. Share the invite link.</li>}
            </ul>
          </Card>

          <Card padded={false}>
            <div className="px-5 pt-5"><CardTitle title="Activity" /></div>
            <ul className="max-h-72 divide-y divide-line overflow-y-auto">
              {club.auditLedger.slice().reverse().map((e) => (
                <li key={e.id} className="flex items-start justify-between gap-4 px-5 py-2.5 text-sm">
                  <span className="text-ink-2">{e.description}</span>
                  <span className="tabular shrink-0 text-xs text-muted">{new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </Page>
  );
}
