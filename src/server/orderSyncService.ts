/**
 * Order Sync Service
 *
 * Handles background order synchronization with Shopify API.
 * - Rate-limited API requests (1.8 req/sec)
 * - Page-by-page persistence (crash-safe)
 * - SSE event broadcasting for progress updates
 * - Incremental sync support (only fetch new orders)
 */

import { shopify, getSession } from './shopify';
import { rateLimitedRequest } from './shopifyRateLimiter';
import {
  CachedOrder,
  upsertOrders,
  getSyncStatus,
  updateSyncStatus,
  getLatestOrderId,
  getOrderCount,
} from './sessionStorage';

// Types for sync events
export type SyncEventType = 'started' | 'progress' | 'complete' | 'error';

export interface SyncEvent {
  type: SyncEventType;
  shop: string;
  synced: number;
  total: number | null;
  message?: string;
}

export type SyncEventListener = (event: SyncEvent) => void;

// In-memory tracking of active syncs
interface ActiveSync {
  shop: string;
  abortController: AbortController;
  listeners: Set<SyncEventListener>;
}

const activeSyncs = new Map<string, ActiveSync>();

/**
 * Subscribe to sync events for a shop
 */
export function subscribeSyncEvents(shop: string, listener: SyncEventListener): void {
  const sync = activeSyncs.get(shop);
  if (sync) {
    sync.listeners.add(listener);
  } else {
    // Create a placeholder for listeners even if no sync is active
    activeSyncs.set(shop, {
      shop,
      abortController: new AbortController(),
      listeners: new Set([listener]),
    });
  }
}

/**
 * Unsubscribe from sync events
 */
export function unsubscribeSyncEvents(shop: string, listener: SyncEventListener): void {
  const sync = activeSyncs.get(shop);
  if (sync) {
    sync.listeners.delete(listener);
    // Clean up if no listeners and no active sync
    if (sync.listeners.size === 0 && getSyncStatus(shop).status !== 'syncing') {
      activeSyncs.delete(shop);
    }
  }
}

/**
 * Broadcast a sync event to all listeners
 */
function broadcastSyncEvent(shop: string, event: SyncEvent): void {
  const sync = activeSyncs.get(shop);
  if (sync) {
    for (const listener of sync.listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('Error in sync event listener:', err);
      }
    }
  }
}

/**
 * Check if a sync is currently in progress for a shop
 */
export function isSyncInProgress(shop: string): boolean {
  const status = getSyncStatus(shop);
  return status.status === 'syncing';
}

/**
 * Start background order sync for a shop
 *
 * @param shop - The shop domain
 * @param force - If true, fetch all orders. If false, only fetch new orders since last sync.
 * @returns Promise that resolves when sync is started (not completed)
 */
export async function startOrderSync(shop: string, force = false): Promise<{ success: boolean; message: string }> {
  // Check if sync is already in progress
  if (isSyncInProgress(shop)) {
    return { success: false, message: 'Sync already in progress' };
  }

  // Get session for authentication
  const session = getSession(shop);
  if (!session) {
    return { success: false, message: 'No session found. Please authenticate first.' };
  }

  // Initialize or reset the active sync
  const existingSync = activeSyncs.get(shop);
  const listeners = existingSync?.listeners || new Set();

  const abortController = new AbortController();
  activeSyncs.set(shop, {
    shop,
    abortController,
    listeners,
  });

  // Update status to syncing
  updateSyncStatus(shop, {
    status: 'syncing',
    syncedOrders: 0,
    totalOrders: null,
    errorMessage: null,
  });

  // Start the sync in the background (don't await)
  runOrderSync(shop, session, force, abortController.signal).catch((err) => {
    console.error(`Order sync failed for ${shop}:`, err);
    updateSyncStatus(shop, {
      status: 'error',
      errorMessage: err.message || 'Unknown error',
    });
    broadcastSyncEvent(shop, {
      type: 'error',
      shop,
      synced: getSyncStatus(shop).syncedOrders,
      total: null,
      message: err.message || 'Unknown error',
    });
  });

  // Broadcast started event
  broadcastSyncEvent(shop, {
    type: 'started',
    shop,
    synced: 0,
    total: null,
    message: force ? 'Full sync started' : 'Incremental sync started',
  });

  return { success: true, message: force ? 'Full sync started' : 'Incremental sync started' };
}

/**
 * Cancel an ongoing sync
 */
export function cancelSync(shop: string): boolean {
  const sync = activeSyncs.get(shop);
  if (sync && getSyncStatus(shop).status === 'syncing') {
    sync.abortController.abort();
    updateSyncStatus(shop, {
      status: 'idle',
      errorMessage: 'Sync cancelled by user',
    });
    broadcastSyncEvent(shop, {
      type: 'error',
      shop,
      synced: getSyncStatus(shop).syncedOrders,
      total: null,
      message: 'Sync cancelled',
    });
    return true;
  }
  return false;
}

