import express from 'express';
import cors from 'cors';
import path from 'path';
import shopifyRouter from './shopify';
import ordersRouter from './orders';
import dropsRouter from './drops';
import { configRouter } from './routes/config';
import { getShopifyConfig } from '../config/shopify';

const app = express();
const config = getShopifyConfig();
const PORT = config.port;

app.use(cors());
app.use(express.json());

// Serve static files from the React app
app.use(express.static(path.join(__dirname, '../../dist/client')));

// Configuration API routes (client-safe config)
app.use('/api/config', configRouter);

// Shopify OAuth and webhook routes
app.use('/api/shopify', shopifyRouter);

// Orders API routes
app.use('/api/orders', ordersRouter);

// Drops API routes
app.use('/api/drops', dropsRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', message: 'Sales Analyzer API is running' });
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
