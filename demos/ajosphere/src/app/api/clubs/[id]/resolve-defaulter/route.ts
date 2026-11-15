import { NextRequest, NextResponse } from 'next/server';
import { ajoStore } from '@/lib/clubStore';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { action } = body;

    if (action !== 'wait' && action !== 'disburse-partial') {
      return NextResponse.json(
        { status: 'error', message: 'Action must be either "wait" or "disburse-partial"' },
        { status: 400 }
      );
    }

    const updated = await ajoStore.resolveDefaulter(id, action);

    return NextResponse.json({
      status: 'success',
      data: updated,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to resolve defaulter state';
    return NextResponse.json({ status: 'error', message }, { status: 400 });
  }
}
