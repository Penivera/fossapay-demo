import { NextRequest, NextResponse } from 'next/server';
import { squadPayStore } from '../../../../lib/roomStore';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const shouldReconcile = req.nextUrl.searchParams.get('reconcile') === '1';
  if (shouldReconcile) {
    const participantId = req.nextUrl.searchParams.get('participantId') || undefined;
    await squadPayStore.reconcileRoomCheckouts(id, participantId).catch(() => null);
  }
  const room = squadPayStore.getRoom(id);

  if (!room) {
    return NextResponse.json({ status: 'error', message: `Room ${id} not found` }, { status: 404 });
  }

  return NextResponse.json({ status: 'success', data: room });
}
