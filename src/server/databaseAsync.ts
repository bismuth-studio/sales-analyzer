/**
 * Async Database Interface
 *
 * Provides a promise-based interface to the database worker.
 * All operations are executed in a worker thread to avoid blocking the event loop.
 */

import Piscina from 'piscina';
import path from 'path';
import type {
  Drop,
  CreateDropInput,
  UpdateDropInput,
  UpdateInventoryInput,
  DatabaseOperation,
} from './databaseWorker';

// Re-export types for consumers
export type { Drop, CreateDropInput, UpdateDropInput, UpdateInventoryInput };

// Query timeout (5 seconds max for reads, 10 seconds for writes)
const READ_TIMEOUT = 5000;
const WRITE_TIMEOUT = 10000;

// Initialize worker pool
// Determine the worker file path based on whether we're running compiled JS or TS
function getWorkerFilename(): string {
  // Check if we're running from compiled JS
  const isCompiled = __filename.endsWith('.js');

  if (isCompiled) {
    // Production: use compiled worker
    return path.join(__dirname, 'databaseWorker.js');
  }

  // Development: use the CJS loader that bootstraps tsx
  return path.join(__dirname, 'databaseWorkerLoader.js');
}

const pool = new Piscina({
  filename: getWorkerFilename(),
  // Use a small pool since SQLite is single-writer anyway
  // Multiple workers would just queue on SQLite's lock
  minThreads: 1,
  maxThreads: 2,
  idleTimeout: 60000, // Keep worker alive for 60s when idle
});

// Helper to run operations with timeout
async function runOperation<T>(operation: DatabaseOperation, timeout: number): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const result = await pool.run(operation, { signal: controller.signal });
    return result as T;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Get all drops for a shop
 */
export async function getDropsByShop(shop: string): Promise<Drop[]> {
  return runOperation<Drop[]>({ type: 'getDropsByShop', shop }, READ_TIMEOUT);
}

/**
 * Get a single drop by ID
 */
export async function getDropById(id: string): Promise<Drop | undefined> {
  return runOperation<Drop | undefined>({ type: 'getDropById', id }, READ_TIMEOUT);
}

/**
 * Create a new drop
 */
export async function createDrop(input: CreateDropInput): Promise<Drop> {
  return runOperation<Drop>({ type: 'createDrop', input }, WRITE_TIMEOUT);
}

/**
 * Update a drop
 */
export async function updateDrop(id: string, input: UpdateDropInput): Promise<Drop | undefined> {
  return runOperation<Drop | undefined>({ type: 'updateDrop', id, input }, WRITE_TIMEOUT);
}

/**
 * Delete a drop
 */
export async function deleteDrop(id: string): Promise<boolean> {
  return runOperation<boolean>({ type: 'deleteDrop', id }, WRITE_TIMEOUT);
}

/**
 * Update drop inventory snapshot
 */
export async function updateDropInventory(
  id: string,
  input: UpdateInventoryInput
): Promise<Drop | undefined> {
  return runOperation<Drop | undefined>(
    { type: 'updateDropInventory', id, input },
    WRITE_TIMEOUT
  );
}

/**
 * Update original inventory snapshot (for reset functionality)
 */
export async function updateDropOriginalSnapshot(id: string, snapshot: string): Promise<void> {
  await runOperation<void>(
    { type: 'updateDropOriginalSnapshot', id, snapshot },
    WRITE_TIMEOUT
  );
}

/**
 * Get worker pool statistics (for monitoring)
 */
export function getPoolStats() {
  return {
    completed: pool.completed,
    queueSize: pool.queueSize,
  };
}

/**
 * Gracefully shutdown the worker pool
 */
export async function shutdown(): Promise<void> {
  await pool.close();
}

export default {
  getDropsByShop,
  getDropById,
  createDrop,
  updateDrop,
  deleteDrop,
  updateDropInventory,
  updateDropOriginalSnapshot,
  getPoolStats,
  shutdown,
};
