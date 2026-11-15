import { NextRequest, NextResponse } from 'next/server';
import { ajoStore } from '@/lib/clubStore';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const updated = ajoStore.advanceRound(id);

    return NextResponse.json({
      status: 'success',
      data: updated,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to advance round';
    return NextResponse.json({ status: 'error', message }, { status: 500 });
  }
}
