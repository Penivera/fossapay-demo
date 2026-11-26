import { NextRequest } from 'next/server';
import { ajoStore } from '@/lib/clubStore';

export const dynamic = 'force-dynamic';
// SSE: keep the Vercel function open as long as the plan allows (Hobby+Fluid max 300s). EventSource auto-reconnects.
export const maxDuration = 300;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const club = ajoStore.getClub(id);

  if (!club) {
    return new Response('Club not found', { status: 404 });
  }

  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;

      // Send initial snapshot
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(club)}\n\n`));

      const unsubscribe = ajoStore.subscribe(id, (updatedClub) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(updatedClub)}\n\n`));
        } catch {
          cleanup();
        }
      });

      // Keepalive heartbeat every 15s
      const interval = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(': keepalive\n\n'));
        } catch {
          cleanup();
        }
      }, 15000);

      cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(interval);
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
