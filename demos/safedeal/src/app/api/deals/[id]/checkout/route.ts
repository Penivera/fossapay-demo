import { NextRequest, NextResponse } from 'next/server';
import { safeDealStore } from '../../../../../lib/dealStore';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { name, phone, email } = body;

    if (!name || !phone) {
      return NextResponse.json(
        { status: 'error', message: 'Buyer name and phone are required' },
        { status: 400 }
      );
    }

    const updated = await safeDealStore.initiateCheckout(id, { name, phone, email });
    return NextResponse.json({ status: 'success', data: updated });
  } catch (err: any) {
    return NextResponse.json({ status: 'error', message: err.message }, { status: 400 });
  }
}
