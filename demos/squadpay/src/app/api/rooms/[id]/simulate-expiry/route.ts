import { NextRequest, NextResponse } from 'next/server';
import { squadPayStore } from '../../../../../lib/roomStore';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { participantId } = body;

    const updated = await squadPayStore.simulateParticipantExpiry(id, participantId);
    return NextResponse.json({ status: 'success', data: updated });
  } catch (err: any) {
    return NextResponse.json({ status: 'error', message: err.message }, { status: 400 });
  }
}
