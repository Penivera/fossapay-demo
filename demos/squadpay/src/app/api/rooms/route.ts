import { NextRequest, NextResponse } from 'next/server';
import { squadPayStore } from '../../../lib/roomStore';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, totalAmount, splitMode, host, participantInputs } = body;

    if (!title || !totalAmount || !host?.accountNumber || !host?.bankCode || !participantInputs?.length) {
      return NextResponse.json(
        { status: 'error', message: 'Missing required room parameters' },
        { status: 400 }
      );
    }

    const room = await squadPayStore.createRoom({
      title,
      totalAmount: String(totalAmount),
      splitMode: splitMode || 'equal',
      host: {
        name: host.name || host.accountName,
        phone: host.phone || '08012345678',
        bankName: host.bankName || 'Commercial Bank',
        bankCode: host.bankCode,
        accountNumber: host.accountNumber,
        accountName: host.accountName,
      },
      participantInputs,
    });

    return NextResponse.json({ status: 'success', data: room });
  } catch (err: any) {
    return NextResponse.json({ status: 'error', message: err.message }, { status: 400 });
  }
}
