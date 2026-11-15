import { NextRequest } from 'next/server';
import { ajoStore } from '@/lib/clubStore';

export const dynamic = 'force-dynamic';

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

  const stream = new ReadableStream({
    start(controller) {
      // Send initial snapshot
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(club)}\n\n`));

      const unsubscribe = ajoStore.subscribe(id, (updatedClub) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(updatedClub)}\n\n`));
        } catch {
          unsubscribe();
        }
      });

      // Keepalive heartbeat every 15s
      const interval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': keepalive\n\n'));
        } catch {
          clearInterval(interval);
          unsubscribe();
        }
      }, 15000);

      _req.signal.addEventListener('abort', () => {
        clearInterval(interval);
        unsubscribe();
      });
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
