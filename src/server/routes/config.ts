import { Router } from 'express';
import { getShopifyConfig } from '../../config/shopify';

export const configRouter = Router();

configRouter.get('/client', (req, res) => {
  const config = getShopifyConfig();

  // Only return client-safe configuration (no secrets)
  // Note: apiKey is safe to expose (required for App Bridge in embedded apps)
  res.json({
    storeDomain: config.storeUrl.replace(/^[^.]+\./, ''), // Extract domain part (e.g., "myshopify.com")
    apiKey: config.apiKey, // Required for App Bridge
  });
});
