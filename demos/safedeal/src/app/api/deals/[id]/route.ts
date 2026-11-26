import { NextRequest, NextResponse } from 'next/server';
import { safeDealStore } from '../../../../lib/dealStore';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let deal = safeDealStore.getDeal(id);

  if (deal && deal.status === 'WAITING_PAYMENT') {
    deal = await safeDealStore.reconcileCheckout(id);
  }
  if (deal && deal.status === 'INSPECTION_PERIOD' && deal.inspectionExpiresAt && Date.now() >= new Date(deal.inspectionExpiresAt).getTime()) {
    await safeDealStore.checkAndAutoRelease(id).catch(() => null);
    deal = safeDealStore.getDeal(id);
  }

  if (!deal) {
    return NextResponse.json({ status: 'error', message: `Deal ${id} not found` }, { status: 404 });
  }

  return NextResponse.json({ status: 'success', data: deal });
}
