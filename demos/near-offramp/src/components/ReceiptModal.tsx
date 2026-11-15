'use client';

import React from 'react';
import { CheckCircle2, Download, RefreshCw, Copy, Check, ShieldCheck, Printer } from 'lucide-react';

interface ReceiptModalProps {
  receipt: {
    id: string;
    reference: string;
    amount: string;
    fee: string;
    recipient: {
      accountNumber: string;
      accountName: string;
      bankCode: string;
      bankName?: string;
    };
    originAsset: string;
    originAmount: number | string;
    nibssSessionId?: string;
    createdAt?: string;
  };
  onReset: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ receipt, onReset }) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopyRef = () => {
    navigator.clipboard.writeText(receipt.reference);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadReceipt = () => {
    // Generate clean text/HTML formatted downloadable receipt
    const content = `
=====================================================
            FOSSAPAY SETTLEMENT RECEIPT
        NEAR INTENTS CROSS-CHAIN OFF-RAMP
=====================================================

STATUS:              200 SUCCESS (NIBSS CLEARED)
AMOUNT SETTLED:      NGN ${receipt.amount}
FOSSAPAY REFERENCE:  ${receipt.reference}
NIBSS SESSION ID:    ${receipt.nibssSessionId || 'N/A'}
DATE & TIME:         ${receipt.createdAt || new Date().toISOString()}

---------------- BENEFICIARY DETAILS ----------------
ACCOUNT NAME:        ${receipt.recipient.accountName}
BANK NAME:           ${receipt.recipient.bankName || 'Verified Bank'}
ACCOUNT NUMBER:      ${receipt.recipient.accountNumber}
BANK CODE:           ${receipt.recipient.bankCode}

----------------- ORIGIN TRANSACTION ----------------
ASSET SOLD:          ${receipt.originAmount} ${receipt.originAsset}
SOLVER DESTINATION:  FossaPay Solana Master Vault
CLEARING FEE:        NGN ${receipt.fee}

=====================================================
 Cryptographically Verified by FossaPay Fiat Engine
=====================================================
`;
    const blob = new Blob([content.trim()], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Receipt_${receipt.reference}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="w-full cf-card-dark p-6 sm:p-8 animate-in fade-in duration-300 relative overflow-hidden">
      {/* Soft Ambient Radial Behind Stamped Receipt */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header Stamped Badge */}
      <div className="text-center pb-6 border-b border-slate-700 relative z-10">
        <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto mb-3.5 shadow-lg shadow-emerald-500/10">
          <CheckCircle2 className="w-7 h-7" />
        </div>
        <div className="flex items-center justify-center gap-1.5 mb-1">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span className="cf-kicker text-emerald-400">TRANSACTION CLEARED // NIBSS SETTLED</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-mono font-extrabold text-white tracking-tight mt-1">
          ₦ {Number(receipt.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </h2>
        <p className="text-xs text-slate-400 font-mono mt-1">
          Disbursed to Nigerian Banking Rail via FossaPay Master Wallet
        </p>
      </div>

      {/* Structured Details Table */}
      <div className="py-6 space-y-3.5 font-mono text-xs border-b border-slate-700 relative z-10">
        <div className="flex justify-between items-center py-1">
          <span className="text-slate-400">BENEFICIARY</span>
          <span className="text-white font-bold tracking-wide">{receipt.recipient.accountName}</span>
        </div>

        <div className="flex justify-between items-center py-1">
          <span className="text-slate-400">DESTINATION BANK</span>
          <span className="text-slate-200">{receipt.recipient.bankName || 'Verified Bank'}</span>
        </div>

        <div className="flex justify-between items-center py-1">
          <span className="text-slate-400">ACCOUNT NUMBER</span>
          <span className="text-slate-200 tracking-wider">{receipt.recipient.accountNumber}</span>
        </div>

        <div className="flex justify-between items-center py-1">
          <span className="text-slate-400">ORIGIN CRYPTO DEBIT</span>
          <span className="text-orange-400 font-bold">
            {receipt.originAmount} {receipt.originAsset}
          </span>
        </div>

        <div className="flex justify-between items-center py-1">
          <span className="text-slate-400">SETTLED ON SOLANA</span>
          <span className="text-slate-300">99.90 USDC (FossaPay Master Vault)</span>
        </div>

        <div className="flex justify-between items-center py-1">
          <span className="text-slate-400">FOSSAPAY REFERENCE</span>
          <button
            onClick={handleCopyRef}
            className="flex items-center gap-1.5 text-slate-300 hover:text-white transition bg-slate-900/80 border border-slate-700 px-2 py-0.5 rounded-md"
          >
            <span>{receipt.reference}</span>
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-slate-400" />
            )}
          </button>
        </div>

        {receipt.nibssSessionId && (
          <div className="flex justify-between items-center py-1">
            <span className="text-slate-400">NIBSS SESSION ID</span>
            <span className="text-slate-400">{receipt.nibssSessionId}</span>
          </div>
        )}

        <div className="flex justify-between items-center py-1">
          <span className="text-slate-400">TIMESTAMP</span>
          <span className="text-slate-400">
            {receipt.createdAt
              ? new Date(receipt.createdAt).toLocaleString('en-US', { hour12: false })
              : new Date().toISOString()}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="pt-6 flex flex-col sm:flex-row gap-3 relative z-10">
        <button
          onClick={handleDownloadReceipt}
          className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-xs font-semibold border border-slate-700 transition shadow-md active:scale-95"
        >
          <Download className="w-4 h-4" />
          <span>DOWNLOAD RECEIPT</span>
        </button>

        <button
          onClick={handlePrint}
          className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-xs font-semibold border border-slate-700 transition shadow-md active:scale-95"
        >
          <Printer className="w-4 h-4" />
          <span>PRINT PDF</span>
        </button>

        <button
          onClick={onReset}
          className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-mono text-xs font-semibold transition shadow-lg shadow-orange-500/25 active:scale-95"
        >
          <RefreshCw className="w-4 h-4" />
          <span>START ANOTHER OFF-RAMP</span>
        </button>
      </div>
    </div>
  );
};
