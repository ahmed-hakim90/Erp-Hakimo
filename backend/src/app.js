import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { verifySupabaseJwt } from './middleware/auth.js';
import { tenantContext } from './middleware/tenant.js';
import { productionRouter } from './domains/production/routes.js';

export const app = express();

app.use(cors({ origin: env.frontendOrigin, credentials: true }));
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'hakimo-erp-backend' });
});

app.use('/api', verifySupabaseJwt, tenantContext);
app.use('/api/production', productionRouter);

app.use((error, _req, res, _next) => {
  console.error('[backend] Unhandled error:', error);
  res.status(500).json({
    error: error?.message || 'Internal server error',
  });
});
