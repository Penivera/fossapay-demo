import { NextRequest, NextResponse } from 'next/server';
import { safeDealStore } from '../../../../../lib/dealStore';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { reason, evidencePhotoUrl } = body;

    if (!reason) {
      return NextResponse.json({ status: 'error', message: 'Dispute reason is required' }, { status: 400 });
    }

    const updated = await safeDealStore.raiseDispute(id, { reason, evidencePhotoUrl });
    return NextResponse.json({ status: 'success', data: updated });
  } catch (err: any) {
    return NextResponse.json({ status: 'error', message: err.message }, { status: 400 });
  }
}
