/**
 * Order sync status type definitions
 * Tracks the status of order synchronization from Shopify
 */

/**
 * Order sync status information
 */
export interface SyncStatus {
  status: 'idle' | 'syncing' | 'completed' | 'error';
  syncedOrders: number;
  totalOrders: number | null;
  lastSyncAt: string | null;
  syncRequired: boolean;
}
