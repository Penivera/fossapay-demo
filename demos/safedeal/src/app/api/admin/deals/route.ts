import { NextResponse } from 'next/server';
import { safeDealStore } from '../../../../lib/dealStore';

export async function GET() {
  const deals = safeDealStore.listDeals();
  const disputed = safeDealStore.listDisputedDeals();

  return NextResponse.json({
    status: 'success',
    data: {
      total: deals.length,
      disputedCount: disputed.length,
      deals,
      disputed,
    },
  });
}
