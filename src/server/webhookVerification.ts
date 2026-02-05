/**
 * Webhook HMAC Verification
 *
 * Verifies that incoming webhooks are actually from Shopify
 * and haven't been tampered with.
 */

import crypto from 'crypto';
import { Request } from 'express';
import { getShopifyConfig } from '../config/shopify';

/**
 * Verify webhook HMAC signature
 *
 * @param req - Express request object
 * @returns true if signature is valid, false otherwise
 */
export function verifyWebhookHmac(req: Request): boolean {
  const hmacHeader = req.get('X-Shopify-Hmac-Sha256');

  if (!hmacHeader) {
    console.error('Missing X-Shopify-Hmac-Sha256 header');
    return false;
  }

  // Get raw body (must be raw buffer, not parsed JSON)
  const body = (req as any).rawBody;

  if (!body) {
    console.error('Missing raw body for HMAC verification');
    return false;
  }

  const config = getShopifyConfig();
  const hash = crypto
    .createHmac('sha256', config.apiSecret)
    .update(body, 'utf8')
    .digest('base64');

  // Constant-time comparison to prevent timing attacks
  const calculatedHmac = Buffer.from(hash, 'base64');
  const receivedHmac = Buffer.from(hmacHeader, 'base64');

  if (calculatedHmac.length !== receivedHmac.length) {
    console.error('HMAC length mismatch');
    return false;
  }

  // Use timingSafeEqual for constant-time comparison
  try {
    return crypto.timingSafeEqual(calculatedHmac, receivedHmac);
  } catch (error) {
    console.error('HMAC verification failed:', error);
    return false;
  }
}

/**
 * Extract shop domain from webhook headers
 */
export function getWebhookShop(req: Request): string | null {
  return req.get('X-Shopify-Shop-Domain') || null;
}

/**
 * Extract webhook topic from headers
 */
export function getWebhookTopic(req: Request): string | null {
  return req.get('X-Shopify-Topic') || null;
}
