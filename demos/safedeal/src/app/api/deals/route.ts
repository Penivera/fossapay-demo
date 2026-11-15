import { NextRequest, NextResponse } from 'next/server';
import { safeDealStore } from '../../../lib/dealStore';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, description, price, inspectionPeriodSeconds, seller } = body;

    if (!title || !price || !seller?.accountNumber || !seller?.bankCode || !seller?.accountName) {
      return NextResponse.json(
        { status: 'error', message: 'Missing required deal parameters' },
        { status: 400 }
      );
    }

    const deal = await safeDealStore.createDeal({
      title,
      description: description || '',
      price: String(price),
      inspectionPeriodSeconds: inspectionPeriodSeconds ? Number(inspectionPeriodSeconds) : 86400,
      seller: {
        name: seller.name || seller.accountName,
        phone: seller.phone || '08012345678',
        email: seller.email || 'seller@example.com',
        bankName: seller.bankName || 'Commercial Bank',
        bankCode: seller.bankCode,
        accountNumber: seller.accountNumber,
        accountName: seller.accountName,
      },
    });

    return NextResponse.json({ status: 'success', data: deal });
  } catch (err: any) {
    return NextResponse.json({ status: 'error', message: err.message }, { status: 500 });
  }
}
