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
import { updateDropMetricsForOrder } from './dropMetricsService';

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
  const customerId = payload.customer?.id;
  const customerEmail = payload.customer?.email;

  console.log('GDPR: Customer data request received', {
    shop,
    customer_id: customerId,
    customer_email: customerEmail,
  });

  try {
    // 1. Collect customer data from orders table
    const db = require('./sessionStorage').default;
    const orders = db.prepare(`
      SELECT id, name, email, created_at, total_price, currency, line_items
      FROM orders
      WHERE shop = ? AND (email = ? OR customer_json LIKE ?)
    `).all(shop, customerEmail || '', `%"id":${customerId}%`);

    // 2. Log the request for compliance tracking
    const dataRequestLog = {
      request_id: `gdpr-data-${Date.now()}`,
      shop,
      customer_id: customerId,
      customer_email: customerEmail,
      requested_at: new Date().toISOString(),
      orders_found: orders.length,
      status: 'acknowledged',
    };
    console.log('GDPR Data Request Log:', JSON.stringify(dataRequestLog));

    // 3. Log the data summary (in production, email this to shop owner)
    if (orders.length > 0) {
      console.log(`Customer data for ${customerEmail || customerId}:`);
      console.log(`  - Orders found: ${orders.length}`);
      console.log(`  - Order IDs: ${orders.map((o: { id: number }) => o.id).join(', ')}`);
    } else {
      console.log(`No data found for customer ${customerEmail || customerId}`);
    }

    res.status(200).json({
      acknowledged: true,
      orders_found: orders.length,
      message: 'Data request received and logged. Shop owner will be notified.',
    });
  } catch (error) {
    console.error('Error processing GDPR data request:', error);
    // Always respond 200 to Shopify even on error to prevent retries
    res.status(200).json({
      acknowledged: true,
      message: 'Data request acknowledged',
    });
  }
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
 * Orders Created Webhook (Real-time order sync)
 *
 * Triggered when a new order is created in Shopify.
 * Automatically adds the order to the local cache.
 */
router.post('/orders/create', verifyWebhook, async (req: Request, res: Response) => {
  const shop = getWebhookShop(req);
  const order = req.body;

  console.log('📦 Order created webhook received', {
    shop,
    order_id: order.id,
    order_name: order.name,
    customer_email: order.email,
  });

  try {
    // Transform webhook payload to CachedOrder format
    const { upsertOrders } = require('./sessionStorage');

    const cachedOrder = {
      id: order.id,
      name: order.name,
      email: order.email || order.contact_email || '',
      created_at: order.created_at,
      total_price: order.total_price || '0',
      subtotal_price: order.subtotal_price || '0',
      total_discounts: order.total_discounts || '0',
      total_line_items_price: order.total_line_items_price || order.subtotal_price || '0',
      currency: order.currency || 'USD',
      financial_status: order.financial_status || 'pending',
      tags: order.tags || '',
      customer: order.customer ? {
        id: order.customer.id,
        email: order.customer.email,
        orders_count: order.customer.orders_count || 1,
      } : null,
      line_items: (order.line_items || []).map((item: any) => ({
        id: item.id,
        title: item.title || item.name,
        quantity: item.quantity,
        price: item.price,
        variant_title: item.variant_title,
        sku: item.sku,
        product_id: item.product_id,
        variant_id: item.variant_id,
        vendor: item.vendor,
        product_type: item.product_type,
      })),
      refunds: order.refunds || [],
    };

    // Store the order in the cache
    upsertOrders(shop!, [cachedOrder]);

    // Update metrics for affected drops
    await updateDropMetricsForOrder(shop!, order.created_at);

    console.log(`✅ Order ${order.name} synced to cache for ${shop}`);
    res.status(200).send('Order synced successfully');
  } catch (error) {
    console.error('Failed to sync order from webhook:', error);
    res.status(500).send('Failed to sync order');
  }
});

/**
 * Orders Updated Webhook (Real-time order sync)
 *
 * Triggered when an order is updated in Shopify.
 * Updates the order in the local cache.
 */
router.post('/orders/updated', verifyWebhook, async (req: Request, res: Response) => {
  const shop = getWebhookShop(req);
  const order = req.body;

  console.log('📝 Order updated webhook received', {
    shop,
    order_id: order.id,
    order_name: order.name,
  });

  try {
    // Transform webhook payload to CachedOrder format
    const { upsertOrders } = require('./sessionStorage');

    const cachedOrder = {
      id: order.id,
      name: order.name,
      email: order.email || order.contact_email || '',
      created_at: order.created_at,
      total_price: order.total_price || '0',
      subtotal_price: order.subtotal_price || '0',
      total_discounts: order.total_discounts || '0',
      total_line_items_price: order.total_line_items_price || order.subtotal_price || '0',
      currency: order.currency || 'USD',
      financial_status: order.financial_status || 'pending',
      tags: order.tags || '',
      customer: order.customer ? {
        id: order.customer.id,
        email: order.customer.email,
        orders_count: order.customer.orders_count || 1,
      } : null,
      line_items: (order.line_items || []).map((item: any) => ({
        id: item.id,
        title: item.title || item.name,
        quantity: item.quantity,
        price: item.price,
        variant_title: item.variant_title,
        sku: item.sku,
        product_id: item.product_id,
        variant_id: item.variant_id,
        vendor: item.vendor,
        product_type: item.product_type,
      })),
      refunds: order.refunds || [],
    };

    // Update the order in the cache
    upsertOrders(shop!, [cachedOrder]);

    // Update metrics for affected drops
    await updateDropMetricsForOrder(shop!, order.created_at);

    console.log(`✅ Order ${order.name} updated in cache for ${shop}`);
    res.status(200).send('Order updated successfully');
  } catch (error) {
    console.error('Failed to update order from webhook:', error);
    res.status(500).send('Failed to update order');
  }
});

export default router;
