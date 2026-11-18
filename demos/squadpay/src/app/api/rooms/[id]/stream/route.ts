import { NextRequest } from 'next/server';
import { squadPayStore } from '../../../../../lib/roomStore';

export const dynamic = 'force-dynamic';
// SSE: keep the Vercel function open as long as the plan allows (Hobby+Fluid max 300s). EventSource auto-reconnects.
export const maxDuration = 300;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: roomId } = await params;
  const room = squadPayStore.getRoom(roomId);

  if (!room) {
    return new Response(JSON.stringify({ status: 'error', message: 'Room not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Immediate push
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(room)}\n\n`));

      const unsubscribe = squadPayStore.subscribe(roomId, (updated) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(updated)}\n\n`));
        } catch {
          // Client disconnected
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
