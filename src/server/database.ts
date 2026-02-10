/**
 * Database Module
 *
 * This module re-exports the async database interface which uses worker threads
 * to prevent blocking the Node.js event loop during SQLite operations.
 *
 * All database operations are now async and should be awaited.
 */

export {
  getDropsByShop,
  getDropById,
  createDrop,
  updateDrop,
  deleteDrop,
  updateDropInventory,
  updateDropOriginalSnapshot,
  updateDropMetrics,
  runDatabaseOperation,
  getPoolStats,
  shutdown,
} from './databaseAsync';

export type {
  Drop,
  CreateDropInput,
  UpdateDropInput,
  UpdateInventoryInput,
  DropMetrics,
} from './databaseAsync';
