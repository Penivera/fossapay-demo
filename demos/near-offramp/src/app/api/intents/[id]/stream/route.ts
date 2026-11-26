import { NextRequest } from 'next/server';
import { intentStore } from '../../../../../lib/intentStore';

export const dynamic = 'force-dynamic';
// SSE: keep the Vercel function open as long as the plan allows (Hobby+Fluid max 300s). EventSource auto-reconnects.
export const maxDuration = 300;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: intentId } = await params;
  const session = intentStore.getSession(intentId);

  if (!session) {
    return new Response(JSON.stringify({ status: 'error', message: 'Session not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream({
    start(controller) {
      // Send initial data immediately
      const initialPayload = `data: ${JSON.stringify(session)}\n\n`;
      controller.enqueue(encoder.encode(initialPayload));

      let closed = false;
      const unsubscribe = intentStore.subscribe(intentId, (updated) => {
        if (closed) return;
        try {
          const payload = `data: ${JSON.stringify(updated)}\n\n`;
          controller.enqueue(encoder.encode(payload));
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
