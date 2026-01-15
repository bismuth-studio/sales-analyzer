import express from 'express';
import { config } from 'dotenv';
import cors from 'cors';
import path from 'path';
import shopifyRouter from './shopify';
import ordersRouter from './orders';

config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve static files from the React app
app.use(express.static(path.join(__dirname, '../../dist/client')));

// Shopify OAuth and webhook routes
app.use('/api/shopify', shopifyRouter);

// Orders API routes
app.use('/api/orders', ordersRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Sales Analyzer API is running' });
});

// Serve React app for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../dist/client/index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Sales Analyzer API ready`);
  console.log(`🌐 Visit http://localhost:${PORT}`);
});