/**
 * Main sync logic - fetches orders page by page
 */
async function runOrderSync(
  shop: string,
  session: any,
  force: boolean,
  signal: AbortSignal
): Promise<void> {
  const client = new shopify.clients.Rest({ session });

  let pageInfo: string | undefined = undefined;
  let hasNextPage = true;
  let totalSynced = 0;

  // For incremental sync, get the latest order ID
  const sinceId = force ? null : getLatestOrderId(shop);

  console.log(`Starting order sync for ${shop} (${force ? 'full' : 'incremental'}${sinceId ? `, since_id=${sinceId}` : ''})`);

  // Check if we have a saved page_info from interrupted sync
  const savedStatus = getSyncStatus(shop);
  if (!force && savedStatus.nextPageInfo) {
    pageInfo = savedStatus.nextPageInfo;
    totalSynced = savedStatus.syncedOrders;
    console.log(`Resuming sync from page_info, already synced: ${totalSynced}`);
  }

  while (hasNextPage) {
    // Check for cancellation
    if (signal.aborted) {
      throw new Error('Sync cancelled');
    }

    // Build query params
    const query: Record<string, string> = pageInfo
      ? { limit: '250', page_info: pageInfo }
      : {
          limit: '250',
          status: 'any',
          ...(sinceId && !force ? { since_id: sinceId } : {}),
        };

    // Fetch page with rate limiting
    const response = await rateLimitedRequest(
      () => client.get({ path: 'orders', query }),
      {
        maxRetries: 5,
        onRetry: (attempt, error, backoffMs) => {
          console.log(
            `Order fetch retry ${attempt}/5 for ${shop}, waiting ${Math.round(backoffMs / 1000)}s...`
          );
        },
      }
    );

    const orders = (response.body as any).orders as CachedOrder[];

    if (orders.length > 0) {
      // Store orders immediately (crash-safe)
      const stored = upsertOrders(shop, orders);
      totalSynced += stored;

      console.log(`Synced ${stored} orders for ${shop}, total: ${totalSynced}`);
    }

    // Parse Link header for pagination
    const headers = response.headers as Record<string, string | string[] | undefined>;
    const linkHeader = headers?.link || headers?.Link;
    const linkStr = Array.isArray(linkHeader) ? linkHeader[0] : linkHeader;

    if (linkStr && linkStr.includes('rel="next"')) {
      const nextMatch =
        linkStr.match(/<[^>]*page_info=([^&>]+)[^>]*>;\s*rel="next"/) ||
        linkStr.match(/page_info=([^&>;]+).*rel="next"/);
      if (nextMatch) {
        pageInfo = nextMatch[1];
        // Save progress for crash recovery
        updateSyncStatus(shop, {
          syncedOrders: totalSynced,
          nextPageInfo: pageInfo,
        });
      } else {
        hasNextPage = false;
      }
    } else {
      hasNextPage = false;
    }

    // Broadcast progress event
    broadcastSyncEvent(shop, {
      type: 'progress',
      shop,
      synced: totalSynced,
      total: null, // Shopify doesn't provide total count upfront
    });

    // Update status in database
    updateSyncStatus(shop, {
      syncedOrders: totalSynced,
    });
  }

  // Sync completed
  const finalCount = getOrderCount(shop);
  const latestOrderId = getLatestOrderId(shop);

  updateSyncStatus(shop, {
    status: 'completed',
    syncedOrders: finalCount,
    totalOrders: finalCount,
    lastOrderId: latestOrderId,
    lastSyncAt: new Date().toISOString(),
    nextPageInfo: null,
    errorMessage: null,
  });

  broadcastSyncEvent(shop, {
    type: 'complete',
    shop,
    synced: finalCount,
    total: finalCount,
    message: `Sync completed. ${finalCount} orders total.`,
  });

  console.log(`Order sync completed for ${shop}. Total orders: ${finalCount}`);
}

/**
 * Get sync status with additional computed fields
 */
export function getFullSyncStatus(shop: string) {
  const status = getSyncStatus(shop);
  const orderCount = getOrderCount(shop);

  return {
    ...status,
    cachedOrderCount: orderCount,
    syncRequired: orderCount === 0 && status.status !== 'syncing',
  };
}

export default {
  startOrderSync,
  cancelSync,
  subscribeSyncEvents,
  unsubscribeSyncEvents,
  isSyncInProgress,
  getFullSyncStatus,
};
