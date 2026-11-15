import { NextRequest, NextResponse } from 'next/server';
import { safeDealStore } from '../../../../../lib/dealStore';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { accountNumber, bankCode, accountName, resolutionNote } = body;

    if (!accountNumber || !bankCode || !accountName) {
      return NextResponse.json(
        { status: 'error', message: 'Buyer refund bank details are required' },
        { status: 400 }
      );
    }

    const updated = await safeDealStore.refundBuyer(id, {
      accountNumber,
      bankCode,
      accountName,
      resolutionNote,
    });

    return NextResponse.json({ status: 'success', data: updated });
  } catch (err: any) {
    return NextResponse.json({ status: 'error', message: err.message }, { status: 400 });
  }
}
