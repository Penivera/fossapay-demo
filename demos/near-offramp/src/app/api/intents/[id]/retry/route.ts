import { NextRequest, NextResponse } from 'next/server';
import { intentStore } from '../../../../../lib/intentStore';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: intentId } = await params;
    const session = await intentStore.retryPayout(intentId);

    return NextResponse.json({
      status: 'success',
      data: session,
    });
  } catch (err: any) {
    return NextResponse.json(
      { status: 'error', message: err.message || 'Retry failed' },
      { status: 500 }
    );
  }
}
