import { NextRequest, NextResponse } from 'next/server';
import { intentStore } from '../../../../../lib/intentStore';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
