import { NextRequest, NextResponse } from 'next/server';
import { safeDealStore } from '../../../../lib/dealStore';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body?.deal?.id) {
      return NextResponse.json({ status: 'error', message: 'Missing deal payload' }, { status: 400 });
    }
    const synced = safeDealStore.syncDeal(body.deal);
    return NextResponse.json({ status: 'success', data: synced });
  } catch (err: any) {
    return NextResponse.json({ status: 'error', message: err.message || 'Failed to sync deal' }, { status: 500 });
  }
}
