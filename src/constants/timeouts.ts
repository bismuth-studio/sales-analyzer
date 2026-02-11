/**
 * Timeout and Duration Constants
 *
 * Centralized timeout values for database operations, API calls,
 * and other async operations.
 */

/**
 * Database operation timeouts (milliseconds)
 */
export const DATABASE_TIMEOUTS = {
  /** Timeout for read operations (5 seconds) */
  READ: 5000,

  /** Timeout for write operations (10 seconds) */
  WRITE: 10000,

  /** Worker pool idle timeout - keep worker alive when idle (60 seconds) */
  WORKER_IDLE: 60000,
} as const;

/**
 * Worker pool configuration
 */
export const WORKER_POOL_CONFIG = {
  /** Minimum number of worker threads */
  MIN_THREADS: 1,

  /** Maximum number of worker threads (SQLite is single-writer, more doesn't help) */
  MAX_THREADS: 2,
} as const;

/**
 * API request timeouts (milliseconds)
 */
export const API_TIMEOUTS = {
  /** Default timeout for API requests */
  DEFAULT: 30000,  // 30 seconds

  /** Timeout for long-running operations (like bulk syncs) */
  LONG_RUNNING: 120000,  // 2 minutes

  /** Timeout for quick health checks */
  HEALTH_CHECK: 5000,  // 5 seconds
} as const;

/**
 * Retry delays (milliseconds)
 */
export const RETRY_DELAYS = {
  /** Short delay between retries */
  SHORT: 1000,   // 1 second

  /** Medium delay between retries */
  MEDIUM: 3000,  // 3 seconds

  /** Long delay between retries */
  LONG: 5000,    // 5 seconds
} as const;
