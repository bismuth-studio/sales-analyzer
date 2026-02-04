// Drop Performance Score Calculation Utilities
// Calculates a comprehensive 0-100 score for drop performance

// ============================================================================
// Type Definitions
// ============================================================================

export interface DropPerformanceScore {
  overall: number;           // 0-100
  grade: string;             // 'S', 'A+', 'A', 'B+', 'B', 'C+', 'C', 'D', 'F'
  gradeDescription: string;  // 'Elite Drop', 'Excellent', etc.
  components: {
    salesVelocity: ComponentScore;
    sellThroughRate: ComponentScore;
    revenuePerformance: ComponentScore;
    customerEngagement: ComponentScore;
    productDiversity: ComponentScore;
    timeEfficiency: ComponentScore;
  };
  insights: Insight[];
  calculatedAt: string;
}

export interface ComponentScore {
  score: number;        // Points earned
  maxScore: number;     // Maximum possible points
  percentage: number;   // 0-100%
  label: string;        // Human-readable name
  description?: string; // Optional explanation
}

export interface Insight {
  type: 'success' | 'warning' | 'critical';
  message: string;
  priority: number; // 1-5, for sorting (5 = highest)
}

export interface ScoreCalculationInput {
  productSummary: ProductSummary[];
  orders: Order[];
  dropStartTime: string;
  dropEndTime: string;
  netSales: number;
  avgOrderValue: number;
  totalOrders: number;
  newCustomers: number;
  returningCustomers: number;
  uniqueCustomers: number;
}

interface ProductSummary {
  unitsSold: number;
  remainingInventory: number;
  totalRevenue: number;
  sellThroughRate: number;
  revenuePercentage: number;
  soldOutAt?: string;
}

interface Order {
  created_at: string;
  [key: string]: any;
}

// ============================================================================
// Main Calculation Function
// ============================================================================

export function calculateDropPerformanceScore(
  input: ScoreCalculationInput
): DropPerformanceScore {
  // Validate input
  if (!input.dropStartTime || !input.dropEndTime) {
    throw new Error('Drop start and end times are required for score calculation');
  }

  // Calculate component scores
  const velocityScore = calculateVelocityScore(
    input.productSummary,
    input.dropStartTime,
    input.dropEndTime
  );

  const sellThroughScore = calculateSellThroughScore(
    input.productSummary
  );

  const revenueScore = calculateRevenueScore(
    input.netSales,
    input.avgOrderValue,
    input.totalOrders
  );

  const engagementScore = calculateEngagementScore(
    input.newCustomers,
    input.returningCustomers,
    input.uniqueCustomers
  );

  const diversityScore = calculateDiversityScore(
    input.productSummary
  );

  const timeScore = calculateTimeEfficiencyScore(
    input.orders,
    input.dropStartTime,
    input.dropEndTime
  );

  // Calculate overall score
  const overall =
    velocityScore.score +
    sellThroughScore.score +
    revenueScore.score +
    engagementScore.score +
    diversityScore.score +
    timeScore.score;

  // Determine grade
  const { grade, description } = determineGrade(overall);

  // Generate insights
  const insights = generateInsights({
    velocityScore,
    sellThroughScore,
    revenueScore,
    engagementScore,
    diversityScore,
    timeScore,
  }, input);

  return {
    overall: Math.round(overall * 10) / 10, // Round to 1 decimal
    grade,
    gradeDescription: description,
    components: {
      salesVelocity: velocityScore,
      sellThroughRate: sellThroughScore,
      revenuePerformance: revenueScore,
      customerEngagement: engagementScore,
      productDiversity: diversityScore,
      timeEfficiency: timeScore,
    },
    insights: insights.sort((a, b) => b.priority - a.priority),
    calculatedAt: new Date().toISOString(),
  };
}

// ============================================================================
// Component Score Calculations
// ============================================================================

/**
 * Sales Velocity Score (25 points)
 * Measures how quickly products sold out
 */
