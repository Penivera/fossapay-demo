import { NextResponse } from 'next/server';
import { FossaPayClient } from '@fossapay/client';

// Top banks fallback if running in standalone/demo environment
const FALLBACK_BANKS = [
  { name: 'OPay Digital Services', code: '100004' },
  { name: 'Moniepoint Microfinance Bank', code: '090405' },
  { name: 'Kuda Bank', code: '090267' },
  { name: 'PalmPay', code: '100033' },
  { name: 'Guaranty Trust Bank (GTBank)', code: '058' },
  { name: 'Access Bank', code: '044' },
  { name: 'Zenith Bank', code: '057' },
  { name: 'First Bank of Nigeria', code: '011' },
  { name: 'United Bank for Africa (UBA)', code: '033' },
  { name: 'Sterling Bank', code: '232' },
  { name: 'Stanbic IBTC Bank', code: '221' },
  { name: 'Wema Bank', code: '035' },
  { name: 'Providus Bank', code: '101' },
];

export async function GET() {
  const apiKey = process.env.FOSSAPAY_API_KEY;

  if (apiKey) {
    try {
      const client = new FossaPayClient({ apiKey });
      const banks = await client.transfers.getBanks();
      return NextResponse.json({ status: 'success', data: banks });
    } catch (err: any) {
      console.warn('FossaPay getBanks failed, falling back to local bank directory:', err?.message);
    }
  }

  return NextResponse.json({ status: 'success', data: FALLBACK_BANKS });
}
