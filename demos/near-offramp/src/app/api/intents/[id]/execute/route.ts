import { NextRequest, NextResponse } from 'next/server';
import { isLiveMode } from '@fossapay/client';
import { intentStore } from '../../../../../lib/intentStore';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Executing would disburse real naira from the FossaPay master wallet, but the crypto deposit leg is
  // simulated and cannot be verified. Refuse rather than pay out against funds that never arrived.
  if (isLiveMode()) {
    return NextResponse.json(
      { status: 'error', message: 'Live execution is disabled: the cross-chain deposit cannot be verified in this build, so no payout is sent.' },
      { status: 501 }
    );
  }
  try {
    const { id: intentId } = await params;
    const body = await req.json().catch(() => ({}));
    const { originTxHash, simulatePayoutFailure } = body;

    const session = await intentStore.executeSession(intentId, {
      originTxHash,
      simulatePayoutFailure,
    });

    return NextResponse.json({
      status: 'success',
      data: session,
    });
  } catch (err: any) {
    return NextResponse.json(
      { status: 'error', message: err.message || 'Execution failed' },
      { status: 500 }
    );
  }
}
