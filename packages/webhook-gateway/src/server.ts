import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { verifyFossaPayWebhookRequest, signFossaPayWebhook, FossaPayWebhookEvent } from '@fossapay/client';
import {
  type RecordedWebhookEvent,
  recordEvent,
  updateEvent,
  getEvents,
  checkAndMarkDuplicate,
  getPersistenceStatus,
  closeStore,
} from './store';

export type { RecordedWebhookEvent };

// Load root .env if present
const rootEnvPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(rootEnvPath)) {
  const envContent = fs.readFileSync(rootEnvPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

const PORT = Number(process.env.PORT || 8001);
// Never hardcode a fallback: a default secret in source is a forgeable-webhook backdoor.
// Resolved per call so the environment is the single source of truth. Empty => every delivery is rejected.
function getWebhookSecret(): string {
  const s = process.env.FOSSAPAY_WEBHOOK_SECRET || process.env.FOSSAPAY_SECRET || '';
  return s.trim();
}

function getPublicWebhookUrl(): string {
  if (process.env.PUBLIC_WEBHOOK_URL) return process.env.PUBLIC_WEBHOOK_URL;
  if (process.env.PUBLIC_URL) return `${process.env.PUBLIC_URL.replace(/\/+$/, '')}/platforms/webhook`;
  if (process.env.NODE_ENV === 'test') return 'https://fossapay-demo.reachapp.xyz/platforms/webhook';
  return 'https://fossapay-demo-api.peni.dev/platforms/webhook';
}

const escapeHtml = (v: unknown): string =>
  String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/**
 * The Cloudflare tunnel exposes this whole port, and cloudflared connects from loopback, so the socket address
 * alone cannot tell a local browser from a stranger on the internet. Proxied requests carry forwarding headers.
 * Everything except POST /platforms/webhook (which is HMAC-authenticated) is restricted to genuinely local requests.
 */
function isLocalRequest(req: http.IncomingMessage): boolean {
  const addr = req.socket.remoteAddress || '';
  const loopback = addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1';
  const proxied = Boolean(req.headers['cf-connecting-ip'] || req.headers['cf-ray'] || req.headers['x-forwarded-for'] || req.headers['x-real-ip']);
  return loopback && !proxied;
}


// Forwarding target demo apps
const DEMO_TARGETS = [
  { name: 'near-offramp', port: 3000, path: '/api/webhook', defaultUrl: 'https://fossapay-demo.peni.dev/near-offramp/api/webhook' },
  { name: 'safedeal', port: 3001, path: '/api/webhook', defaultUrl: 'https://fossapay-demo.peni.dev/safedeal/api/webhook' },
  { name: 'squadpay', port: 3002, path: '/api/webhook', defaultUrl: 'https://fossapay-demo.peni.dev/squadpay/api/webhook' },
  { name: 'ajosphere', port: 3003, path: '/api/webhook', defaultUrl: 'https://fossapay-demo.peni.dev/ajosphere/api/webhook' },
];

function getTargetUrl(target: (typeof DEMO_TARGETS)[number]): string {
  const envKey = `${target.name.toUpperCase().replace(/-/g, '_')}_URL`;
  const custom = process.env[envKey] || process.env[`${target.name.toUpperCase().replace(/-/g, '_')}_WEBHOOK_URL`];
  if (custom) {
    return custom.endsWith('/api/webhook') ? custom : `${custom.replace(/\/+$/, '')}/api/webhook`;
  }
  if (process.env.NODE_ENV === 'test') {
    return `http://localhost:${target.port}${target.path}`;
  }
  return target.defaultUrl;
}

async function forwardWebhook(
  rawBody: string,
  signatures: { legacy?: string | null; v2?: string | null },
  event: FossaPayWebhookEvent
): Promise<string[]> {
  const dispatched: string[] = [];
  const secret = getWebhookSecret();

  for (const target of DEMO_TARGETS) {
    const targetUrl = getTargetUrl(target);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      // Forward the body byte-for-byte plus whichever signature headers FossaPay sent
      if (signatures.legacy) headers['x-fossapay-signature'] = signatures.legacy;
      if (signatures.v2) headers['x-fossapay-signature-v2'] = signatures.v2;

      // Re-sign with gateway secret if available so forwarded events carry guaranteed matching signatures
      if (secret) {
        headers['x-fossapay-signature-v2'] = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
        if (event && (event as any).data) {
          headers['x-fossapay-signature'] = crypto.createHmac('sha256', secret).update(JSON.stringify((event as any).data)).digest('hex');
        }
        headers['x-gateway-secret'] = secret;
      }

      const res = await fetch(targetUrl, {
        method: 'POST',
        headers,
        body: rawBody,
      });

      if (res.ok) {
        dispatched.push(`${target.name} (${res.status})`);
      } else {
        dispatched.push(`${target.name} (failed: ${res.status})`);
      }
    } catch {
      // Demo may not be running locally on that port right now
    }
  }

  return dispatched;
}

export function createWebhookServer() {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    // CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-fossapay-signature, x-fossapay-signature-v2, x-api-key, X-Idempotency-Key');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Only the HMAC-authenticated webhook endpoint may be reached through the public tunnel
    const isPublicWebhookRoute = url.pathname === '/platforms/webhook' && (req.method === 'POST' || req.method === 'GET');
    if (!isPublicWebhookRoute && !isLocalRequest(req)) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'error', message: 'Not Found' }));
      return;
    }

    // 1. Health & Status Check for Webhook Endpoint
    if (req.method === 'GET' && url.pathname === '/platforms/webhook') {
      const events = await getEvents();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          status: 'active',
          service: 'FossaPay Webhook Ingestion Gateway',
          publicEndpoint: getPublicWebhookUrl(),
          localPort: PORT,
          secretConfigured: !!getWebhookSecret(),
          eventsReceived: events.length,
          persistence: getPersistenceStatus(),
          timestamp: new Date().toISOString(),
        })
      );
      return;
    }

    // 2. Main FossaPay Webhook Ingestion Handler
    if (req.method === 'POST' && url.pathname === '/platforms/webhook') {
      let rawBody = '';
      req.on('data', (chunk) => {
        rawBody += chunk;
      });

      req.on('end', async () => {
        const signature = (req.headers['x-fossapay-signature'] as string | undefined) || null;
        const signatureV2 = (req.headers['x-fossapay-signature-v2'] as string | undefined) || null;

        console.log(`[Gateway] Inbound Webhook Received at ${new Date().toISOString()}`);
        console.log(`[Gateway] signature headers: legacy=${signature ? 'present' : 'missing'} v2=${signatureV2 ? 'present' : 'missing'}`);

        const secret = getWebhookSecret();
        let isValid = false;
        let scheme: string | null = null;
        if (secret) {
          try {
            const result = verifyFossaPayWebhookRequest(rawBody, req.headers, secret);
            isValid = result.valid;
            scheme = result.scheme;
          } catch (err) {
            console.error('[Gateway] Signature verification error:', err);
          }
        } else {
          console.error('[Gateway] No FOSSAPAY_WEBHOOK_SECRET configured: rejecting all deliveries');
        }

        console.log(`[Gateway] HMAC-SHA256 Signature Valid: ${isValid ? `YES (${scheme})` : 'NO (Failed)'}`);

        let payload: any = null;
        try {
          payload = JSON.parse(rawBody);
        } catch {
          console.error('[Gateway] Failed to parse JSON body');
        }

        if (!isValid) {
          // Docs: reject invalid or missing signatures. Keep the attempt visible in the inspector but never forward it.
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              status: 'error',
              received: true,
              eventId: payload?.eventId,
              signatureVerified: false,
              message: 'Invalid or missing webhook signature',
            })
          );
          if (payload) {
            await recordEvent({
              id: payload.eventId || `evt_${Date.now()}`,
              receivedAt: new Date().toISOString(),
              signature,
              isValidSignature: false,
              event: payload,
              routedTo: [],
            });
          }
          return;
        }

        const isDuplicate = await checkAndMarkDuplicate(payload?.eventId);
        if (isDuplicate) {
          console.log(`[Gateway] Duplicate event ${payload?.eventId} acknowledged without re-dispatching`);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              status: 'success',
              received: true,
              eventId: payload?.eventId,
              signatureVerified: true,
              duplicate: true,
            })
          );
          return;
        }

        // Return 2xx fast to FossaPay, then fan out asynchronously
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            status: 'success',
            received: true,
            eventId: payload?.eventId,
            signatureVerified: true,
          })
        );

        if (payload) {
          // Record immediately so the inspector never waits on slow or offline demo apps
          const recorded: RecordedWebhookEvent = {
            id: payload.eventId || `evt_${Date.now()}`,
            receivedAt: new Date().toISOString(),
            signature: signature || signatureV2,
            isValidSignature: true,
            event: payload,
            routedTo: [],
          };
          await recordEvent(recorded);

          recorded.routedTo = await forwardWebhook(rawBody, { legacy: signature, v2: signatureV2 }, payload);
          await updateEvent(recorded);
          console.log(`[Gateway] Event ${payload.eventType || 'unknown'} routed to: ${recorded.routedTo.join(', ') || 'none online'}`);
        }
      });
      return;
    }

    // 3. API Events endpoint (for polling & dashboard)
    if (req.method === 'GET' && url.pathname === '/api/events') {
      const events = await getEvents();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'success', data: events }));
      return;
    }

    // 4. Test Trigger Simulator Endpoint
    if (req.method === 'POST' && url.pathname === '/api/test-trigger') {
      // Signs events with the real secret and fans them out to the demos: never allow it against live money
      if (process.env.FOSSAPAY_MODE === 'live') {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'error', message: 'Test events are disabled in live mode' }));
        return;
      }
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', async () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          const eventType = parsed.eventType || 'checkout.completed';
          const sampleData = parsed.data || {
            checkoutId: `chk_live_test_${Date.now()}`,
            reference: `ref_live_${Date.now()}`,
            amount: '5000.00',
            status: 'completed',
            paidAt: new Date().toISOString(),
          };

          const event: FossaPayWebhookEvent = {
            eventId: `evt_${Date.now()}`,
            eventType,
            timestamp: new Date().toISOString(),
            data: sampleData,
          };

          const rawBody = JSON.stringify(event);
          const secret = getWebhookSecret();
          if (!secret) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'error', message: 'FOSSAPAY_WEBHOOK_SECRET is not configured' }));
            return;
          }
          const signature = signFossaPayWebhook(event.data, secret);

          // Forward through ingestion
          const routedTo = await forwardWebhook(rawBody, { legacy: signature }, event);

          await recordEvent({
            id: event.eventId,
            receivedAt: new Date().toISOString(),
            signature,
            isValidSignature: true,
            event,
            routedTo,
          });

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'success', event, signature, routedTo }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'error', message: String(err) }));
        }
      });
      return;
    }

    // 5. Webhook Inspector & Platform Hub Dashboard
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/dashboard')) {
      const events = await getEvents();
      const persistence = getPersistenceStatus();
      const live = process.env.FOSSAPAY_MODE === 'live';
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FossaPay Webhook Inspector</title>
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 38 40' fill='none'%3E%3Cpath d='M34.6725 7.6099L32.0762 18.2279C31.6788 19.8529 30.0407 21.1694 28.4157 21.1694H23.2256L24.2728 16.8814C24.6924 15.161 23.6374 13.7648 21.917 13.7648H11.0793C9.35761 13.7648 7.62149 15.161 7.20184 16.8814L6.87109 18.2279L9.46873 7.6099C9.86354 5.98491 11.5042 4.67105 13.1266 4.67105H32.4514C34.0738 4.67105 35.0699 5.98491 34.6725 7.6099Z' fill='%231A4BDB'/%3E%3Cpath d='M24.2746 16.8814L23.2274 21.1694H9.09269C7.4873 21.1694 6.49766 19.8817 6.85979 18.2815L6.87286 18.2279L7.20361 16.8814C7.62326 15.161 9.35938 13.7647 11.0811 13.7647H21.9188C23.6392 13.7647 24.6942 15.161 24.2746 16.8814Z' fill='%23366CF2'/%3E%3Cpath d='M23.2274 21.1694L22.4325 24.4168C22.0103 26.1385 20.2742 27.5334 18.5524 27.5334H7.71346C5.99303 27.5334 4.93802 26.1372 5.35767 24.4168L6.85978 18.2815C6.49634 19.8817 7.48729 21.1694 9.09268 21.1694H23.2274Z' fill='%234E7FF9'/%3E%3Cpath d='M13.7367 32.3509C13.5354 33.1732 13.0203 33.9184 12.3484 34.457C11.6777 34.9969 10.8515 35.3303 10.0292 35.3303H5.6706C4.02468 35.3303 3.01805 33.9968 3.4207 32.3509C3.62203 31.5286 4.13711 30.7834 4.80907 30.2448C5.47973 29.7049 6.30595 29.3715 7.12825 29.3715H11.4869C13.1328 29.3715 14.1394 30.705 13.7367 32.3509Z' fill='%237EA8FC'/%3E%3C/svg%3E">
  <style>
    :root { --canvas:#fafaf9; --surface:#fff; --subtle:#f5f5f4; --line:#e7e5e4; --ink:#1c1917; --ink2:#44403c; --muted:#69635e; --brand:#b94f07; --ok:#166534; --okbg:#ecfdf3; --bad:#991b1b; --badbg:#fef2f2; }
    * { box-sizing: border-box; }
    body { margin:0; min-height:100dvh; background:var(--canvas); color:var(--ink); font:15px/1.55 ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif; -webkit-font-smoothing:antialiased;
      background-image:radial-gradient(1200px 520px at 50% -10%, rgba(246,130,31,.10), transparent 70%); background-repeat:no-repeat; }
    main { max-width:1100px; margin:0 auto; padding:40px 24px 64px; }
    header { display:flex; flex-wrap:wrap; gap:16px; align-items:flex-end; justify-content:space-between; margin-bottom:28px; }
    h1 { margin:8px 0 2px; font-size:clamp(1.6rem,1.2rem + 1vw,2.1rem); letter-spacing:-.02em; line-height:1.15; }
    h2 { margin:0; font-size:16px; }
    .sub { color:var(--ink2); margin:0; }
    .pill { display:inline-flex; align-items:center; gap:6px; padding:2px 10px; border-radius:999px; font-size:12px; font-weight:500; background:var(--okbg); color:var(--ok); box-shadow:inset 0 0 0 1px rgba(21,128,61,.2); }
    .pill.warn { background:#fff4e8; color:#7c2d03; box-shadow:inset 0 0 0 1px rgba(246,130,31,.3); }
    .pill.bad { background:var(--badbg); color:var(--bad); box-shadow:inset 0 0 0 1px rgba(185,28,28,.2); }
    .dot { width:6px; height:6px; border-radius:99px; background:currentColor; }
    button { font:inherit; font-weight:500; height:40px; padding:0 16px; border-radius:12px; border:1px solid #d6d3d1; background:var(--surface); color:var(--ink); cursor:pointer; }
    button:hover { background:var(--subtle); }
    button.primary { background:var(--brand); border-color:var(--brand); color:#fff; }
    button.primary:hover { background:#9a3f04; }
    button:disabled { opacity:.5; cursor:not-allowed; }
    .grid { display:grid; gap:14px; }
    .cols3 { grid-template-columns:repeat(auto-fit,minmax(240px,1fr)); }
    .card { background:var(--surface); border:1px solid var(--line); border-radius:16px; padding:18px 20px; box-shadow:0 1px 2px rgba(28,25,23,.04),0 8px 24px -12px rgba(28,25,23,.10); }
    .label { color:var(--muted); font-size:13px; }
    .value { font-weight:600; word-break:break-all; margin-top:2px; }
    .big { font-size:28px; letter-spacing:-.02em; font-variant-numeric:tabular-nums; }
    .mono { font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; font-size:13px; }
    section { margin-top:28px; }
    .row { display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap; margin-bottom:10px; }
    .links { display:grid; gap:10px; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); }
    .links a { display:block; padding:12px 14px; border:1px solid var(--line); border-radius:12px; background:var(--surface); color:var(--ink); text-decoration:none; }
    .links a:hover { border-color:#f6821f; }
    .links small { color:var(--muted); }
    .event { margin-bottom:10px; }
    .event.invalid { border-color:#fca5a5; }
    pre { margin:10px 0 0; padding:12px; background:var(--subtle); border-radius:10px; overflow:auto; font-size:12.5px; max-height:260px; }
    .empty { text-align:center; color:var(--ink2); border-style:dashed; padding:36px 20px; }
  </style>
</head>
<body>
<main>
  <header>
    <div>
      <span class="pill ${live ? '' : 'warn'}"><span class="dot"></span>${live ? 'Live' : 'Sandbox'} · port ${PORT}</span>
      <h1>Webhook inspector</h1>
      <p class="sub">Verifies FossaPay deliveries and routes them to the demo apps.</p>
    </div>
    <div style="display:flex;gap:8px">
      <button class="primary" ${live ? 'disabled title="Disabled in live mode"' : ''} onclick="triggerTestWebhook()">Send test webhook</button>
      <button onclick="location.reload()">Refresh</button>
    </div>
  </header>

  <div class="grid cols3">
    <div class="card"><div class="label">Public webhook URL</div><div class="value mono">${getPublicWebhookUrl()}</div><div class="label">HMAC-SHA256 endpoint</div></div>
    <div class="card"><div class="label">Webhook secret</div><div class="value">${getWebhookSecret() ? 'Configured' : '<span style="color:var(--bad)">Not configured: all deliveries rejected</span>'}</div><div class="label">HMAC-SHA256, v2 or legacy header</div></div>
    <div class="card"><div class="label">Events ingested (${persistence === 'redis' ? 'Redis' : 'Memory'})</div><div class="value big" id="eventCount">${events.length}</div><div class="label">${persistence === 'redis' ? 'Persistent Redis list' : 'In-memory (ephemeral)'}</div></div>
  </div>

  <section>
    <div class="row"><h2>Demo apps</h2></div>
    <div class="links">
      <a href="${process.env.NEAR_OFFRAMP_APP_URL || 'https://fossapay-demo.peni.dev/near-offramp'}" target="_blank">NairaBridge<br><small>Hosted at /near-offramp ↗</small></a>
      <a href="${process.env.SAFEDEAL_APP_URL || 'https://fossapay-demo.peni.dev/safedeal'}" target="_blank">SafeDeal<br><small>Hosted at /safedeal ↗</small></a>
      <a href="${process.env.SQUADPAY_APP_URL || 'https://fossapay-demo.peni.dev/squadpay'}" target="_blank">SquadPay<br><small>Hosted at /squadpay ↗</small></a>
      <a href="${process.env.AJOSPHERE_APP_URL || 'https://fossapay-demo.peni.dev/ajosphere'}" target="_blank">AjoSphere<br><small>Hosted at /ajosphere ↗</small></a>
    </div>
  </section>

  <section>
    <div class="row"><h2>Inbound deliveries</h2><span class="label">Count updates automatically</span></div>
    ${
      events.length === 0
        ? `<div class="card empty">No webhook events received yet. Deliveries from FossaPay appear here.</div>`
        : events
            .map(
              (ev) => `
    <div class="card event ${ev.isValidSignature ? '' : 'invalid'}">
      <div class="row" style="margin:0">
        <div><strong>${escapeHtml(ev.event?.eventType || 'unknown')}</strong>
          <span class="pill ${ev.isValidSignature ? '' : 'bad'}" style="margin-left:8px">${ev.isValidSignature ? 'Valid signature' : 'Rejected: bad signature'}</span></div>
        <span class="label">${escapeHtml(new Date(ev.receivedAt).toLocaleTimeString())}</span>
      </div>
      <div class="label mono" style="margin-top:6px">${escapeHtml(ev.id)}</div>
      <pre>${escapeHtml(JSON.stringify(ev.event?.data, null, 2))}</pre>
      <div class="label" style="margin-top:8px">Forwarded to: ${escapeHtml(ev.routedTo.join(', ') || 'none')}</div>
    </div>`
            )
            .join('')
    }
  </section>
</main>
<script>
  async function triggerTestWebhook() {
    const res = await fetch('/api/test-trigger', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventType: 'checkout.completed', data: { checkoutId: 'chk_test_' + Date.now(), reference: 'squad_test_001', amount: '15000.00', status: 'completed', paidAt: new Date().toISOString() } }) });
    if (res.ok) location.reload();
  }
  setInterval(async () => {
    try { const d = await (await fetch('/api/events')).json(); if (d.status === 'success') document.getElementById('eventCount').innerText = d.data.length; } catch {}
  }, 3000);
</script>
</body>
</html>`;

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'error', message: 'Not Found' }));
  });

  server.on('close', async () => {
    await closeStore();
  });

  return server;
}

if (process.env.NODE_ENV !== 'test') {
  const server = createWebhookServer();
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`=======================================================`);
    console.log(`🚀 FossaPay Webhook Gateway listening on port ${PORT}`);
    console.log(`🌐 Public Tunnel URL: ${getPublicWebhookUrl()}`);
    console.log(`🔒 HMAC Secret: ${getWebhookSecret() ? 'configured' : 'NOT CONFIGURED: all deliveries will be rejected'}`);
    console.log(`💾 Storage Persistence: ${getPersistenceStatus().toUpperCase()}`);
    console.log(`📊 Local Webhook Inspector: http://localhost:${PORT}`);
    console.log(`=======================================================`);
  });
}
