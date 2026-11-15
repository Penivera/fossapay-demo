import { NextRequest, NextResponse } from 'next/server';
import { squadPayStore } from '../../../../lib/roomStore';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const room = squadPayStore.getRoom(id);

  if (!room) {
    return NextResponse.json({ status: 'error', message: `Room ${id} not found` }, { status: 404 });
  }

  return NextResponse.json({ status: 'success', data: room });
}
