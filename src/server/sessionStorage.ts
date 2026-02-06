import Database from 'better-sqlite3';
import path from 'path';
import { Session } from '@shopify/shopify-api';

const dbPath = path.join(__dirname, '../../data/sessions.db');
const db = new Database(dbPath);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// Create sessions table
db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    shop TEXT NOT NULL,
    state TEXT,
    is_online INTEGER NOT NULL DEFAULT 0,
    scope TEXT,
    access_token TEXT,
    expires_at TEXT,
    online_access_info TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_shop ON sessions(shop);
`);

// Create product metadata cache table
db.exec(`
  CREATE TABLE IF NOT EXISTS product_cache (
    id INTEGER PRIMARY KEY,
    shop TEXT NOT NULL,
    product_id TEXT NOT NULL,
    image_url TEXT,
    product_type TEXT,
    vendor TEXT,
    category TEXT,
    cached_at TEXT DEFAULT (datetime('now')),
    UNIQUE(shop, product_id)
  );

  CREATE INDEX IF NOT EXISTS idx_product_cache_shop ON product_cache(shop);
  CREATE INDEX IF NOT EXISTS idx_product_cache_lookup ON product_cache(shop, product_id);
`);

// Create orders cache table
db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER NOT NULL,
    shop TEXT NOT NULL,
    name TEXT,
    email TEXT,
    created_at TEXT NOT NULL,
    total_price TEXT,
    subtotal_price TEXT,
    total_discounts TEXT,
    total_line_items_price TEXT,
    currency TEXT,
    financial_status TEXT,
    tags TEXT,
    customer_json TEXT,
    refunds_json TEXT,
    line_items_json TEXT NOT NULL,
    synced_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (shop, id)
  );

  CREATE INDEX IF NOT EXISTS idx_orders_shop ON orders(shop);
  CREATE INDEX IF NOT EXISTS idx_orders_shop_created ON orders(shop, created_at);
`);

// Create order sync status table
db.exec(`
  CREATE TABLE IF NOT EXISTS order_sync_status (
    shop TEXT PRIMARY KEY,
    status TEXT NOT NULL DEFAULT 'idle',
    total_orders INTEGER,
    synced_orders INTEGER DEFAULT 0,
    last_order_id TEXT,
    last_sync_at TEXT,
    error_message TEXT,
    next_page_info TEXT
  );
`);

