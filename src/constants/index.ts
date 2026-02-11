/**
 * Constants barrel export
 * Centralized constants for business logic, scoring, and configuration
 *
 * Example usage:
 *   import { VELOCITY_THRESHOLDS, STAR_PERFORMER_CRITERIA } from '../constants';
 */

// Drop performance scoring constants
export {
  MAX_SCORES,
  VELOCITY_THRESHOLDS,
  VELOCITY_SCORES,
  VELOCITY_BONUS,
  REVENUE_THRESHOLDS,
  REVENUE_SUB_SCORES,
  ENGAGEMENT_THRESHOLDS,
  DIVERSITY_THRESHOLDS,
  GRADE_THRESHOLDS,
  GRADE_LABELS,
} from './scoring';

// Product ranking constants
export {
  STAR_PERFORMER_CRITERIA,
  REVENUE_CHAMPION_CRITERIA,
  SLEEPER_HIT_CRITERIA,
  SLOW_MOVER_CRITERIA,
  DUD_CRITERIA,
  PRODUCT_THRESHOLDS,
  SEGMENT_THRESHOLDS,
} from './ranking';

// Timeout and duration constants
export {
  DATABASE_TIMEOUTS,
  WORKER_POOL_CONFIG,
  API_TIMEOUTS,
  RETRY_DELAYS,
} from './timeouts';
