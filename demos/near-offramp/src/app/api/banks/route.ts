import { NextResponse } from 'next/server';
import { FossaPayClient, defaultMockLedger } from '@fossapay/client';

export async function GET() {
  try {
    const client = new FossaPayClient({
      mode: process.env.FOSSAPAY_MODE === 'live' ? 'live' : 'mock',
      mockLedger: defaultMockLedger,
    });
    const banks = await client.transfers.getSupportedBanks();
    return NextResponse.json({ status: 'success', data: banks });
  } catch (err: any) {
    return NextResponse.json({ status: 'error', message: err.message }, { status: 500 });
  }
}
