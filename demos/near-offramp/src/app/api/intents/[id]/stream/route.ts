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

  const stream = new ReadableStream({
    start(controller) {
      // Send initial data immediately
      const initialPayload = `data: ${JSON.stringify(session)}\n\n`;
      controller.enqueue(encoder.encode(initialPayload));

      // Subscribe to updates
      const unsubscribe = intentStore.subscribe(intentId, (updated) => {
        try {
          const payload = `data: ${JSON.stringify(updated)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        } catch {
          // Client disconnected
        }
      });

      // Keep connection alive with heartbeat
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch {
          clearInterval(heartbeat);
          unsubscribe();
        }
      }, 15000);

      // Clean up when client disconnects
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
