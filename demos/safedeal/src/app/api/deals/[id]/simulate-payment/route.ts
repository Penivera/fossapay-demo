import { NextRequest, NextResponse } from 'next/server';
import { safeDealStore } from '../../../../../lib/dealStore';
import { defaultMockLedger, denyInLive } from '@fossapay/client';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = denyInLive();
  if (denied) return denied;
  try {
    const { id } = await params;
    const deal = safeDealStore.getDeal(id);
    if (!deal) {
      return NextResponse.json({ status: 'error', message: 'Deal not found' }, { status: 404 });
    }

    if (deal.checkout) {
      // Simulate payment on the mock ledger checkout
      await defaultMockLedger.simulateCheckoutPayment(deal.checkout.id);
    }

    const updated = await safeDealStore.lockEscrow(id);
    return NextResponse.json({ status: 'success', data: updated });
  } catch (err: any) {
    return NextResponse.json({ status: 'error', message: err.message }, { status: 400 });
  }
}
