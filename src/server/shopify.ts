import { Router, Request, Response } from 'express';
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

    // Store session persistently
    storeSession(session);

    console.log(`✅ OAuth completed successfully for ${session.shop}`);

    // Register webhooks with Shopify
    try {
      await registerWebhooks(session);
      console.log(`✅ Webhooks registered for ${session.shop}`);
    } catch (webhookError) {
      console.error(`Failed to register webhooks for ${session.shop}:`, webhookError);
      // Don't fail the installation, just log the error
    }

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

/**
 * Register mandatory webhooks with Shopify
 */
async function registerWebhooks(session: Session): Promise<void> {
  const client = new shopify.clients.Rest({ session });
  const webhookBaseUrl = `${config.appUrl}/api/webhooks`;

  const webhooks = [
    // GDPR Mandatory Webhooks
    { topic: 'customers/data_request', address: `${webhookBaseUrl}/customers/data_request` },
    { topic: 'customers/redact', address: `${webhookBaseUrl}/customers/redact` },
    { topic: 'shop/redact', address: `${webhookBaseUrl}/shop/redact` },
    // App Lifecycle
    { topic: 'app/uninstalled', address: `${webhookBaseUrl}/app/uninstalled` },
    // Real-time order sync
    { topic: 'orders/create', address: `${webhookBaseUrl}/orders/create` },
    { topic: 'orders/updated', address: `${webhookBaseUrl}/orders/updated` },
  ];

  for (const webhook of webhooks) {
    try {
      await client.post({
        path: 'webhooks',
        data: {
          webhook: {
            topic: webhook.topic,
            address: webhook.address,
            format: 'json',
          },
        },
      });
      console.log(`  ✓ Registered webhook: ${webhook.topic}`);
    } catch (error: any) {
      // Webhook might already exist, check for that
      if (error.response?.body?.errors?.includes('already exists')) {
        console.log(`  ⚠ Webhook already exists: ${webhook.topic}`);
      } else {
        console.error(`  ✗ Failed to register webhook ${webhook.topic}:`, error.message);
        throw error;
      }
    }
  }
}

/**
 * Manual webhook registration endpoint
 * Allows re-registering webhooks without going through OAuth
 */
router.post('/webhooks/register', async (req: Request, res: Response) => {
  try {
    const shop = req.query.shop as string;

    if (!shop) {
      return res.status(400).json({ error: 'Missing shop parameter' });
    }

    const session = getSession(shop);
    if (!session) {
      return res.status(401).json({ error: 'Not authenticated. Please install the app first.' });
    }

    console.log(`\n📝 Manually registering webhooks for ${shop}...`);
    await registerWebhooks(session);
    console.log(`✅ Webhook registration completed for ${shop}\n`);

    res.json({ success: true, message: 'Webhooks registered successfully' });
  } catch (error: any) {
    console.error('Failed to register webhooks:', error);
    res.status(500).json({ error: 'Failed to register webhooks', message: error.message });
  }
});

/**
 * Check webhook status
 * Lists all registered webhooks for the shop
 */
router.get('/webhooks/status', async (req: Request, res: Response) => {
  try {
    const shop = req.query.shop as string;

    if (!shop) {
      return res.status(400).json({ error: 'Missing shop parameter' });
    }

    const session = getSession(shop);
    if (!session) {
      return res.status(401).json({ error: 'Not authenticated. Please install the app first.' });
    }

    const client = new shopify.clients.Rest({ session });
    const webhooksResponse = await client.get({ path: 'webhooks' });
    const webhooks = (webhooksResponse.body as any).webhooks || [];

    res.json({
      success: true,
      webhooks: webhooks.map((w: any) => ({
        id: w.id,
        topic: w.topic,
        address: w.address,
        created_at: w.created_at,
      })),
    });
  } catch (error: any) {
    console.error('Failed to get webhook status:', error);
    res.status(500).json({ error: 'Failed to get webhook status', message: error.message });
  }
});

export default router;
