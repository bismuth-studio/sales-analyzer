import { Router } from 'express';
import { config } from 'dotenv';
import '@shopify/shopify-api/adapters/node';
import { shopifyApi, Session, ApiVersion } from '@shopify/shopify-api';

// Load environment variables
config();

const router = Router();

// Initialize Shopify API
export const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY!,
  apiSecretKey: process.env.SHOPIFY_API_SECRET!,
  scopes: process.env.SHOPIFY_SCOPES?.split(',') || ['read_orders'],
  hostName: process.env.SHOPIFY_APP_URL?.replace(/https?:\/\//, '') || 'localhost:3000',
  hostScheme: 'https',
  apiVersion: ApiVersion.January26,
  isEmbeddedApp: true,
});

// Store sessions in memory (for production, use a database)
const sessionStorage = new Map<string, Session>();

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

    // Store session
    sessionStorage.set(session.shop, session);

    // Log access token for bulk order generation script
    console.log('\n🔑 Access Token (add to .env as SHOPIFY_ACCESS_TOKEN):');
    console.log(session.accessToken);
    console.log('');

    // Redirect to app with shop parameter
    res.redirect(`/?shop=${session.shop}&host=${req.query.host}`);
  } catch (error) {
    console.error('Auth callback error:', error);
    res.status(500).send('Authentication failed');
  }
});

// Get session for a shop
export const getSession = (shop: string): Session | undefined => {
  return sessionStorage.get(shop);
};

export default router;