function calculateVelocityScore(
  productSummary: ProductSummary[],
  dropStartTime: string,
  dropEndTime: string
): ComponentScore {
  const maxScore = 25;

  if (productSummary.length === 0) {
    return {
      score: 0,
      maxScore,
      percentage: 0,
      label: 'Sales Velocity',
      description: 'No products to analyze',
    };
  }

  const soldOutProducts = productSummary.filter(p => p.soldOutAt);

  // If no sellouts, score based on average sell-through
  if (soldOutProducts.length === 0) {
    const avgSellThrough = productSummary.reduce((sum, p) =>
      sum + p.sellThroughRate, 0) / productSummary.length;
    const score = (avgSellThrough / 100) * maxScore;

    return {
      score,
      maxScore,
      percentage: (score / maxScore) * 100,
      label: 'Sales Velocity',
      description: 'No products sold out',
    };
  }

  // Calculate average time to sell out
  const dropStart = new Date(dropStartTime).getTime();
  const dropEnd = new Date(dropEndTime).getTime();
  const dropDuration = dropEnd - dropStart;

  const avgTimeToSellout = soldOutProducts.reduce((sum, p) => {
    const soldOutTime = new Date(p.soldOutAt!).getTime();
    const duration = soldOutTime - dropStart;
    return sum + duration;
  }, 0) / soldOutProducts.length;

  const velocityRatio = avgTimeToSellout / dropDuration;

  // Scoring curve based on how fast products sold out
  let baseScore = 25;
  if (velocityRatio < 0.1) baseScore = 25;      // Ultra-fast: < 10% of duration
  else if (velocityRatio < 0.25) baseScore = 23; // Very fast: < 25% of duration
  else if (velocityRatio < 0.5) baseScore = 20;  // Fast: < 50% of duration
  else if (velocityRatio < 0.75) baseScore = 15; // Moderate: < 75% of duration
  else baseScore = 10;                            // Slow: >= 75% of duration

  // Bonus: More products sold out = better
  const selloutPercentage = soldOutProducts.length / productSummary.length;
  const bonus = selloutPercentage * 5; // Up to 5 bonus points

  const finalScore = Math.min(maxScore, baseScore + bonus);

  return {
    score: finalScore,
    maxScore,
    percentage: (finalScore / maxScore) * 100,
    label: 'Sales Velocity',
    description: `${soldOutProducts.length} of ${productSummary.length} products sold out`,
  };
}

/**
 * Sell-Through Rate Score (25 points)
 * Measures percentage of inventory sold
 */
function calculateSellThroughScore(
  productSummary: ProductSummary[]
): ComponentScore {
  const maxScore = 25;

  if (productSummary.length === 0) {
    return {
      score: 0,
      maxScore,
      percentage: 0,
      label: 'Sell-Through Rate',
      description: 'No products to analyze',
    };
  }

  // Calculate revenue-weighted sell-through rate
  const weightedSellThrough = productSummary.reduce((sum, p) => {
    const sellThroughRate = p.sellThroughRate / 100; // Convert to 0-1
    const revenueWeight = p.revenuePercentage / 100; // Weight by revenue contribution
    return sum + (sellThroughRate * revenueWeight);
  }, 0);

  // Convert to 0-25 scale
  const score = weightedSellThrough * maxScore;

  const avgSellThrough = productSummary.reduce((sum, p) =>
    sum + p.sellThroughRate, 0) / productSummary.length;

  return {
    score,
    maxScore,
    percentage: (score / maxScore) * 100,
    label: 'Sell-Through Rate',
    description: `${Math.round(avgSellThrough)}% average sell-through`,
  };
}

/**
 * Revenue Performance Score (20 points)
 * Measures total revenue and average order value
 */
function calculateRevenueScore(
  netSales: number,
  avgOrderValue: number,
  totalOrders: number
): ComponentScore {
  const maxScore = 20;

  if (totalOrders === 0) {
    return {
      score: 0,
      maxScore,
      percentage: 0,
      label: 'Revenue Performance',
      description: 'No orders',
    };
  }

  // Sub-component 1: Total revenue magnitude (10 points)
  let revenueMagnitudeScore = 0;
  if (netSales >= 10000) revenueMagnitudeScore = 10;
  else if (netSales >= 5000) revenueMagnitudeScore = 8;
  else if (netSales >= 2500) revenueMagnitudeScore = 6;
  else if (netSales >= 1000) revenueMagnitudeScore = 4;
  else revenueMagnitudeScore = Math.min(4, (netSales / 1000) * 4);

  // Sub-component 2: AOV quality (10 points)
  let aovScore = 0;
  if (avgOrderValue >= 150) aovScore = 10;
  else if (avgOrderValue >= 100) aovScore = 8;
  else if (avgOrderValue >= 75) aovScore = 6;
  else if (avgOrderValue >= 50) aovScore = 4;
  else aovScore = Math.min(4, (avgOrderValue / 50) * 4);

  const finalScore = Math.min(maxScore, revenueMagnitudeScore + aovScore);

  return {
    score: finalScore,
    maxScore,
    percentage: (finalScore / maxScore) * 100,
    label: 'Revenue Performance',
    description: `$${Math.round(netSales).toLocaleString()} revenue, $${Math.round(avgOrderValue)} AOV`,
  };
}

/**
 * Customer Engagement Score (15 points)
 * Measures new vs returning customer mix
 */
