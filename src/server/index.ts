import express from 'express';
import cors from 'cors';
import path from 'path';
import shopifyRouter from './shopify';
import ordersRouter from './orders';
import dropsRouter from './drops';
import webhooksRouter from './webhooks';
import { configRouter } from './routes/config';
import { getShopifyConfig } from '../config/shopify';

const app = express();
const config = getShopifyConfig();
const PORT = config.port;

app.use(cors());

// Webhook routes need raw body for HMAC verification
// Must come BEFORE express.json() middleware
app.use('/api/webhooks', express.raw({ type: 'application/json' }), (req, _res, next) => {
  // Store raw body for HMAC verification
  (req as any).rawBody = req.body;
  next();
});

// Parse JSON for all other routes
app.use(express.json());

// Serve static files from the React app
app.use(express.static(path.join(__dirname, '../../dist/client')));

// Configuration API routes (client-safe config)
app.use('/api/config', configRouter);

// Shopify webhooks (GDPR and app lifecycle)
app.use('/api/webhooks', webhooksRouter);

// Shopify OAuth routes
app.use('/api/shopify', shopifyRouter);

// Orders API routes
app.use('/api/orders', ordersRouter);

// Drops API routes
app.use('/api/drops', dropsRouter);

// Health check endpoint with database connectivity verification
app.get('/api/health', async (_req, res) => {
  const health = {
    status: 'ok',
    message: 'Sales Analyzer API is running',
    timestamp: new Date().toISOString(),
    checks: {
      database: 'unknown',
      config: 'unknown',
    },
  };

  try {
    // Test database connectivity
    const db = require('./sessionStorage').default;
    const testQuery = db.prepare('SELECT 1 as test');
    const result = testQuery.get();
    health.checks.database = result?.test === 1 ? 'healthy' : 'unhealthy';
  } catch (error) {
    health.checks.database = 'error';
    health.status = 'degraded';
  }

  try {
    // Test configuration
    const testConfig = getShopifyConfig();
    health.checks.config = testConfig.apiKey && testConfig.apiSecret ? 'healthy' : 'unhealthy';
  } catch (error) {
    health.checks.config = 'error';
    health.status = 'degraded';
  }

  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
});

// Catch-all for React Router (client-side routing)
app.get('/{*path}', (_req, res) => {
  res.sendFile(path.join(__dirname, '../../dist/client/index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Sales Analyzer API ready`);
  console.log(`🌐 Visit http://localhost:${PORT}`);
});
