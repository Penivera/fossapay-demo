import { NextRequest, NextResponse } from 'next/server';
import { safeDealStore } from '../../../../lib/dealStore';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const deal = safeDealStore.getDeal(id);

  if (!deal) {
    return NextResponse.json({ status: 'error', message: `Deal ${id} not found` }, { status: 404 });
  }

  return NextResponse.json({ status: 'success', data: deal });
}
