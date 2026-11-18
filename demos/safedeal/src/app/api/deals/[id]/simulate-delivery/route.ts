import { NextRequest, NextResponse } from 'next/server';
import { denyInLive } from '@fossapay/client';
import { safeDealStore } from '../../../../../lib/dealStore';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = denyInLive();
  if (denied) return denied;
  try {
    const { id } = await params;
    const updated = await safeDealStore.startInspection(id);
    return NextResponse.json({ status: 'success', data: updated });
  } catch (err: any) {
    return NextResponse.json({ status: 'error', message: err.message }, { status: 400 });
  }
}
