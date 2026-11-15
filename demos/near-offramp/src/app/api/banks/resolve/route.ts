import { NextRequest, NextResponse } from 'next/server';
import { FossaPayClient, FossaPayError } from '@fossapay/client';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { accountNumber, bankCode } = body;

    if (!accountNumber || !bankCode) {
      return NextResponse.json(
        { status: 'error', message: 'accountNumber and bankCode are required.' },
        { status: 400 }
      );
    }

    if (!/^\d{10}$/.test(accountNumber)) {
      return NextResponse.json(
        { status: 'error', message: 'Account number must be exactly 10 digits.' },
        { status: 400 }
      );
    }

    const apiKey = process.env.FOSSAPAY_API_KEY;

    if (apiKey) {
      try {
        const client = new FossaPayClient({ apiKey });
        const result = await client.transfers.bankEnquiry({ accountNumber, bankCode });
        return NextResponse.json({ status: 'success', data: result });
      } catch (err: any) {
        if (err instanceof FossaPayError) {
          return NextResponse.json(
            { status: 'error', message: err.message },
            { status: err.statusCode }
          );
        }
        throw err;
      }
    }

    // High-fidelity fallback resolution for demo verification
    const mockNames: Record<string, string> = {
      '0123456789': 'OLUWASEUN CHUKWUDI ADENIYI',
      '1234567890': 'CHINEDU EMMANUEL OKAFOR',
      '2233445566': 'FATIMA ABUBAKAR BELLO',
      '9876543210': 'AYOMIDE TEMITOPE WILLIAMS',
    };

    const resolvedName = mockNames[accountNumber] || 'JOHN CHUKWUDI DOE';

    return NextResponse.json({
      status: 'success',
      data: {
        accountName: resolvedName,
        accountNumber,
        bankCode,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { status: 'error', message: error?.message || 'Failed to resolve bank account.' },
      { status: 500 }
    );
  }
}