interface SessionRow {
  id: string;
  shop: string;
  state: string | null;
  is_online: number;
  scope: string | null;
  access_token: string | null;
  expires_at: string | null;
  online_access_info: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Store a session in the database
 */
export function storeSession(session: Session): boolean {
  try {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO sessions (
        id, shop, state, is_online, scope, access_token, expires_at, online_access_info, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);

    stmt.run(
      session.id,
      session.shop,
      session.state || null,
      session.isOnline ? 1 : 0,
      session.scope || null,
      session.accessToken || null,
      session.expires ? session.expires.toISOString() : null,
      session.onlineAccessInfo ? JSON.stringify(session.onlineAccessInfo) : null
    );

    console.log(`✅ Session stored for shop: ${session.shop}`);
    return true;
  } catch (error) {
    console.error('Failed to store session:', error);
    return false;
  }
}

/**
 * Load a session by ID
 */
export function loadSession(id: string): Session | undefined {
  try {
    const stmt = db.prepare('SELECT * FROM sessions WHERE id = ?');
    const row = stmt.get(id) as SessionRow | undefined;

    if (!row) {
      return undefined;
    }

    return rowToSession(row);
  } catch (error) {
    console.error('Failed to load session by ID:', error);
    return undefined;
  }
}

/**
 * Load a session by shop domain (for offline sessions)
 */
export function loadSessionByShop(shop: string): Session | undefined {
  try {
    // For offline sessions, the ID is typically "offline_<shop>"
    const stmt = db.prepare('SELECT * FROM sessions WHERE shop = ? ORDER BY updated_at DESC LIMIT 1');
    const row = stmt.get(shop) as SessionRow | undefined;

    if (!row) {
      return undefined;
    }

    return rowToSession(row);
  } catch (error) {
    console.error('Failed to load session by shop:', error);
    return undefined;
  }
}

/**
 * Delete a session by ID
 */
export function deleteSession(id: string): boolean {
  try {
    const stmt = db.prepare('DELETE FROM sessions WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  } catch (error) {
    console.error('Failed to delete session:', error);
    return false;
  }
}

/**
 * Delete all sessions for a shop
 */
export function deleteSessionsByShop(shop: string): boolean {
  try {
    const stmt = db.prepare('DELETE FROM sessions WHERE shop = ?');
    const result = stmt.run(shop);
    console.log(`Deleted ${result.changes} session(s) for shop: ${shop}`);
    return result.changes > 0;
  } catch (error) {
    console.error('Failed to delete sessions by shop:', error);
    return false;
  }
}

/**
 * Find all sessions for a shop
 */
export function findSessionsByShop(shop: string): Session[] {
  try {
    const stmt = db.prepare('SELECT * FROM sessions WHERE shop = ?');
    const rows = stmt.all(shop) as SessionRow[];
    return rows.map(rowToSession);
  } catch (error) {
    console.error('Failed to find sessions by shop:', error);
    return [];
  }
}

/**
 * Clean up expired sessions
 */
export function cleanupExpiredSessions(): number {
  try {
    const stmt = db.prepare(`
      DELETE FROM sessions
      WHERE expires_at IS NOT NULL
      AND datetime(expires_at) < datetime('now')
    `);
    const result = stmt.run();
    if (result.changes > 0) {
      console.log(`Cleaned up ${result.changes} expired session(s)`);
    }
    return result.changes;
  } catch (error) {
    console.error('Failed to cleanup expired sessions:', error);
    return 0;
  }
}

/**
 * Convert database row to Session object
 */
function rowToSession(row: SessionRow): Session {
  const session = new Session({
    id: row.id,
    shop: row.shop,
    state: row.state || '',
    isOnline: row.is_online === 1,
  });

  if (row.scope) {
    session.scope = row.scope;
  }
  if (row.access_token) {
    session.accessToken = row.access_token;
  }
  if (row.expires_at) {
    session.expires = new Date(row.expires_at);
  }
  if (row.online_access_info) {
    try {
      session.onlineAccessInfo = JSON.parse(row.online_access_info);
    } catch {
      // Ignore parse errors
    }
  }

  return session;
}

// ============================================
// Product Metadata Cache Functions
// ============================================

export interface CachedProductMetadata {
  productId: string;
  imageUrl: string | null;
  productType: string;
  vendor: string;
  category: string;
  cachedAt: Date;
}

interface ProductCacheRow {
  product_id: string;
  image_url: string | null;
  product_type: string | null;
  vendor: string | null;
  category: string | null;
  cached_at: string;
}

// Cache TTL: 24 hours (product metadata doesn't change often)
const CACHE_TTL_HOURS = 24;

/**
 * Get cached product metadata for multiple product IDs
 * Returns a map of productId -> metadata (only for products found in cache)
 */
export function getCachedProducts(shop: string, productIds: string[]): Map<string, CachedProductMetadata> {
  const result = new Map<string, CachedProductMetadata>();

  if (productIds.length === 0) {
    return result;
  }

  try {
    const placeholders = productIds.map(() => '?').join(',');
    const stmt = db.prepare(`
      SELECT product_id, image_url, product_type, vendor, category, cached_at
      FROM product_cache
      WHERE shop = ?
        AND product_id IN (${placeholders})
        AND datetime(cached_at) > datetime('now', '-${CACHE_TTL_HOURS} hours')
    `);

    const rows = stmt.all(shop, ...productIds) as ProductCacheRow[];

    for (const row of rows) {
      result.set(row.product_id, {
        productId: row.product_id,
        imageUrl: row.image_url,
        productType: row.product_type || '',
        vendor: row.vendor || '',
        category: row.category || '',
        cachedAt: new Date(row.cached_at),
      });
    }
  } catch (error) {
    console.error('Failed to get cached products:', error);
  }

  return result;
}

/**
 * Cache product metadata for a single product
 */
export function cacheProduct(
  shop: string,
  productId: string,
  metadata: {
    imageUrl: string | null;
    productType: string;
    vendor: string;
    category: string;
  }
): boolean {
  try {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO product_cache
        (shop, product_id, image_url, product_type, vendor, category, cached_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `);

    stmt.run(
      shop,
      productId,
      metadata.imageUrl,
      metadata.productType,
      metadata.vendor,
      metadata.category
    );

    return true;
  } catch (error) {
    console.error('Failed to cache product:', error);
    return false;
  }
}

/**
 * Cache multiple products at once (more efficient for bulk operations)
 */
export function cacheProducts(
  shop: string,
  products: Array<{
    productId: string;
    imageUrl: string | null;
    productType: string;
    vendor: string;
    category: string;
  }>
): number {
  if (products.length === 0) {
    return 0;
  }

  try {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO product_cache
        (shop, product_id, image_url, product_type, vendor, category, cached_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `);

    const insertMany = db.transaction((items: typeof products) => {
      let count = 0;
      for (const item of items) {
        stmt.run(shop, item.productId, item.imageUrl, item.productType, item.vendor, item.category);
        count++;
      }
      return count;
    });

    return insertMany(products);
  } catch (error) {
    console.error('Failed to cache products:', error);
    return 0;
  }
}

/**
 * Clear expired product cache entries
 */
export function cleanupExpiredProductCache(): number {
  try {
    const stmt = db.prepare(`
      DELETE FROM product_cache
      WHERE datetime(cached_at) < datetime('now', '-${CACHE_TTL_HOURS} hours')
    `);
    const result = stmt.run();
    if (result.changes > 0) {
      console.log(`Cleaned up ${result.changes} expired product cache entries`);
    }
    return result.changes;
  } catch (error) {
    console.error('Failed to cleanup product cache:', error);
    return 0;
  }
}

/**
 * Clear all product cache for a shop
 */
export function clearProductCacheForShop(shop: string): number {
  try {
    const stmt = db.prepare('DELETE FROM product_cache WHERE shop = ?');
    const result = stmt.run(shop);
    console.log(`Cleared ${result.changes} product cache entries for shop: ${shop}`);
    return result.changes;
  } catch (error) {
    console.error('Failed to clear product cache:', error);
    return 0;
  }
}

// ============================================
// Order Cache Functions
// ============================================

export interface CachedOrder {
  id: number;
  name: string;
  email: string;
  created_at: string;
  total_price: string;
  subtotal_price: string;
  total_discounts: string;
  total_line_items_price: string;
  currency: string;
  financial_status: string;
  tags: string;
  customer?: {
    id: number;
    email: string;
    orders_count: number;
  } | null;
  refunds?: Array<{
    id: number;
    created_at: string;
    transactions: Array<{
      amount: string;
    }>;
  }>;
  line_items: Array<{
    id: number;
    title: string;
    quantity: number;
    price: string;
    variant_title: string | null;
    sku: string | null;
    product_id: number;
    variant_id: number;
    vendor: string | null;
    product_type: string | null;
  }>;
}

interface OrderRow {
  id: number;
  shop: string;
  name: string | null;
  email: string | null;
  created_at: string;
  total_price: string | null;
  subtotal_price: string | null;
  total_discounts: string | null;
  total_line_items_price: string | null;
  currency: string | null;
  financial_status: string | null;
  tags: string | null;
  customer_json: string | null;
  refunds_json: string | null;
  line_items_json: string;
  synced_at: string;
}

export interface OrderSyncStatus {
  shop: string;
  status: 'idle' | 'syncing' | 'completed' | 'error';
  totalOrders: number | null;
  syncedOrders: number;
  lastOrderId: string | null;
  lastSyncAt: string | null;
  errorMessage: string | null;
  nextPageInfo: string | null;
}

interface SyncStatusRow {
  shop: string;
  status: string;
  total_orders: number | null;
  synced_orders: number;
  last_order_id: string | null;
  last_sync_at: string | null;
  error_message: string | null;
  next_page_info: string | null;
}

/**
 * Get all cached orders for a shop
 */
export function getOrdersByShop(shop: string): CachedOrder[] {
  try {
    const stmt = db.prepare(`
      SELECT * FROM orders
      WHERE shop = ?
      ORDER BY created_at DESC
    `);
    const rows = stmt.all(shop) as OrderRow[];

    return rows.map(row => ({
      id: row.id,
      name: row.name || '',
      email: row.email || '',
      created_at: row.created_at,
      total_price: row.total_price || '0',
      subtotal_price: row.subtotal_price || '0',
      total_discounts: row.total_discounts || '0',
      total_line_items_price: row.total_line_items_price || '0',
      currency: row.currency || 'USD',
      financial_status: row.financial_status || 'pending',
      tags: row.tags || '',
      customer: row.customer_json ? JSON.parse(row.customer_json) : null,
      refunds: row.refunds_json ? JSON.parse(row.refunds_json) : undefined,
      line_items: JSON.parse(row.line_items_json),
    }));
  } catch (error) {
    console.error('Failed to get orders by shop:', error);
    return [];
  }
}

/**
 * Get the count of cached orders for a shop
 */
export function getOrderCount(shop: string): number {
  try {
    const stmt = db.prepare('SELECT COUNT(*) as count FROM orders WHERE shop = ?');
    const result = stmt.get(shop) as { count: number };
    return result.count;
  } catch (error) {
    console.error('Failed to get order count:', error);
    return 0;
  }
}

/**
 * Get the latest (highest) order ID for a shop (for incremental sync)
 */
export function getLatestOrderId(shop: string): string | null {
  try {
    const stmt = db.prepare('SELECT MAX(id) as max_id FROM orders WHERE shop = ?');
    const result = stmt.get(shop) as { max_id: number | null };
    return result.max_id ? String(result.max_id) : null;
  } catch (error) {
    console.error('Failed to get latest order ID:', error);
    return null;
  }
}

/**
 * Upsert orders (insert or update) for a shop
 * Returns the number of orders upserted
 */
export function upsertOrders(shop: string, orders: CachedOrder[]): number {
  if (orders.length === 0) {
    return 0;
  }

  try {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO orders (
        id, shop, name, email, created_at, total_price, subtotal_price,
        total_discounts, total_line_items_price, currency, financial_status,
        tags, customer_json, refunds_json, line_items_json, synced_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);

    const insertMany = db.transaction((items: CachedOrder[]) => {
      let count = 0;
      for (const order of items) {
        stmt.run(
          order.id,
          shop,
          order.name,
          order.email,
          order.created_at,
          order.total_price,
          order.subtotal_price,
          order.total_discounts,
          order.total_line_items_price,
          order.currency,
          order.financial_status,
          order.tags,
          order.customer ? JSON.stringify(order.customer) : null,
          order.refunds ? JSON.stringify(order.refunds) : null,
          JSON.stringify(order.line_items)
        );
        count++;
      }
      return count;
    });

    return insertMany(orders);
  } catch (error) {
    console.error('Failed to upsert orders:', error);
    return 0;
  }
}

/**
 * Clear all orders for a shop
 */
export function clearOrdersForShop(shop: string): number {
  try {
    const stmt = db.prepare('DELETE FROM orders WHERE shop = ?');
    const result = stmt.run(shop);
    console.log(`Cleared ${result.changes} orders for shop: ${shop}`);
    return result.changes;
  } catch (error) {
    console.error('Failed to clear orders:', error);
    return 0;
  }
}

// ============================================
// Order Sync Status Functions
// ============================================

/**
 * Get sync status for a shop
 */
export function getSyncStatus(shop: string): OrderSyncStatus {
  try {
    const stmt = db.prepare('SELECT * FROM order_sync_status WHERE shop = ?');
    const row = stmt.get(shop) as SyncStatusRow | undefined;

    if (!row) {
      return {
        shop,
        status: 'idle',
        totalOrders: null,
        syncedOrders: 0,
        lastOrderId: null,
        lastSyncAt: null,
        errorMessage: null,
        nextPageInfo: null,
      };
    }

    return {
      shop: row.shop,
      status: row.status as OrderSyncStatus['status'],
      totalOrders: row.total_orders,
      syncedOrders: row.synced_orders,
      lastOrderId: row.last_order_id,
      lastSyncAt: row.last_sync_at,
      errorMessage: row.error_message,
      nextPageInfo: row.next_page_info,
    };
  } catch (error) {
    console.error('Failed to get sync status:', error);
    return {
      shop,
      status: 'idle',
      totalOrders: null,
      syncedOrders: 0,
      lastOrderId: null,
      lastSyncAt: null,
      errorMessage: null,
      nextPageInfo: null,
    };
  }
}

/**
 * Update sync status for a shop
 */
export function updateSyncStatus(
  shop: string,
  update: Partial<Omit<OrderSyncStatus, 'shop'>>
): void {
  try {
    // First ensure a row exists
    const insertStmt = db.prepare(`
      INSERT OR IGNORE INTO order_sync_status (shop) VALUES (?)
    `);
    insertStmt.run(shop);

    // Build update query dynamically
    const updates: string[] = [];
    const values: (string | number | null)[] = [];

    if (update.status !== undefined) {
      updates.push('status = ?');
      values.push(update.status);
    }
    if (update.totalOrders !== undefined) {
      updates.push('total_orders = ?');
      values.push(update.totalOrders);
    }
    if (update.syncedOrders !== undefined) {
      updates.push('synced_orders = ?');
      values.push(update.syncedOrders);
    }
    if (update.lastOrderId !== undefined) {
      updates.push('last_order_id = ?');
      values.push(update.lastOrderId);
    }
    if (update.lastSyncAt !== undefined) {
      updates.push('last_sync_at = ?');
      values.push(update.lastSyncAt);
    }
    if (update.errorMessage !== undefined) {
      updates.push('error_message = ?');
      values.push(update.errorMessage);
    }
    if (update.nextPageInfo !== undefined) {
      updates.push('next_page_info = ?');
      values.push(update.nextPageInfo);
    }

    if (updates.length > 0) {
      values.push(shop);
      const updateStmt = db.prepare(`
        UPDATE order_sync_status SET ${updates.join(', ')} WHERE shop = ?
      `);
      updateStmt.run(...values);
    }
  } catch (error) {
    console.error('Failed to update sync status:', error);
  }
}

/**
 * Reset sync status to idle (e.g., after server restart)
 */
export function resetStuckSyncs(): number {
  try {
    const stmt = db.prepare(`
      UPDATE order_sync_status
      SET status = 'idle', error_message = 'Sync interrupted by server restart'
      WHERE status = 'syncing'
    `);
    const result = stmt.run();
    if (result.changes > 0) {
      console.log(`Reset ${result.changes} stuck sync(s)`);
    }
    return result.changes;
  } catch (error) {
    console.error('Failed to reset stuck syncs:', error);
    return 0;
  }
}

/**
 * Migration: Fix missing total_line_items_price values
 * Updates orders where total_line_items_price is NULL by setting it to subtotal_price
 */
export function migrateOrderTotalLineItemsPrice(): number {
  try {
    const stmt = db.prepare(`
      UPDATE orders
      SET total_line_items_price = subtotal_price
      WHERE total_line_items_price IS NULL OR total_line_items_price = ''
    `);
    const result = stmt.run();
    if (result.changes > 0) {
      console.log(`✅ Migrated ${result.changes} orders with missing total_line_items_price`);
    }
    return result.changes;
  } catch (error) {
    console.error('Failed to migrate total_line_items_price:', error);
    return 0;
  }
}

// Run cleanup on startup
cleanupExpiredSessions();
cleanupExpiredProductCache();
resetStuckSyncs();
migrateOrderTotalLineItemsPrice();

// Schedule periodic cleanup (every hour)
setInterval(() => {
  cleanupExpiredSessions();
  cleanupExpiredProductCache();
}, 60 * 60 * 1000);

export default db;
