import { NextRequest, NextResponse } from 'next/server';
import { denyInLive } from '@fossapay/client';
import { ajoStore, SimulatedDay } from '@/lib/clubStore';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = denyInLive();
  if (denied) return denied;
  try {
    const { id } = await params;
    const body = await req.json();
    const { targetDay } = body;

    const validDays: SimulatedDay[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
    if (!validDays.includes(targetDay)) {
      return NextResponse.json(
        { status: 'error', message: `Invalid targetDay. Must be one of: ${validDays.join(', ')}` },
        { status: 400 }
      );
    }

    const updated = await ajoStore.advanceTime(id, targetDay);

    return NextResponse.json({
      status: 'success',
      data: updated,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to advance time';
    return NextResponse.json({ status: 'error', message }, { status: 500 });
  }
}
