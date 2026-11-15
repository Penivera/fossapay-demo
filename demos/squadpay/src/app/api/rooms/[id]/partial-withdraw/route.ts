import { NextRequest, NextResponse } from 'next/server';
import { squadPayStore } from '../../../../../lib/roomStore';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const updated = await squadPayStore.partialCloseAndWithdraw(id);
    return NextResponse.json({ status: 'success', data: updated });
  } catch (err: any) {
    return NextResponse.json({ status: 'error', message: err.message }, { status: 400 });
  }
}
