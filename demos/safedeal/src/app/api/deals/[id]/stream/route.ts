import { NextRequest } from 'next/server';
import { safeDealStore } from '../../../../../lib/dealStore';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: dealId } = await params;
  const deal = safeDealStore.getDeal(dealId);

  if (!deal) {
    return new Response(JSON.stringify({ status: 'error', message: 'Deal not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Immediate state push
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(deal)}\n\n`));

      const unsubscribe = safeDealStore.subscribe(dealId, (updated) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(updated)}\n\n`));
        } catch {
          // Client closed
        }
      });

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch {
          clearInterval(heartbeat);
          unsubscribe();
        }
      }, 15000);

      return () => {
        clearInterval(heartbeat);
        unsubscribe();
      };
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
