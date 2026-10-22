// จำกัดจำนวนคำขอ API: ผู้ใช้ที่ login นับต่อคน (หลายคนออกเน็ตผ่าน IP มหาวิทยาลัย/VPN เดียวกัน) · ยังไม่ login นับต่อ IP
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const { rateLimitKey, createApiLimiter } = require('../middlewares/rateLimit');

const bearer = (payload, secret = process.env.JWT_SECRET) => `Bearer ${jwt.sign(payload, secret)}`;

describe('rateLimitKey', () => {
  const req = (authorization) => ({ headers: authorization ? { authorization } : {}, ip: '10.0.0.7' });

  test('token ถูกต้อง → นับต่อผู้ใช้', () => {
    expect(rateLimitKey(req(bearer({ id: 5, role: 'student' })))).toBe('user:5');
  });

  test('token ปลอม (คนละ secret) → นับต่อ IP — ปลอม id มาหลบเพดานไม่ได้', () => {
    expect(rateLimitKey(req(bearer({ id: 5 }, 'not-the-secret')))).toBe('ip:10.0.0.7');
  });

  test('ไม่มี token / token เสีย → นับต่อ IP', () => {
    expect(rateLimitKey(req())).toBe('ip:10.0.0.7');
    expect(rateLimitKey(req('Bearer garbage'))).toBe('ip:10.0.0.7');
  });
});

describe('createApiLimiter', () => {
  const app = express();
  app.use('/api', createApiLimiter({ max: 2 }));
  app.get('/api/x', (_req, res) => res.json({ ok: true }));
  app.get('/api/internal-status', (_req, res) => res.json({ ok: true }));
  const A = bearer({ id: 1, role: 'student' });
  const B = bearer({ id: 2, role: 'student' });

  test('IP เดียวกัน: คนหนึ่งเกินเพดาน อีกคนยังใช้ได้', async () => {
    expect((await request(app).get('/api/x').set('Authorization', A)).status).toBe(200);
    expect((await request(app).get('/api/x').set('Authorization', A)).status).toBe(200);
    const blocked = await request(app).get('/api/x').set('Authorization', A);
    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({ ok: false, message: expect.any(String) });
    expect((await request(app).get('/api/x').set('Authorization', B)).status).toBe(200);
  });

  test('health check ภายในเครื่องไม่นับ', async () => {
    for (let i = 0; i < 4; i++) expect((await request(app).get('/api/internal-status')).status).toBe(200);
  });
});
