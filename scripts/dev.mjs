import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const rootDir = process.cwd();
const siteDir = path.join(rootDir, 'site');
const sitePort = Number(process.env.SITE_PORT || 8080);
const gatewayPort = Number(process.env.PORT || 8001);
const isLive = process.argv.includes('--live') || process.env.FOSSAPAY_MODE === 'live';
const mode = isLive ? 'live' : 'mock';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const PROXY_ROUTES = [
  { prefix: '/near-offramp', port: 3000, rewritePrefix: '' },
  { prefix: '/api/intents', port: 3000, rewritePrefix: '/near-offramp' },
  { prefix: '/api/quote', port: 3000, rewritePrefix: '/near-offramp' },
  { prefix: '/safedeal', port: 3001, rewritePrefix: '' },
  { prefix: '/d/', port: 3001, rewritePrefix: '/safedeal' },
  { prefix: '/admin', port: 3001, rewritePrefix: '/safedeal' },
  { prefix: '/api/deals', port: 3001, rewritePrefix: '/safedeal' },
  { prefix: '/api/admin', port: 3001, rewritePrefix: '/safedeal' },
  { prefix: '/api/banks', port: 3001, rewritePrefix: '/safedeal' },
  { prefix: '/squadpay', port: 3002, rewritePrefix: '' },
  { prefix: '/r/', port: 3002, rewritePrefix: '/squadpay' },
  { prefix: '/api/rooms', port: 3002, rewritePrefix: '/squadpay' },
  { prefix: '/ajosphere', port: 3003, rewritePrefix: '' },
  { prefix: '/club/', port: 3003, rewritePrefix: '/ajosphere' },
  { prefix: '/api/clubs', port: 3003, rewritePrefix: '/ajosphere' },
];

function resolveProxyTarget(urlPath) {
  const pathname = urlPath.split('?')[0];
  for (const route of PROXY_ROUTES) {
    if (
      pathname === route.prefix ||
      pathname.startsWith(route.prefix.endsWith('/') ? route.prefix : `${route.prefix}/`)
    ) {
      return { port: route.port, targetPath: `${route.rewritePrefix}${urlPath}` };
    }
  }
  return null;
}

function createSiteAndProxyServer() {
  const server = http.createServer((req, res) => {
    const rawUrl = req.url || '/';
    const target = resolveProxyTarget(rawUrl);

    if (target) {
      const proxyReq = http.request(
        {
          hostname: '127.0.0.1',
          port: target.port,
          path: target.targetPath,
          method: req.method,
          headers: { ...req.headers, host: `127.0.0.1:${target.port}` },
        },
        (proxyRes) => {
          res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
          proxyRes.pipe(res);
        }
      );
      proxyReq.on('error', () => {
        if (!res.headersSent) {
          res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
        }
        res.end(`App on port ${target.port} is still starting up...`);
      });
      req.pipe(proxyReq);
      return;
    }

    const pathname = rawUrl.split('?')[0];
    const relPath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const resolved = path.resolve(siteDir, relPath);
    if (resolved !== siteDir && !resolved.startsWith(`${siteDir}${path.sep}`)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    if (!fs.existsSync(resolved) || fs.statSync(resolved).isDirectory()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
      return;
    }

    const ext = path.extname(resolved).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    fs.createReadStream(resolved).pipe(res);
  });

  server.on('upgrade', (req, socket, head) => {
    const target = resolveProxyTarget(req.url || '/');
    if (!target) {
      socket.destroy();
      return;
    }
    const upstream = net.connect(target.port, '127.0.0.1', () => {
      const headerLines = [`${req.method} ${target.targetPath} HTTP/${req.httpVersion}`];
      for (let i = 0; i < req.rawHeaders.length; i += 2) {
        const name = req.rawHeaders[i];
        const value = name.toLowerCase() === 'host' ? `127.0.0.1:${target.port}` : req.rawHeaders[i + 1];
        headerLines.push(`${name}: ${value}`);
      }
      upstream.write(`${headerLines.join('\r\n')}\r\n\r\n`);
      if (head.length > 0) upstream.write(head);
      upstream.pipe(socket);
      socket.pipe(upstream);
    });
    upstream.on('error', () => socket.destroy());
    socket.on('error', () => upstream.destroy());
  });

  return server;
}

function prefixStream(stream, tag, target) {
  let buffer = '';
  stream.on('data', (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      target.write(`[${tag}] ${line}\n`);
    }
  });
  stream.on('end', () => {
    if (buffer) target.write(`[${tag}] ${buffer}\n`);
  });
}

