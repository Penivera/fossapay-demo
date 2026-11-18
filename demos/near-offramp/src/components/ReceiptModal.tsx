'use client';

import React from 'react';
import { Check, Copy, Download, Plus } from 'lucide-react';
import { Button, Card, Rows } from '@fossapay/ui';

interface ReceiptModalProps {
  receipt: {
    id: string;
    reference: string;
    amount: string;
    fee: string;
    recipient: { accountNumber: string; accountName: string; bankCode: string; bankName?: string };
    originAsset: string;
    originAmount: number | string;
    nibssSessionId?: string;
    createdAt?: string;
  };
  onReset: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ receipt, onReset }) => {
  const [copied, setCopied] = React.useState(false);

  const copyRef = () => {
    navigator.clipboard.writeText(receipt.reference);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const download = () => {
    const lines = [
      'FOSSAPAY SETTLEMENT RECEIPT',
      '',
      `Amount settled:  NGN ${receipt.amount}`,
      `Reference:       ${receipt.reference}`,
      `Session ID:      ${receipt.nibssSessionId || 'N/A'}`,
      `Date:            ${receipt.createdAt || new Date().toISOString()}`,
      '',
      `Beneficiary:     ${receipt.recipient.accountName}`,
      `Bank:            ${receipt.recipient.bankName || receipt.recipient.bankCode}`,
      `Account number:  ${receipt.recipient.accountNumber}`,
      '',
      `Asset sold:      ${receipt.originAmount} ${receipt.originAsset}`,
      `Payout fee:      NGN ${receipt.fee}`,
    ].join('\n');
    const url = URL.createObjectURL(new Blob([lines], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `Receipt_${receipt.reference}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="space-y-6">
      <div className="text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success-soft text-success ring-1 ring-success/20">
          <Check className="h-6 w-6" strokeWidth={2.5} />
        </span>
        <p className="mt-4 text-sm font-medium text-success-ink">Transfer complete</p>
        <p className="tabular mt-1 text-4xl font-semibold tracking-tight text-ink">₦{Number(receipt.amount).toLocaleString('en-NG', { minimumFractionDigits: 2 })}</p>
        <p className="mt-1 text-sm text-ink-2">sent to {receipt.recipient.accountName}</p>
      </div>

      <Rows
        items={[
          { label: 'Bank', value: receipt.recipient.bankName || receipt.recipient.bankCode },
          { label: 'Account', value: receipt.recipient.accountNumber },
          { label: 'Sold', value: `${receipt.originAmount} ${receipt.originAsset}` },
          {
            label: 'Reference',
            value: (
              <button onClick={copyRef} className="inline-flex items-center gap-1.5 rounded-md bg-subtle px-2 py-0.5 text-sm transition hover:bg-line">
                {receipt.reference}
                {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5 text-muted" />}
              </button>
            ),
          },
          ...(receipt.nibssSessionId ? [{ label: 'Session', value: receipt.nibssSessionId }] : []),
        ]}
      />

      <div className="grid grid-cols-2 gap-3">
        <Button variant="secondary" size="lg" onClick={download}>
          <Download className="h-4 w-4" /> Receipt
        </Button>
        <Button size="lg" onClick={onReset}>
          <Plus className="h-4 w-4" /> New transfer
        </Button>
      </div>
    </Card>
  );
};
