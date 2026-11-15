import { NextRequest, NextResponse } from 'next/server';
import { FossaPayClient, defaultMockLedger } from '@fossapay/client';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { accountNumber, bankCode } = body;

    if (!accountNumber || !bankCode) {
      return NextResponse.json(
        { status: 'error', message: 'accountNumber and bankCode are required.' },
        { status: 400 }
      );
    }

    const cleanAcct = String(accountNumber).replace(/\D/g, '');
    if (cleanAcct.length !== 10) {
      return NextResponse.json(
        { status: 'error', message: 'Account number must be exactly 10 digits.' },
        { status: 400 }
      );
    }

    const client = new FossaPayClient({
      mode: process.env.FOSSAPAY_MODE === 'live' ? 'live' : 'mock',
      mockLedger: defaultMockLedger,
    });

    const result = await client.transfers.bankEnquiry(cleanAcct, String(bankCode));
    return NextResponse.json({ status: 'success', data: result });
  } catch (error: any) {
    return NextResponse.json(
      { status: 'error', message: error?.message || 'Failed to resolve bank account.' },
      { status: 400 }
    );
  }
}
