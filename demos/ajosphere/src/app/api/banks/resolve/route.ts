import { NextRequest, NextResponse } from 'next/server';
import { fossaClient } from '@/lib/clubStore';

export async function POST(req: NextRequest) {
  try {
    const { accountNumber, bankCode } = await req.json();

    if (!accountNumber || !bankCode) {
      return NextResponse.json(
        { status: 'error', message: 'accountNumber and bankCode are required' },
        { status: 400 }
      );
    }

    const cleanAcct = String(accountNumber).trim();
    if (cleanAcct.length !== 10) {
      return NextResponse.json(
        { status: 'error', message: 'Account number must be 10 digits' },
        { status: 400 }
      );
    }

    const result = await fossaClient.transfers.bankEnquiry(cleanAcct, String(bankCode));
    return NextResponse.json({
      status: 'success',
      data: result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Account name resolution failed';
    return NextResponse.json({ status: 'error', message }, { status: 400 });
  }
}
