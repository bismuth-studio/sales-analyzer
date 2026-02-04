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

// Run cleanup on startup
cleanupExpiredSessions();
cleanupExpiredProductCache();

// Schedule periodic cleanup (every hour)
setInterval(() => {
  cleanupExpiredSessions();
  cleanupExpiredProductCache();
}, 60 * 60 * 1000);

export default db;
