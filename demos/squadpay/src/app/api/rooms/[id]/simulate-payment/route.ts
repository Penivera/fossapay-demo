import { NextRequest, NextResponse } from 'next/server';
import { squadPayStore } from '../../../../../lib/roomStore';
import { defaultMockLedger, denyInLive } from '@fossapay/client';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = denyInLive();
  if (denied) return denied;
  try {
    const { id } = await params;
    const body = await req.json();
    const { participantId } = body;

    const room = squadPayStore.getRoom(id);
    if (!room) {
      return NextResponse.json({ status: 'error', message: 'Room not found' }, { status: 404 });
    }

    const participant = room.participants.find((p) => p.id === participantId);
    if (participant?.checkout) {
      // Simulate checkout payment on ledger
      await defaultMockLedger.simulateCheckoutPayment(participant.checkout.id);
    }

    const updated = await squadPayStore.markParticipantPaid(id, participantId);
    return NextResponse.json({ status: 'success', data: updated });
  } catch (err: any) {
    return NextResponse.json({ status: 'error', message: err.message }, { status: 400 });
  }
}
