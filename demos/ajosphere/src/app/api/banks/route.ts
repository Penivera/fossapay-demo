import { NextResponse } from 'next/server';
import { fossaClient } from '@/lib/clubStore';

export async function GET() {
  try {
    const banks = await fossaClient.transfers.getSupportedBanks();
    return NextResponse.json({
      status: 'success',
      data: banks,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch banks';
    return NextResponse.json({ status: 'error', message }, { status: 500 });
  }
}
