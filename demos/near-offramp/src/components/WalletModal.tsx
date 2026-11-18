'use client';

import React, { useState } from 'react';
import { ArrowRight, KeyRound, FlaskConical, Wallet } from 'lucide-react';
import { Dialog, Segmented, Notice, useMode } from '@fossapay/ui';
import { useNear } from '../providers/NearProvider';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'social' | 'near' | 'evm' | 'sol';

const UPCOMING: Record<Exclude<TabType, 'social'>, string[]> = {
  near: ['MyNearWallet', 'Meteor Wallet', 'HERE Wallet', 'Sender Wallet'],
  evm: ['MetaMask', 'Coinbase Wallet', 'Rabby', 'WalletConnect'],
  sol: ['Phantom', 'Solflare'],
};

function Option({ icon, title, subtitle, onClick }: { icon: React.ReactNode; title: string; subtitle: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="group flex w-full items-center gap-3.5 rounded-xl border border-line bg-surface p-3.5 text-left transition hover:border-brand-accent/60 hover:bg-brand-soft/40">
      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-subtle text-ink-2 transition group-hover:bg-brand-soft group-hover:text-brand">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium text-ink">{title}</span>
        <span className="block text-sm text-muted">{subtitle}</span>
      </span>
      <ArrowRight className="h-4 w-4 text-muted transition group-hover:translate-x-0.5 group-hover:text-brand" />
    </button>
  );
}

export const WalletModal: React.FC<WalletModalProps> = ({ isOpen, onClose }) => {
  const { connect } = useNear();
  const { isMock } = useMode();
  const [tab, setTab] = useState<TabType>('social');

  const go = async (mode: 'demo' | 'fastauth' | 'manifest') => {
    await connect(mode);
    onClose();
  };

  return (
    <Dialog open={isOpen} onClose={onClose} title="Connect a wallet">
      <div className="space-y-4 p-5">
        <Segmented
          className="w-full"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'social', label: 'Quick start' },
            { value: 'near', label: 'NEAR' },
            { value: 'evm', label: 'EVM' },
            { value: 'sol', label: 'Solana' },
          ]}
        />

        {tab === 'social' ? (
          <div className="space-y-2.5">
            {/* Sample wallet only exists in the sandbox. Live mode never offers a fake wallet. */}
            {isMock && <Option icon={<FlaskConical className="h-5 w-5" />} title="Sample wallet" subtitle="alice.near · 240.50 USDT (sandbox only)" onClick={() => go('demo')} />}
            {isMock ? (
              <Option icon={<KeyRound className="h-5 w-5" />} title="Passkey" subtitle="Simulated sign-in (sandbox only)" onClick={() => go('fastauth')} />
            ) : (
              <Option icon={<Wallet className="h-5 w-5" />} title="NEAR wallet" subtitle="Choose from supported wallets" onClick={() => go('manifest')} />
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <Notice tone="neutral">These wallet connectors are not enabled in this showcase yet.</Notice>
            <div className="grid grid-cols-2 gap-2">
              {UPCOMING[tab].map((name) => (
                <div key={name} className="flex items-center justify-between rounded-xl border border-line bg-subtle/60 px-3.5 py-3 text-sm text-muted">
                  <span>{name}</span>
                  <span className="text-xs">Soon</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
};
