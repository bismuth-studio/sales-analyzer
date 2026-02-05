/**
 * Shopify Webhooks Handler
 *
 * Handles mandatory GDPR webhooks and app lifecycle webhooks
 */

import { Router, Request, Response } from 'express';
import { verifyWebhookHmac, getWebhookShop, getWebhookTopic } from './webhookVerification';
import {
  deleteSessionsByShop,
  clearProductCacheForShop,
  clearOrdersForShop,
} from './sessionStorage';

const router = Router();

/**
 * Middleware to verify webhook authenticity and parse body
 */
function verifyWebhook(req: Request, res: Response, next: Function) {
  if (!verifyWebhookHmac(req)) {
    console.error(`Webhook verification failed for topic: ${getWebhookTopic(req)}`);
    return res.status(401).send('Webhook verification failed');
  }

  // Parse the raw body to JSON now that HMAC is verified
  try {
    const rawBody = (req as any).rawBody;
    req.body = JSON.parse(rawBody.toString('utf8'));
  } catch (error) {
    console.error('Failed to parse webhook body:', error);
    return res.status(400).send('Invalid JSON body');
  }

  next();
}

/**
 * GDPR: Customer Data Request
 *
 * Shopify merchants can request customer data from your app.
 * You must provide this data within 30 days.
 *
 * Payload contains: shop_id, shop_domain, customer (id, email, phone)
 */
router.post('/customers/data_request', verifyWebhook, async (req: Request, res: Response) => {
  const shop = getWebhookShop(req);
  const payload = req.body;

  console.log('📋 GDPR: Customer data request received', {
    shop,
    customer_id: payload.customer?.id,
    customer_email: payload.customer?.email,
  });

  // TODO: In production, you need to:
  // 1. Collect all data you have about this customer
  // 2. Send it to the shop owner (email or download link)
  // 3. Log the request for compliance tracking

  // For now, we'll just log it
  console.log(`Customer data request for customer ${payload.customer?.id} from shop ${shop}`);
  console.log('Action required: Provide customer data within 30 days');

  res.status(200).send('Customer data request acknowledged');
});

/**
 * GDPR: Customer Redaction Request
 *
 * Merchant requests deletion of customer data.
 * You must delete all PII for this customer.
 *
 * Payload contains: shop_id, shop_domain, customer (id, email, phone), orders_to_redact
 */
router.post('/customers/redact', verifyWebhook, async (req: Request, res: Response) => {
  const shop = getWebhookShop(req);
  const payload = req.body;

  console.log('🗑️  GDPR: Customer redaction request received', {
    shop,
    customer_id: payload.customer?.id,
    customer_email: payload.customer?.email,
    orders_to_redact: payload.orders_to_redact?.length,
  });

  try {
    // In this app, customer PII is stored in the orders table
    // We need to redact: name, email, customer data
    // Note: We're using SQLite here, but this will be updated for PostgreSQL

    const db = require('./sessionStorage').default;

    if (payload.orders_to_redact && payload.orders_to_redact.length > 0) {
      const orderIds = payload.orders_to_redact.map((id: number) => id);

      // Redact customer PII from orders
      const stmt = db.prepare(`
        UPDATE orders
        SET
          email = '[REDACTED]',
          customer_json = NULL
        WHERE shop = ? AND id IN (${orderIds.map(() => '?').join(',')})
      `);

      stmt.run(shop, ...orderIds);

      console.log(`✅ Redacted customer data from ${orderIds.length} orders for shop ${shop}`);
    }

    res.status(200).send('Customer data redacted');
  } catch (error) {
    console.error('Failed to redact customer data:', error);
    res.status(500).send('Failed to redact customer data');
  }
});

/**
 * GDPR: Shop Redaction (Shop Deletion)
 *
 * Shop owner has deleted their Shopify store.
 * You must delete ALL data associated with this shop.
 *
 * Payload contains: shop_id, shop_domain
 */
router.post('/shop/redact', verifyWebhook, async (req: Request, res: Response) => {
  const shop = getWebhookShop(req);
  const payload = req.body;

  console.log('🗑️  GDPR: Shop redaction request received', {
    shop,
    shop_id: payload.shop_id,
  });

  try {
    // Delete ALL data for this shop
    const deletedSessions = deleteSessionsByShop(shop!);
    const deletedProducts = clearProductCacheForShop(shop!);
    const deletedOrders = clearOrdersForShop(shop!);

    console.log(`✅ Shop data redacted for ${shop}:`, {
      sessions: deletedSessions,
      products: deletedProducts,
      orders: deletedOrders,
    });

    res.status(200).send('Shop data redacted');
  } catch (error) {
    console.error('Failed to redact shop data:', error);
    res.status(500).send('Failed to redact shop data');
  }
});

/**
 * App Uninstalled
 *
 * Merchant has uninstalled your app.
 * Clean up shop data (but keep for potential re-install based on your data retention policy)
 */
router.post('/app/uninstalled', verifyWebhook, async (req: Request, res: Response) => {
  const shop = getWebhookShop(req);
  const payload = req.body;

  console.log('❌ App uninstalled', {
    shop,
    shop_id: payload.id,
  });

  try {
    // Clean up shop data
    // Note: You might want a softer delete (mark as uninstalled) to allow for re-installs
    // For now, we'll delete everything

    const deletedSessions = deleteSessionsByShop(shop!);
    const deletedProducts = clearProductCacheForShop(shop!);
    const deletedOrders = clearOrdersForShop(shop!);

    console.log(`✅ Cleaned up data for uninstalled shop ${shop}:`, {
      sessions: deletedSessions,
      products: deletedProducts,
      orders: deletedOrders,
    });

    // TODO: Consider implementing soft delete with retention policy
    // E.g., mark shop as uninstalled, delete after 90 days

    res.status(200).send('App uninstall processed');
  } catch (error) {
    console.error('Failed to process app uninstall:', error);
    res.status(500).send('Failed to process app uninstall');
  }
});

/**
 * Orders Created Webhook (Optional - for real-time order sync)
 *
 * Triggered when a new order is created in Shopify.
 * You can use this for real-time order syncing instead of polling.
 */
router.post('/orders/create', verifyWebhook, async (req: Request, res: Response) => {
  const shop = getWebhookShop(req);
  const order = req.body;

  console.log('📦 Order created webhook received', {
    shop,
    order_id: order.id,
    order_name: order.name,
  });

  // TODO: Implement real-time order sync
  // You can use upsertOrders() to add this single order to the cache

  res.status(200).send('Order webhook received');
});

export default router;
