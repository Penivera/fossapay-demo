import { NextRequest, NextResponse } from 'next/server';
import { ajoStore } from '@/lib/clubStore';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await params;
    const body = await req.json();
    const { pendingId, simulate } = body;

    if (!pendingId) {
      return NextResponse.json(
        { status: 'error', message: 'pendingId is required' },
        { status: 400 }
      );
    }

    const { member, club } = await ajoStore.confirmKycPayment(pendingId, Boolean(simulate));

    return NextResponse.json({
      status: 'success',
      data: {
        member,
        club,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to confirm verification payment';
    return NextResponse.json({ status: 'error', message }, { status: 400 });
  }
}
