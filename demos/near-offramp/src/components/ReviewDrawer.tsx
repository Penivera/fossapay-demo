'use client';

import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { Button, Dialog, Rows } from '@fossapay/ui';
import type { Asset } from './TokenSelectModal';

interface ReviewDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  data: {
    originAsset: Asset;
    amountIn: string;
    minReceivedUsdc: string;
    netNgn: number | string;
    accountNumber: string;
    bankName: string;
    accountName: string;
    exchangeRateNgn: number | string;
  };
}

const ngn = (v: number | string) => Number(v).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const ReviewDrawer: React.FC<ReviewDrawerProps> = ({ isOpen, onClose, onConfirm, data }) => (
  <Dialog open={isOpen} onClose={onClose} title="Review and confirm">
    <div className="space-y-5 p-5">
      <div className="rounded-xl bg-subtle p-4 text-center">
        <p className="text-sm text-muted">They will receive</p>
        <p className="tabular mt-1 text-3xl font-semibold tracking-tight text-ink">₦{ngn(data.netNgn)}</p>
        <p className="mt-1 text-sm text-ink-2">{data.accountName}</p>
      </div>
      <Rows
        items={[
          { label: 'You pay', value: `${data.amountIn} ${data.originAsset.symbol} on ${data.originAsset.chain}` },
          { label: 'Rate', value: `₦${ngn(data.exchangeRateNgn)} / USD` },
          { label: 'Minimum delivered', value: `${data.minReceivedUsdc} USDC` },
          { label: 'Bank', value: data.bankName },
          { label: 'Account', value: data.accountNumber },
        ]}
      />
      <p className="flex items-start gap-2 text-sm text-ink-2">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
        The account name was verified with the bank. Payouts are idempotent, so a retry never sends twice.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Button variant="secondary" size="lg" onClick={onClose}>
          Back
        </Button>
        <Button size="lg" onClick={onConfirm}>
          Confirm
        </Button>
      </div>
    </div>
  </Dialog>
);
