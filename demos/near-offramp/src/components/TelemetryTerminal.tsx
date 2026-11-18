'use client';

import React from 'react';
import { RefreshCw } from 'lucide-react';
import { Badge, Button, Card, Notice, Steps, type StepItem } from '@fossapay/ui';

export interface TelemetryStep {
  id: number;
  label: string;
  detail: string;
  status: 'pending' | 'active' | 'completed' | 'error';
  txHash?: string;
  explorerUrl?: string;
}

interface TelemetryTerminalProps {
  steps: TelemetryStep[];
  progressPercent: number;
  sessionId: string;
  onRetry?: () => void;
  isRetrying?: boolean;
}

// Server labels are SHOUTING CASE; convert to sentence case but keep brand/acronym casing
const toTitle = (s: string) => {
  const t = s.charAt(0) + s.slice(1).toLowerCase();
  return t.replace(/fossapay/gi, 'FossaPay').replace(/nibss/gi, 'NIBSS').replace(/usdc/gi, 'USDC');
};

export const TelemetryTerminal: React.FC<TelemetryTerminalProps> = ({ steps, progressPercent, sessionId, onRetry, isRetrying = false }) => {
  const hasError = steps.some((s) => s.status === 'error');
  const items: StepItem[] = steps.map((s) => ({
    title: toTitle(s.label),
    detail: s.detail,
    status: s.status === 'completed' ? 'done' : s.status,
  }));

  return (
    <Card className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-ink">Transfer in progress</h2>
          <p className="tabular mt-0.5 text-sm text-muted">Session {sessionId.slice(0, 18)}</p>
        </div>
        <Badge tone={hasError ? 'danger' : progressPercent === 100 ? 'success' : 'brand'} dot>
          {hasError ? 'Needs attention' : progressPercent === 100 ? 'Settled' : 'Processing'}
        </Badge>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-subtle" role="progressbar" aria-valuenow={progressPercent} aria-valuemin={0} aria-valuemax={100}>
        <div className={`h-full rounded-full transition-all duration-700 ease-out ${hasError ? 'bg-danger' : 'bg-brand-accent'}`} style={{ width: `${progressPercent}%` }} />
      </div>

      <Steps steps={items} />

      {hasError && onRetry && (
        <Notice tone="danger" title="The payout did not go through">
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <span>Safe to retry. The same idempotency key is reused, so you are never paid twice.</span>
            <Button size="sm" onClick={onRetry} loading={isRetrying}>
              {!isRetrying && <RefreshCw className="h-4 w-4" />} Retry payout
            </Button>
          </div>
        </Notice>
      )}
    </Card>
  );
};
