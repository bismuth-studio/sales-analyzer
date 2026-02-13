/**
 * Helper script to extract the access token from the current session
 * Run this after you've installed the app to get the access token
 */

import express from 'express';
import { getSession } from '../src/server/shopify';

const app = express();

app.get('/get-token', (req, res) => {
  const shop = 'hackalot-will.myshopify.com';
  const session = getSession(shop);

  if (!session) {
    return res.json({
      error: 'No session found',
      message: 'Please install the app first by visiting the OAuth URL',
    });
  }

  res.json({
    success: true,
    accessToken: session.accessToken,
    shop: session.shop,
    message: 'Add this to your .env file as SHOPIFY_ACCESS_TOKEN',
  });
});

const PORT = 3002;
app.listen(PORT, () => {
  console.log(`\n🔑 Access Token Helper running on http://localhost:${PORT}`);
  console.log(`\n📝 Visit: http://localhost:${PORT}/get-token`);
  console.log(`\nCopy the accessToken value and add it to your .env file:\n`);
  console.log(`SHOPIFY_ACCESS_TOKEN=your_token_here\n`);
});
