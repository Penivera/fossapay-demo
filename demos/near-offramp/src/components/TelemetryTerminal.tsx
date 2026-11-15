'use client';

import React from 'react';
import { Loader2, CheckCircle2, AlertCircle, ExternalLink, Zap, RefreshCw } from 'lucide-react';

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

export const TelemetryTerminal: React.FC<TelemetryTerminalProps> = ({
  steps,
  progressPercent,
  sessionId,
  onRetry,
  isRetrying = false,
}) => {
  const hasError = steps.some((s) => s.status === 'error');

  return (
    <div className="w-full cf-card-dark overflow-hidden p-6 sm:p-8 relative">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-700">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                hasError ? 'bg-red-500' : 'bg-orange-500 animate-ping'
              }`}
            />
            <span className="cf-kicker">SETTLEMENT ENGINE // ACTIVE INTENT</span>
          </div>
          <h3 className="text-lg font-bold text-white font-sans mt-1">
            Cross-Chain Liquidation Telemetry
          </h3>
        </div>
        <div className="text-right">
          <span
            className={`cf-badge font-mono text-[10px] ${
              hasError
                ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                : progressPercent === 100
                ? 'cf-badge-green'
                : 'cf-badge-orange'
            }`}
          >
            {hasError ? 'ACTION REQUIRED' : progressPercent === 100 ? 'SETTLED' : 'EXECUTING'}
          </span>
          <div className="text-[10px] font-mono text-slate-400 mt-1">
            SESSION: {sessionId.slice(0, 16)}
          </div>
        </div>
      </div>

      {/* Stepped Telemetry Log */}
      <div className="space-y-3.5 relative">
        <div className="absolute left-[26px] top-6 bottom-6 w-px bg-slate-800 -z-0" />

        {steps.map((s) => (
          <div
            key={s.id}
            className={`p-4 rounded-xl border transition-all duration-300 relative z-10 ${
              s.status === 'completed'
                ? 'bg-slate-900/80 border-slate-700 shadow-sm'
                : s.status === 'active'
                ? 'bg-orange-950/20 border-orange-500/40 shadow-lg shadow-orange-950/20'
                : s.status === 'error'
                ? 'bg-red-950/20 border-red-500/40 shadow-lg shadow-red-950/20'
                : 'bg-slate-950/30 border-slate-800 text-slate-500'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <span
                  className={`w-6 h-6 rounded-lg flex items-center justify-center font-mono text-xs font-bold transition-colors ${
                    s.status === 'completed'
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : s.status === 'active'
                      ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40 animate-pulse'
                      : s.status === 'error'
                      ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                      : 'bg-slate-800/60 text-slate-500 border border-slate-700'
                  }`}
                >
                  0{s.id}
                </span>

                <span
                  className={`text-sm tracking-tight ${
                    s.status === 'completed'
                      ? 'text-slate-200 font-semibold'
                      : s.status === 'active'
                      ? 'text-white font-bold'
                      : s.status === 'error'
                      ? 'text-red-300 font-bold'
                      : 'text-slate-400 font-medium'
                  }`}
                >
                  {s.label}
                </span>
              </div>

              {/* Status Pill */}
              <div>
                {s.status === 'completed' && (
                  <span className="flex items-center gap-1.5 text-emerald-400 font-mono text-xs font-semibold bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>DONE</span>
                  </span>
                )}
                {s.status === 'active' && (
                  <span className="flex items-center gap-1.5 text-orange-400 font-mono text-xs font-semibold bg-orange-500/10 border border-orange-500/20 px-2.5 py-0.5 rounded-full">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>RUNNING</span>
                  </span>
                )}
                {s.status === 'error' && (
                  <span className="flex items-center gap-1.5 text-red-400 font-mono text-xs font-semibold bg-red-500/10 border border-red-500/20 px-2.5 py-0.5 rounded-full">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>FAILED</span>
                  </span>
                )}
                {s.status === 'pending' && (
                  <span className="text-slate-500 font-mono text-[11px] uppercase tracking-wider px-2 py-0.5">
                    QUEUED
                  </span>
                )}
              </div>
            </div>

            {/* Step Detail & Explorer Link */}
            <div className="mt-2 pl-9 flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-1.5">
              <span
                className={`font-mono text-[11px] ${
                  s.status === 'active'
                    ? 'text-orange-200/90'
                    : s.status === 'error'
                    ? 'text-red-300'
                    : 'text-slate-400'
                }`}
              >
                {s.detail}
              </span>

              {s.txHash && (
                <span className="font-mono text-[11px] text-slate-400 flex items-center gap-1 bg-slate-900/90 border border-slate-700 px-2 py-0.5 rounded-md self-start sm:self-auto hover:text-white transition">
                  <Zap className="w-3 h-3 text-orange-400" />
                  <span>
                    {s.txHash.length > 18
                      ? `${s.txHash.slice(0, 8)}...${s.txHash.slice(-6)}`
                      : s.txHash}
                  </span>
                  <ExternalLink className="w-3 h-3 text-slate-500 ml-0.5" />
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Retry Action if Payout Failed */}
      {hasError && onRetry && (
        <div className="mt-6 pt-4 border-t border-slate-700 flex items-center justify-between">
          <div className="text-xs font-mono text-red-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span>Bank network timeout. Idempotency key preserved.</span>
          </div>
          <button
            onClick={onRetry}
            disabled={isRetrying}
            className="flex items-center gap-2 py-2 px-4 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-mono text-xs font-bold transition shadow-lg shadow-orange-600/30 active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
            <span>RETRY SETTLEMENT</span>
          </button>
        </div>
      )}

      {/* Progress Bar at Bottom */}
      <div className="w-full bg-slate-800/40 h-1 absolute bottom-0 left-0">
        <div
          className="cf-progress-bar h-1"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
};
