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

exports.getStatus = async (req, res) => {
  const frontendUrl = process.env.FRONTEND_URL?.split(',')[0]?.trim() || null;

  const [dbResult, nginxResult, siteResult] = await Promise.all([
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
    frontendUrl ? checkHttp(frontendUrl) : Promise.resolve({ ok: null, latency: null }),
  ]);

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
    site: {
      url: frontendUrl,
      status: siteResult.ok === null ? 'not_configured' : siteResult.ok ? 'ok' : 'error',
      latency: siteResult.latency,
    },
  });
};
