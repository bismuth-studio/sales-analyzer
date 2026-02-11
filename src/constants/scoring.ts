/**
 * Drop Performance Scoring Constants
 *
 * These constants define the thresholds and weights used in calculating
 * drop performance scores. Adjust these values to tune the scoring algorithm.
 */

/**
 * Maximum scores for each component (total = 100 points)
 */
export const MAX_SCORES = {
  /** Sales velocity score (how quickly products sold out) */
  VELOCITY: 25,

  /** Sell-through rate score (percentage of inventory sold) */
  SELL_THROUGH: 25,

  /** Revenue performance score (total revenue and AOV) */
  REVENUE: 20,

  /** Customer engagement score (new vs returning customers) */
  ENGAGEMENT: 15,

  /** Product diversity score (variety of products sold) */
  DIVERSITY: 10,

  /** Time efficiency score (sales concentration over time) */
  TIME_EFFICIENCY: 5,
} as const;

/**
 * Velocity ratio thresholds (time to sellout / total drop duration)
 * Lower ratios = faster sellout = better score
 */
export const VELOCITY_THRESHOLDS = {
  /** Ultra-fast sellout: less than 10% of drop duration */
  ULTRA_FAST: 0.1,
  /** Very fast sellout: less than 25% of drop duration */
  VERY_FAST: 0.25,
  /** Fast sellout: less than 50% of drop duration */
  FAST: 0.5,
  /** Moderate sellout: less than 75% of drop duration */
  MODERATE: 0.75,
  // Anything >= 75% is considered "slow"
} as const;

/**
 * Base scores awarded for velocity performance
 */
export const VELOCITY_SCORES = {
  /** Score for ultra-fast sellout (< 10% of duration) */
  ULTRA_FAST: 25,
  /** Score for very fast sellout (< 25% of duration) */
  VERY_FAST: 23,
  /** Score for fast sellout (< 50% of duration) */
  FAST: 20,
  /** Score for moderate sellout (< 75% of duration) */
  MODERATE: 15,
  /** Score for slow sellout (>= 75% of duration) */
  SLOW: 10,
} as const;

/**
 * Bonus points for sellout percentage
 */
export const VELOCITY_BONUS = {
  /** Maximum bonus points for sellout percentage */
  MAX_BONUS: 5,
} as const;

/**
 * Revenue performance thresholds
 */
export const REVENUE_THRESHOLDS = {
  /** Threshold for minimum revenue to be considered in analysis */
  MIN_REVENUE: 100,

  /** Excellent revenue threshold */
  EXCELLENT: 10000,
  /** Good revenue threshold */
  GOOD: 5000,
  /** Moderate revenue threshold */
  MODERATE: 2000,
  /** Poor revenue threshold */
  POOR: 500,

  /** Excellent average order value */
  EXCELLENT_AOV: 150,
  /** Good average order value */
  GOOD_AOV: 100,
  /** Moderate average order value */
  MODERATE_AOV: 60,
  /** Poor average order value */
  POOR_AOV: 30,
} as const;

/**
 * Revenue sub-component maximum scores
 */
export const REVENUE_SUB_SCORES = {
  /** Maximum points for revenue magnitude */
  MAGNITUDE: 10,
  /** Maximum points for average order value */
  AOV: 10,
} as const;

/**
 * Customer engagement thresholds
 */
export const ENGAGEMENT_THRESHOLDS = {
  /** Excellent new customer percentage */
  EXCELLENT_NEW_CUSTOMERS: 0.7,  // 70%+
  /** Good new customer percentage */
  GOOD_NEW_CUSTOMERS: 0.5,       // 50-69%
  /** Moderate new customer percentage */
  MODERATE_NEW_CUSTOMERS: 0.3,   // 30-49%
  // Below 30% is considered poor
} as const;

/**
 * Product diversity thresholds
 */
export const DIVERSITY_THRESHOLDS = {
  /** Excellent product count */
  EXCELLENT: 10,
  /** Good product count */
  GOOD: 7,
  /** Moderate product count */
  MODERATE: 5,
  /** Poor product count (minimum) */
  POOR: 3,
} as const;

/**
 * Grade thresholds and labels
 */
export const GRADE_THRESHOLDS = {
  S_TIER: 95,      // Elite Drop: 95-100
  A_PLUS: 90,      // Excellent+: 90-94.9
  A_TIER: 85,      // Excellent: 85-89.9
  B_PLUS: 80,      // Very Good+: 80-84.9
  B_TIER: 70,      // Very Good: 70-79.9
  C_PLUS: 60,      // Good+: 60-69.9
  C_TIER: 50,      // Good: 50-59.9
  D_TIER: 40,      // Fair: 40-49.9
  // Below 40 is F (Poor)
} as const;

export const GRADE_LABELS = {
  S: 'Elite Drop',
  A_PLUS: 'Excellent+',
  A: 'Excellent',
  B_PLUS: 'Very Good+',
  B: 'Very Good',
  C_PLUS: 'Good+',
  C: 'Good',
  D: 'Fair',
  F: 'Poor',
} as const;
