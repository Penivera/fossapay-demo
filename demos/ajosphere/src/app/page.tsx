'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { Badge, Button, ButtonLink, Card, CardTitle, Field, Input, Intro, Notice, Spinner, Stage, useMode } from '@fossapay/ui';

interface ClubSummary {
  id: string;
  name: string;
  contributionAmount: string;
  totalRounds: number;
  currentRound: number;
  status: string;
  members: Array<{ id: string; name: string }>;
}

const naira = (v: number | string) => `₦${Number(v).toLocaleString('en-NG')}`;

export default function AjoHomePage() {
  const router = useRouter();
  const { isMock } = useMode();
  const [clubs, setClubs] = useState<ClubSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', contributionAmount: isMock ? '20000' : '', totalRounds: isMock ? '5' : '' });

  useEffect(() => {
    fetch('/api/clubs')
      .then((r) => r.json())
      .then((d) => d.status === 'success' && setClubs(d.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const res = await fetch('/api/clubs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, contributionAmount: form.contributionAmount, totalRounds: Number(form.totalRounds) }),
      });
      const data = await res.json();
      if (data.status === 'success') router.push(`/club/${data.data.id}`);
      else setError(data.message || 'Failed to create club');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Stage
      wide
      intro={
        <Intro
          title={
            <>
              Save together.
              <br />
              <span className="text-brand">Get paid in turn.</span>
            </>
          }
          lead="A digital Ajo circle: everyone contributes weekly, one member receives the whole pot each round."
        >
          <div className="space-y-3">
            {loading && <div className="flex items-center gap-2 text-muted"><Spinner className="h-4 w-4" /> Loading clubs…</div>}
            {!loading && clubs.length > 0 && <p className="text-sm font-medium text-ink-2">Open clubs</p>}
            {clubs.map((club) => {
              const full = club.members.length >= club.totalRounds;
              return (
                <Card key={club.id} className="flex items-center justify-between gap-4 !p-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium text-ink">{club.name}</p>
                      <Badge>Round {club.currentRound}/{club.totalRounds}</Badge>
                    </div>
                    <p className="tabular text-sm text-muted">{naira(club.contributionAmount)}/week · pot {naira(Number(club.contributionAmount) * club.totalRounds)} · {club.members.length}/{club.totalRounds} members</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {!full && <ButtonLink href={`/club/${club.id}/join`} size="sm" variant="soft">Join</ButtonLink>}
                    <ButtonLink href={`/club/${club.id}`} size="sm" variant="secondary">Open <ArrowRight className="h-3.5 w-3.5" /></ButtonLink>
                  </div>
                </Card>
              );
            })}
            {!loading && clubs.length === 0 && <p className="text-sm text-muted">No clubs yet. Start the first one.</p>}
          </div>
        </Intro>
      }
    >
      <Card>
        <CardTitle title="Start a club" description="Invite members with a link once it's created." />
        <form onSubmit={create} className="space-y-5">
          <Field label="Club name">
            <Input required placeholder="e.g. Lagos Techies Ajo" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Weekly share (₦)">
              <Input required type="number" min="1000" step="1000" value={form.contributionAmount} onChange={(e) => setForm({ ...form, contributionAmount: e.target.value })} className="tabular" />
            </Field>
            <Field label="Members and rounds">
              <Input required type="number" min="2" max="20" value={form.totalRounds} onChange={(e) => setForm({ ...form, totalRounds: e.target.value })} className="tabular" />
            </Field>
          </div>
          {error && <Notice tone="danger">{error}</Notice>}
          <Button type="submit" size="lg" block loading={creating}>Create club</Button>
        </form>
      </Card>
    </Stage>
  );
}