function printBanner(publicWebhookUrl) {
  console.log('');
  console.log('=======================================================');
  console.log(` FossaPay Demos (${mode.toUpperCase()} mode)`);
  console.log('-------------------------------------------------------');
  console.log(` Landing page : http://localhost:${sitePort}`);
  console.log(` SafeDeal     : http://localhost:${sitePort}/safedeal   (or :3001/safedeal)`);
  console.log(` SquadPay     : http://localhost:${sitePort}/squadpay   (or :3002/squadpay)`);
  console.log(` AjoSphere    : http://localhost:${sitePort}/ajosphere  (or :3003/ajosphere)`);
  console.log(` NairaBridge  : http://localhost:${sitePort}/near-offramp (or :3000/near-offramp)`);
  console.log(` Gateway UI   : http://localhost:${gatewayPort}`);
  if (publicWebhookUrl) {
    console.log(` Webhook URL  : ${publicWebhookUrl}`);
  }
  console.log('=======================================================');
  console.log('');
}

// Ensure shared @fossapay/client build output is up to date before booting Next.js apps
const buildRes = spawnSync('npm', ['run', 'build', '--workspace=packages/fossapay-client'], {
  cwd: rootDir,
  stdio: 'inherit',
});
if (buildRes.status !== 0) {
  process.exit(buildRes.status ?? 1);
}

const publicWebhookUrl =
  process.env.PUBLIC_WEBHOOK_URL ||
  (isLive ? 'https://fossapay-demo.reachapp.xyz/platforms/webhook' : undefined);

const sharedEnv = {
  ...process.env,
  FOSSAPAY_MODE: mode,
};

const gatewayEnv = {
  ...sharedEnv,
  PORT: String(gatewayPort),
  ...(publicWebhookUrl ? { PUBLIC_WEBHOOK_URL: publicWebhookUrl } : {}),
  NEAR_OFFRAMP_WEBHOOK_URL:
    process.env.NEAR_OFFRAMP_WEBHOOK_URL || 'http://127.0.0.1:3000/near-offramp/api/webhook',
  SAFEDEAL_WEBHOOK_URL:
    process.env.SAFEDEAL_WEBHOOK_URL || 'http://127.0.0.1:3001/safedeal/api/webhook',
  SQUADPAY_WEBHOOK_URL:
    process.env.SQUADPAY_WEBHOOK_URL || 'http://127.0.0.1:3002/squadpay/api/webhook',
  AJOSPHERE_WEBHOOK_URL:
    process.env.AJOSPHERE_WEBHOOK_URL || 'http://127.0.0.1:3003/ajosphere/api/webhook',
  NEAR_OFFRAMP_APP_URL: process.env.NEAR_OFFRAMP_APP_URL || `http://localhost:${sitePort}/near-offramp`,
  SAFEDEAL_APP_URL: process.env.SAFEDEAL_APP_URL || `http://localhost:${sitePort}/safedeal`,
  SQUADPAY_APP_URL: process.env.SQUADPAY_APP_URL || `http://localhost:${sitePort}/squadpay`,
  AJOSPHERE_APP_URL: process.env.AJOSPHERE_APP_URL || `http://localhost:${sitePort}/ajosphere`,
};

const siteServer = createSiteAndProxyServer();
siteServer.on('error', (err) => {
  console.error(`[site] Failed to listen on port ${sitePort}: ${err.message}`);
  shutdown(1);
});
siteServer.listen(sitePort, '127.0.0.1', () => {
  printBanner(publicWebhookUrl);
});

const services = [
  { tag: 'offramp', script: 'dev:offramp', env: sharedEnv },
  { tag: 'safedeal', script: 'dev:safedeal', env: sharedEnv },
  { tag: 'squadpay', script: 'dev:squadpay', env: sharedEnv },
  { tag: 'ajosphere', script: 'dev:ajosphere', env: sharedEnv },
  { tag: 'gateway', script: 'dev:gateway', env: gatewayEnv },
];

const children = [];
let shuttingDown = false;

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  siteServer.close();
  for (const child of children) {
    if (!child.pid) continue;
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      try {
        child.kill('SIGTERM');
      } catch {}
    }
  }
  setTimeout(() => process.exit(exitCode), 300).unref();
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

for (const svc of services) {
  const child = spawn('npm', ['run', svc.script], {
    cwd: rootDir,
    env: svc.env,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  children.push(child);
  prefixStream(child.stdout, svc.tag, process.stdout);
  prefixStream(child.stderr, svc.tag, process.stderr);
  child.on('exit', (code) => {
    if (!shuttingDown && code !== 0) {
      console.error(`[${svc.tag}] exited with code ${code}; shutting down`);
      shutdown(code ?? 1);
    }
  });
}
