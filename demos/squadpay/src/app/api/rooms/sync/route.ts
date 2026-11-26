import { NextRequest, NextResponse } from 'next/server';
import { squadPayStore } from '../../../../lib/roomStore';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const roomPayload = body?.room || body;
    if (!roomPayload?.id || !Array.isArray(roomPayload.participants)) {
      return NextResponse.json({ status: 'error', message: 'Missing room data' }, { status: 400 });
    }
    const synced = squadPayStore.syncRoom(roomPayload);
    await squadPayStore.reconcileRoomCheckouts(synced.id).catch(() => null);
    return NextResponse.json({ status: 'success', data: squadPayStore.getRoom(synced.id) });
  } catch (err: any) {
    return NextResponse.json({ status: 'error', message: err.message }, { status: 400 });
  }
}
