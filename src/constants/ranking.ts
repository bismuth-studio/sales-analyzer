/**
 * Product Ranking Constants
 *
 * These constants define the criteria for categorizing products into
 * performance tiers (star performers, sleeper hits, slow movers, duds).
 */

/**
 * Star Performers - Products with exceptional sell-through and velocity
 */
export const STAR_PERFORMER_CRITERIA = {
  /** Minimum sell-through rate percentage */
  MIN_SELL_THROUGH: 50,

  /** Products that sold out quickly should have velocity ratio < 70% */
  MAX_VELOCITY_RATIO: 0.7,

  /** Minimum units sold to qualify */
  MIN_UNITS_SOLD: 3,

  /** Threshold for "decent" sell-through in logging */
  DECENT_SELL_THROUGH: 30,
} as const;

/**
 * Revenue Champions - Top revenue-generating products
 */
export const REVENUE_CHAMPION_CRITERIA = {
  /** Minimum revenue to be considered */
  MIN_REVENUE: 100,

  /** Minimum revenue per unit (to filter out low-value items) */
  MIN_REVENUE_PER_UNIT: 30,
} as const;

/**
 * Sleeper Hits - Products that outperform their category/vendor average
 */
export const SLEEPER_HIT_CRITERIA = {
  /** Vendor or category must have < 15% of total revenue to be "low-performing" */
  LOW_SEGMENT_REVENUE_SHARE: 15,

  /** Product must outperform segment average by at least 20% */
  MIN_OUTPERFORMANCE_RATIO: 1.2,

  /** Minimum sell-through to qualify */
  MIN_SELL_THROUGH: 30,
} as const;

/**
 * Slow Movers - Products with poor sell-through
 */
export const SLOW_MOVER_CRITERIA = {
  /** Maximum sell-through rate to be considered slow-moving */
  MAX_SELL_THROUGH: 25,

  /** Threshold for "low" sell-through in dud detection */
  LOW_SELL_THROUGH: 30,

  /** Minimum time since drop start to analyze (hours) */
  MIN_DROP_AGE_HOURS: 24,
} as const;

/**
 * Duds - Bottom performers with poor revenue and sell-through
 */
export const DUD_CRITERIA = {
  /** Maximum sell-through rate to be considered a dud */
  MAX_SELL_THROUGH: 20,

  /** Minimum revenue per unit threshold */
  MIN_REVENUE_PER_UNIT: 30,

  /** Alternative max sell-through for revenue-based filtering */
  ALTERNATIVE_MAX_SELL_THROUGH: 30,
} as const;

/**
 * General product analysis thresholds
 */
export const PRODUCT_THRESHOLDS = {
  /** Minimum revenue to include product in most analyses */
  MIN_REVENUE_FOR_ANALYSIS: 100,

  /** Excellent sell-through rate */
  EXCELLENT_SELL_THROUGH: 70,

  /** Good sell-through rate */
  GOOD_SELL_THROUGH: 50,

  /** Fair sell-through rate */
  FAIR_SELL_THROUGH: 30,

  /** Poor sell-through rate */
  POOR_SELL_THROUGH: 20,
} as const;

/**
 * Segment analysis thresholds
 */
export const SEGMENT_THRESHOLDS = {
  /** Minimum segment average to avoid division by zero */
  MIN_SEGMENT_AVERAGE: 0,

  /** Outperformance is considered significant at 20% above average */
  SIGNIFICANT_OUTPERFORMANCE: 1.2,
} as const;