function calculateEngagementScore(
  newCustomers: number,
  returningCustomers: number,
  uniqueCustomers: number
): ComponentScore {
  const maxScore = 15;

  if (uniqueCustomers === 0) {
    return {
      score: 0,
      maxScore,
      percentage: 0,
      label: 'Customer Engagement',
      description: 'No customers',
    };
  }

  // Sub-component 1: New customer acquisition (8 points)
  const newCustomerRatio = newCustomers / uniqueCustomers;
  const acquisitionScore = newCustomerRatio * 8;

  // Sub-component 2: Returning customer loyalty (7 points)
  const returningRatio = returningCustomers / uniqueCustomers;
  const loyaltyScore = returningRatio * 7;

  const finalScore = acquisitionScore + loyaltyScore;

  return {
    score: finalScore,
    maxScore,
    percentage: (finalScore / maxScore) * 100,
    label: 'Customer Engagement',
    description: `${Math.round(newCustomerRatio * 100)}% new, ${Math.round(returningRatio * 100)}% returning`,
  };
}

/**
 * Product Diversity Score (10 points)
 * Measures sales distribution across products
 */
function calculateDiversityScore(
  productSummary: ProductSummary[]
): ComponentScore {
  const maxScore = 10;

  if (productSummary.length === 0) {
    return {
      score: 0,
      maxScore,
      percentage: 0,
      label: 'Product Diversity',
      description: 'No products to analyze',
    };
  }

  // Calculate Herfindahl-Hirschman Index (HHI) for revenue concentration
  // HHI = Sum of squared market shares
  // HHI close to 0 = perfect diversity, HHI close to 1 = monopoly
  const hhi = productSummary.reduce((sum, p) => {
    const marketShare = p.revenuePercentage / 100;
    return sum + (marketShare * marketShare);
  }, 0);

  // Convert HHI to score
  let score = 10;
  if (hhi < 0.15) score = 10;      // Highly diverse
  else if (hhi < 0.25) score = 8;   // Moderate diversity
  else if (hhi < 0.40) score = 6;   // Some concentration
  else if (hhi < 0.60) score = 4;   // High concentration
  else score = 2;                    // Very concentrated

  return {
    score,
    maxScore,
    percentage: (score / maxScore) * 100,
    label: 'Product Diversity',
    description: `HHI: ${hhi.toFixed(3)} (${hhi < 0.25 ? 'diverse' : hhi < 0.5 ? 'moderate' : 'concentrated'})`,
  };
}

/**
 * Time Efficiency Score (5 points)
 * Measures when during the drop period sales occurred
 */
function calculateTimeEfficiencyScore(
  orders: Order[],
  dropStartTime: string,
  dropEndTime: string
): ComponentScore {
  const maxScore = 5;

  if (orders.length === 0) {
    return {
      score: 0,
      maxScore,
      percentage: 0,
      label: 'Time Efficiency',
      description: 'No orders',
    };
  }

  const dropStart = new Date(dropStartTime).getTime();
  const dropEnd = new Date(dropEndTime).getTime();
  const dropDuration = dropEnd - dropStart;

  // Calculate when orders occurred (as % of drop duration)
  const orderTimings = orders
    .map(o => {
      const orderTime = new Date(o.created_at).getTime();
      return (orderTime - dropStart) / dropDuration;
    })
    .filter(t => t >= 0 && t <= 1); // Only orders within drop window

  if (orderTimings.length === 0) {
    return {
      score: 0,
      maxScore,
      percentage: 0,
      label: 'Time Efficiency',
      description: 'No orders within drop window',
    };
  }

  // Calculate median order timing
  const sortedTimings = orderTimings.sort((a, b) => a - b);
  const medianTiming = sortedTimings[Math.floor(sortedTimings.length / 2)];

  // Score based on how front-loaded sales are
  let score = 5;
  if (medianTiming < 0.2) score = 5;      // Early rush (< 20% of duration)
  else if (medianTiming < 0.4) score = 4;  // Moderately early
  else if (medianTiming < 0.6) score = 3;  // Steady throughout
  else if (medianTiming < 0.8) score = 2;  // Late surge
  else score = 1;                          // Very late

  return {
    score,
    maxScore,
    percentage: (score / maxScore) * 100,
    label: 'Time Efficiency',
    description: `Median sale at ${Math.round(medianTiming * 100)}% of drop duration`,
  };
}

// ============================================================================
// Grade Determination
// ============================================================================

function determineGrade(score: number): { grade: string; description: string } {
  if (score >= 95) return { grade: 'S', description: 'Elite Drop' };
  if (score >= 90) return { grade: 'A+', description: 'Exceptional' };
  if (score >= 85) return { grade: 'A', description: 'Excellent' };
  if (score >= 80) return { grade: 'B+', description: 'Very Good' };
  if (score >= 75) return { grade: 'B', description: 'Good' };
  if (score >= 70) return { grade: 'C+', description: 'Above Average' };
  if (score >= 65) return { grade: 'C', description: 'Average' };
  if (score >= 50) return { grade: 'D', description: 'Below Average' };
  return { grade: 'F', description: 'Poor' };
}

