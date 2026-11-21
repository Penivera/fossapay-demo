import { NextRequest, NextResponse } from 'next/server';
import { squadPayStore } from '../../../../lib/roomStore';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body || !body.id) {
      return NextResponse.json({ status: 'error', message: 'Missing room data' }, { status: 400 });
    }
    const synced = squadPayStore.syncRoom(body);
    await squadPayStore.reconcileRoomCheckouts(synced.id).catch(() => null);
    return NextResponse.json({ status: 'success', data: squadPayStore.getRoom(synced.id) });
  } catch (err: any) {
    return NextResponse.json({ status: 'error', message: err.message }, { status: 400 });
  }
}
