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

    if (!participantId) {
      return NextResponse.json({ status: 'error', message: 'participantId is required' }, { status: 400 });
    }

    const updated = await squadPayStore.generateParticipantCheckout(id, participantId, true);
    return NextResponse.json({ status: 'success', data: updated });
  } catch (err: any) {
    return NextResponse.json({ status: 'error', message: err.message }, { status: 400 });
  }
}
