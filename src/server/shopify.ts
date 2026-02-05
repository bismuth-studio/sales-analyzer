import { Router } from 'express';
import '@shopify/shopify-api/adapters/node';
import { shopifyApi, Session, ApiVersion } from '@shopify/shopify-api';
import { storeSession, loadSessionByShop } from './sessionStorage';
import { startOrderSync } from './orderSyncService';
import { getShopifyConfig } from '../config/shopify';

const router = Router();

// Load configuration
const config = getShopifyConfig();

// Initialize Shopify API
export const shopify = shopifyApi({
  apiKey: config.apiKey,
  apiSecretKey: config.apiSecret,
  scopes: config.scopes,
  hostName: config.appUrl?.replace(/https?:\/\//, '') || 'localhost:3000',
  hostScheme: 'https',
  apiVersion: ApiVersion.January26,
  isEmbeddedApp: true,
});

// OAuth callback
router.get('/auth', async (req, res) => {
  const shop = req.query.shop as string;

  if (!shop) {
    return res.status(400).send('Missing shop parameter');
  }

  const authRoute = await shopify.auth.begin({
    shop,
    callbackPath: '/api/shopify/callback',
    isOnline: false,
    rawRequest: req,
    rawResponse: res,
  });

  res.redirect(authRoute);
});

// OAuth callback handler
router.get('/callback', async (req, res) => {
  try {
    const callback = await shopify.auth.callback({
      rawRequest: req,
      rawResponse: res,
    });

    const { session } = callback;

    // Store session persistently in SQLite
    storeSession(session);

    // Log access token for bulk order generation script
    console.log('\n🔑 Access Token (add to .env as SHOPIFY_ACCESS_TOKEN):');
    console.log(session.accessToken);
    console.log('');

    // Trigger initial order sync in background (don't await)
    startOrderSync(session.shop, false).then(result => {
      console.log(`📦 Order sync initiated for ${session.shop}: ${result.message}`);
    }).catch(err => {
      console.error(`Failed to start order sync for ${session.shop}:`, err);
    });

    // Redirect to app with shop parameter
    res.redirect(`/?shop=${session.shop}&host=${req.query.host}`);
  } catch (error) {
    console.error('Auth callback error:', error);
    res.status(500).send('Authentication failed');
  }
});

// Get session for a shop (from persistent SQLite storage)
export const getSession = (shop: string): Session | undefined => {
  return loadSessionByShop(shop);
};

export default router;
