import { Router } from 'express';
import { getShopifyConfig } from '../../config/shopify';

export const configRouter = Router();

configRouter.get('/client', (req, res) => {
  const config = getShopifyConfig();

  // Only return client-safe configuration (no secrets)
  res.json({
    storeDomain: config.storeUrl.replace(/^[^.]+\./, ''), // Extract domain part (e.g., "myshopify.com")
  });
});
