const prisma = require('../config/prismaClient');
const axios = require('axios');

async function checkHttp(url) {
  const start = Date.now();
  try {
    await axios.get(url, { timeout: 3000 });
    return { ok: true, latency: Date.now() - start };
  } catch {
    return { ok: false, latency: Date.now() - start };
  }
}

async function fetchJson(url) {
  try {
    const res = await axios.get(url, { timeout: 3000 });
    return res.data;
  } catch {
    return null;
  }
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
  const ngrokOk = !!(ngrokData && tunnel);

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
      status: ngrokOk ? 'ok' : 'offline',
      url: tunnel?.public_url ?? null,
      tunnelCount: ngrokData?.tunnels?.length ?? 0,
    },
  });
};
