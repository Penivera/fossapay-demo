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

  const encoder = new TextEncoder();

  if (!room) {
    return new Response(encoder.encode('event: unavailable\ndata: {}\n\n'), {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
      },
    });
  }

  let cleanup = () => {};

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;

      // Immediate push
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(room)}\n\n`));

      const unsubscribe = squadPayStore.subscribe(roomId, (updated) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(updated)}\n\n`));
        } catch {
          cleanup();
        }
      });

      const heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch {
          cleanup();
        }
      }, 15000);

      cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
      };

      _req.signal.addEventListener('abort', cleanup);
    },
    cancel() {
      cleanup();
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
