const prisma = require('../config/prismaClient');
const http = require('http');
const os = require('os');

function checkHttp(url, timeout = 3000) {
  return new Promise((resolve) => {
    const start = Date.now();
    const req = http.get(url, { timeout }, (res) => {
      res.resume();
      resolve({ ok: true, latency: Date.now() - start, statusCode: res.statusCode });
    });
    req.on('error', () => resolve({ ok: false, latency: Date.now() - start }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, latency: timeout }); });
  });
}

function fetchJson(url, timeout = 3000) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => { try { resolve(JSON.parse(body)); } catch { resolve(null); } });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

exports.getStatus = async (req, res) => {
  const [dbResult, nginxResult, ngrokData] = await Promise.all([
    (async () => {
      try {
        const t = Date.now();
        await prisma.$queryRaw`SELECT 1`;
        return { ok: true, latency: Date.now() - t };
      } catch {
        return { ok: false, latency: null };
      }
    })(),
    checkHttp('http://localhost:80'),
    fetchJson('http://localhost:4040/api/tunnels'),
  ]);

  const tunnel = ngrokData?.tunnels?.find(t => t.proto === 'https');

  res.json({
    ok: true,
    timestamp: new Date().toISOString(),
    backend: {
      status: 'ok',
      uptime: Math.floor(process.uptime()),
      memoryMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
      nodeVersion: process.version,
      pid: process.pid,
    },
    database: {
      status: dbResult.ok ? 'ok' : 'error',
      latency: dbResult.latency,
    },
    nginx: {
      status: nginxResult.ok ? 'ok' : 'error',
      latency: nginxResult.latency,
    },
    ngrok: {
      status: ngrokData ? 'ok' : 'offline',
      url: tunnel?.public_url ?? null,
      tunnelCount: ngrokData?.tunnels?.length ?? 0,
    },
  });
};
