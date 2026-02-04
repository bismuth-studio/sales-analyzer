import PQueue from 'p-queue';

// Shopify REST API limits: 2 requests/second (bucket of 40)
// We use 1.8 req/sec to stay safely under the limit
const REQUESTS_PER_SECOND = 1.8;
const INTERVAL_MS = 1000;
const CONCURRENCY = 2;

// Retry configuration
const MAX_RETRIES = 5;
const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30000;

// Create a shared queue for Shopify REST API requests
const shopifyQueue = new PQueue({
  concurrency: CONCURRENCY,
  interval: INTERVAL_MS,
  intervalCap: Math.floor(REQUESTS_PER_SECOND),
});

interface RetryableError extends Error {
  response?: {
    code?: number;
    statusCode?: number;
    headers?: Record<string, string>;
  };
  code?: number;
}

/**
 * Calculate backoff time with exponential increase and jitter
 */
function calculateBackoff(attempt: number, retryAfter?: number): number {
  if (retryAfter) {
    // Use Retry-After header if provided (in seconds)
    return retryAfter * 1000;
  }
  // Exponential backoff with jitter
  const exponentialDelay = Math.min(
    INITIAL_BACKOFF_MS * Math.pow(2, attempt),
    MAX_BACKOFF_MS
  );
  const jitter = Math.random() * 0.3 * exponentialDelay;
  return exponentialDelay + jitter;
}

/**
 * Check if an error is a rate limit (429) error
 */
function isRateLimitError(error: RetryableError): boolean {
  const statusCode = error.response?.code || error.response?.statusCode || error.code;
  return statusCode === 429;
}

/**
 * Check if an error is retryable (429, 500, 502, 503, 504)
 */
function isRetryableError(error: RetryableError): boolean {
  const statusCode = error.response?.code || error.response?.statusCode || error.code;
  return statusCode === 429 ||
         statusCode === 500 ||
         statusCode === 502 ||
         statusCode === 503 ||
         statusCode === 504;
}

/**
 * Extract Retry-After header value if present
 */
function getRetryAfter(error: RetryableError): number | undefined {
  const retryAfter = error.response?.headers?.['retry-after'];
  if (retryAfter) {
    const parsed = parseInt(retryAfter, 10);
    return isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute a Shopify API request with rate limiting and automatic retry
 */
export async function rateLimitedRequest<T>(
  requestFn: () => Promise<T>,
  options: {
    maxRetries?: number;
    onRetry?: (attempt: number, error: Error, backoffMs: number) => void;
  } = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? MAX_RETRIES;

  return shopifyQueue.add(async () => {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await requestFn();
      } catch (error) {
        lastError = error as Error;
        const retryableError = error as RetryableError;

        // Check if we should retry
        if (attempt < maxRetries && isRetryableError(retryableError)) {
          const retryAfter = isRateLimitError(retryableError)
            ? getRetryAfter(retryableError)
            : undefined;
          const backoffMs = calculateBackoff(attempt, retryAfter);

          if (options.onRetry) {
            options.onRetry(attempt + 1, lastError, backoffMs);
          } else {
            console.log(
              `Shopify API request failed (attempt ${attempt + 1}/${maxRetries + 1}), ` +
              `retrying in ${Math.round(backoffMs / 1000)}s...`
            );
          }

          await sleep(backoffMs);
          continue;
        }

        // Non-retryable error or max retries exceeded
        throw error;
      }
    }

    // Should never reach here, but TypeScript needs this
    throw lastError;
  }) as Promise<T>;
}

/**
 * Execute multiple Shopify API requests with rate limiting
 * Returns results in the same order as inputs, with null for failed requests
 */
export async function rateLimitedBatch<T, R>(
  items: T[],
  requestFn: (item: T) => Promise<R>,
  options: {
    maxRetries?: number;
    onProgress?: (completed: number, total: number) => void;
    onError?: (item: T, error: Error) => void;
  } = {}
): Promise<(R | null)[]> {
  let completed = 0;
  const total = items.length;

  const promises = items.map(async (item) => {
    try {
      const result = await rateLimitedRequest(() => requestFn(item), {
        maxRetries: options.maxRetries,
      });
      completed++;
      if (options.onProgress) {
        options.onProgress(completed, total);
      }
      return result;
    } catch (error) {
      completed++;
      if (options.onProgress) {
        options.onProgress(completed, total);
      }
      if (options.onError) {
        options.onError(item, error as Error);
      }
      return null;
    }
  });

  return Promise.all(promises);
}

/**
 * Get current queue statistics
 */
export function getQueueStats() {
  return {
    pending: shopifyQueue.pending,
    size: shopifyQueue.size,
  };
}

/**
 * Clear all pending requests from the queue
 */
export function clearQueue() {
  shopifyQueue.clear();
}

export default {
  rateLimitedRequest,
  rateLimitedBatch,
  getQueueStats,
  clearQueue,
};
