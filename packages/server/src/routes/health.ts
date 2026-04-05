// ─── Health Check Route ───────────────────────────────────────────────────────

import { Hono } from 'hono';

const health = new Hono();

health.get('/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'confidential-poker-server',
    timestamp: new Date().toISOString(),
  });
});

export default health;