// ============================================================================
// Insight Generation
// ============================================================================

function generateInsights(
  components: {
    velocityScore: ComponentScore;
    sellThroughScore: ComponentScore;
    revenueScore: ComponentScore;
    engagementScore: ComponentScore;
    diversityScore: ComponentScore;
    timeScore: ComponentScore;
  },
  input: ScoreCalculationInput
): Insight[] {
  const insights: Insight[] = [];

  // Sales Velocity Insights
  if (components.velocityScore.score >= 23) {
    insights.push({
      type: 'success',
      message: 'Outstanding sales velocity - products moved quickly!',
      priority: 5,
    });
  } else if (components.velocityScore.score < 10) {
    insights.push({
      type: 'critical',
      message: 'Slow sales velocity. Review product-market fit and pricing strategy.',
      priority: 5,
    });
  } else if (components.velocityScore.score < 15) {
    insights.push({
      type: 'warning',
      message: 'Moderate sales velocity. Consider improving marketing reach or product positioning.',
      priority: 3,
    });
  }

  // Sell-Through Rate Insights
  if (components.sellThroughScore.score >= 23) {
    insights.push({
      type: 'success',
      message: 'Excellent sell-through rate! Inventory planning was spot-on.',
      priority: 4,
    });
  } else if (components.sellThroughScore.score < 15) {
    insights.push({
      type: 'warning',
      message: 'Sell-through rate below target. Consider reducing initial inventory or extending drop duration.',
      priority: 4,
    });
  } else if (components.sellThroughScore.score < 10) {
    insights.push({
      type: 'critical',
      message: 'Low sell-through rate indicates overstock. Significantly reduce inventory for future drops.',
      priority: 5,
    });
  }

  // Revenue Performance Insights
  if (components.revenueScore.score >= 18) {
    insights.push({
      type: 'success',
      message: 'Strong revenue performance with healthy order values!',
      priority: 4,
    });
  } else if (components.revenueScore.score < 10) {
    insights.push({
      type: 'critical',
      message: 'Low revenue achievement. Analyze pricing strategy and marketing effectiveness.',
      priority: 5,
    });
  } else if (components.revenueScore.score < 14) {
    insights.push({
      type: 'warning',
      message: 'Revenue below expectations. Consider bundle offers or optimizing AOV.',
      priority: 3,
    });
  }

  // Customer Engagement Insights
  const newCustomerRatio = input.uniqueCustomers > 0
    ? input.newCustomers / input.uniqueCustomers
    : 0;

  if (components.engagementScore.score >= 12) {
    insights.push({
      type: 'success',
      message: 'Great customer mix with strong acquisition and retention!',
      priority: 3,
    });
  } else if (components.engagementScore.score < 5) {
    insights.push({
      type: 'critical',
      message: 'Very low customer engagement. Review marketing channels and customer targeting.',
      priority: 5,
    });
  } else if (newCustomerRatio < 0.3) {
    insights.push({
      type: 'warning',
      message: 'Low new customer acquisition. Expand marketing reach to attract new buyers.',
      priority: 3,
    });
  } else if (newCustomerRatio > 0.9) {
    insights.push({
      type: 'warning',
      message: 'Few returning customers. Focus on retention strategies and customer loyalty.',
      priority: 3,
    });
  }

  // Product Diversity Insights
  if (components.diversityScore.score >= 8) {
    insights.push({
      type: 'success',
      message: 'Well-balanced product mix with diverse sales distribution.',
      priority: 2,
    });
  } else if (components.diversityScore.score < 4) {
    insights.push({
      type: 'warning',
      message: 'Sales heavily concentrated in few products. Diversify product offerings or adjust inventory mix.',
      priority: 3,
    });
  }

  // Time Efficiency Insights
  if (components.timeScore.score >= 4) {
    insights.push({
      type: 'success',
      message: 'Strong early momentum - sales were front-loaded as expected for a drop!',
      priority: 2,
    });
  } else if (components.timeScore.score <= 2) {
    insights.push({
      type: 'warning',
      message: 'Sales occurred late in the drop period. Consider timing, marketing schedule, or creating urgency.',
      priority: 2,
    });
  }

  // Overall Performance Insights
  const totalScore = components.velocityScore.score +
                     components.sellThroughScore.score +
                     components.revenueScore.score +
                     components.engagementScore.score +
                     components.diversityScore.score +
                     components.timeScore.score;

  if (totalScore >= 90) {
    insights.push({
      type: 'success',
      message: 'Outstanding drop performance across all metrics. This is a model to replicate!',
      priority: 5,
    });
  } else if (totalScore < 50) {
    insights.push({
      type: 'critical',
      message: 'Multiple areas need improvement. Review product selection, pricing, inventory, and marketing strategy.',
      priority: 5,
    });
  }

  return insights;
}
