/**
 * Product ranking utility for categorizing products by performance
 */

import type {
  ProductSummary,
  AggregatedProductSummary,
  VendorSummary,
  CategorySummary,
} from '../components/orders/types';
import {
  STAR_PERFORMER_CRITERIA,
  REVENUE_CHAMPION_CRITERIA,
  SLEEPER_HIT_CRITERIA,
  SLOW_MOVER_CRITERIA,
  DUD_CRITERIA,
} from '../constants';

export interface ProductWithRankingData extends ProductSummary {
  productType?: string;
  vendor?: string;
  category?: string;
}

export interface RankedProduct extends ProductWithRankingData {
  rankingReason: string;
  rankingScore: number;
}

export interface ProductRankingCategories {
  starPerformers: RankedProduct[];
  slowMovers: RankedProduct[];
  revenueChampions: RankedProduct[];
  sleeperHits: RankedProduct[];
  duds: RankedProduct[];
}

interface SegmentAverages {
  byVendor: Map<string, number>;
  byCategory: Map<string, number>;
  byProductType: Map<string, number>;
}

/**
 * Calculate velocity ratio (time to sellout / total drop duration)
 * Returns null if product didn't sell out or data is missing
 */
function calculateVelocity(
  product: ProductSummary,
  dropStartTime: string,
  dropEndTime: string
): number | null {
  if (!product.soldOutAt) return null;

  const dropStartMs = new Date(dropStartTime).getTime();
  const dropEndMs = new Date(dropEndTime).getTime();
  const soldOutMs = new Date(product.soldOutAt).getTime();

  const dropDuration = dropEndMs - dropStartMs;
  if (dropDuration <= 0) return null;

  const timeToSellout = soldOutMs - dropStartMs;
  return timeToSellout / dropDuration;
}

/**
 * Calculate segment averages for sell-through rates
 */
function calculateSegmentAverages(
  aggregatedProducts: AggregatedProductSummary[]
): SegmentAverages {
  const byVendor = new Map<string, number>();
  const byCategory = new Map<string, number>();
  const byProductType = new Map<string, number>();

  // Group by vendor
  const vendorGroups = new Map<string, AggregatedProductSummary[]>();
  aggregatedProducts.forEach(p => {
    const vendor = p.vendor || 'Unknown';
    if (!vendorGroups.has(vendor)) vendorGroups.set(vendor, []);
    vendorGroups.get(vendor)!.push(p);
  });

  vendorGroups.forEach((products, vendor) => {
    const avgSellThrough = products.reduce((sum, p) => sum + p.sellThroughRate, 0) / products.length;
    byVendor.set(vendor, avgSellThrough);
  });

  // Group by category
  const categoryGroups = new Map<string, AggregatedProductSummary[]>();
  aggregatedProducts.forEach(p => {
    const category = p.category || 'Unknown';
    if (!categoryGroups.has(category)) categoryGroups.set(category, []);
    categoryGroups.get(category)!.push(p);
  });

  categoryGroups.forEach((products, category) => {
    const avgSellThrough = products.reduce((sum, p) => sum + p.sellThroughRate, 0) / products.length;
    byCategory.set(category, avgSellThrough);
  });

  // Group by product type
  const typeGroups = new Map<string, AggregatedProductSummary[]>();
  aggregatedProducts.forEach(p => {
    const type = p.productType || 'Unknown';
    if (!typeGroups.has(type)) typeGroups.set(type, []);
    typeGroups.get(type)!.push(p);
  });

  typeGroups.forEach((products, type) => {
    const avgSellThrough = products.reduce((sum, p) => sum + p.sellThroughRate, 0) / products.length;
    byProductType.set(type, avgSellThrough);
  });

  return { byVendor, byCategory, byProductType };
}

/**
 * Enrich product summary with aggregated product data
 */
function enrichProductData(
  productSummary: ProductSummary[],
  aggregatedProducts: AggregatedProductSummary[]
): ProductWithRankingData[] {
  return productSummary.map(product => {
    const aggregated = aggregatedProducts.find(ap => ap.productId === product.productId);
    return {
      ...product,
      productType: aggregated?.productType,
      vendor: aggregated?.vendor,
      category: aggregated?.category,
    };
  });
}

/**
 * Identify Star Performers: High velocity + high sell-through
 */
function identifyStarPerformers(
  products: ProductWithRankingData[],
  dropStartTime: string,
  dropEndTime: string
): RankedProduct[] {
  console.log('⭐ Star Performers Analysis:');
  const candidates = products.filter(p => {
    const velocity = calculateVelocity(p, dropStartTime, dropEndTime);
    // Adjusted: Lowered from 70% to 50% sell-through, more lenient velocity
    const passesVelocity = velocity !== null ? velocity < STAR_PERFORMER_CRITERIA.MAX_VELOCITY_RATIO : p.sellThroughRate > 70;
    const passes = p.sellThroughRate > STAR_PERFORMER_CRITERIA.MIN_SELL_THROUGH && passesVelocity && p.unitsSold >= STAR_PERFORMER_CRITERIA.MIN_UNITS_SOLD;

    if (p.sellThroughRate > STAR_PERFORMER_CRITERIA.DECENT_SELL_THROUGH) { // Log products with decent sell-through
      console.log(`  - ${p.productName}: sell-through=${p.sellThroughRate.toFixed(1)}%, units=${p.unitsSold}, velocity=${velocity ? velocity.toFixed(2) : 'none'}, passes=${passes}`);
    }

    return passes;
  });

  console.log(`  Found ${candidates.length} star performers (adjusted: >50% sell-through, velocity <70%)`);

  return candidates
    .map(p => {
      const velocity = calculateVelocity(p, dropStartTime, dropEndTime);
      const velocityPercent = velocity ? (velocity * 100).toFixed(0) : 'N/A';

      return {
        ...p,
        rankingReason: velocity
          ? `Sold out in ${velocityPercent}% of drop with ${p.sellThroughRate.toFixed(0)}% sell-through`
          : `${p.sellThroughRate.toFixed(0)}% sell-through (No sellout data)`,
        rankingScore: (velocity ? 100 - velocity * 100 : 0) + p.sellThroughRate,
      };
    })
    .sort((a, b) => b.rankingScore - a.rankingScore)
    .slice(0, 5);
}

/**
 * Identify Revenue Champions: Highest revenue generators
 */
function identifyRevenueChampions(
  products: ProductWithRankingData[]
): RankedProduct[] {
  const sortedByRevenue = [...products]
    .filter(p => p.totalRevenue >= 100)
    .sort((a, b) => b.totalRevenue - a.totalRevenue);

  const top20PercentCount = Math.ceil(sortedByRevenue.length * 0.2);
  const revenueChampions = sortedByRevenue.slice(0, Math.max(top20PercentCount, 5));

  return revenueChampions
    .map(p => ({
      ...p,
      rankingReason: `${p.revenuePercentage.toFixed(1)}% of total revenue with ${p.unitsSold} units sold`,
      rankingScore: p.totalRevenue,
    }))
    .slice(0, 5);
}

/**
 * Identify Sleeper Hits: Unexpected strong performers from weak segments
 */
function identifySleeperHits(
  products: ProductWithRankingData[],
  segmentAverages: SegmentAverages,
  vendorSummary: VendorSummary[],
  categorySummary: CategorySummary[]
): RankedProduct[] {
  console.log('😴 Sleeper Hits Analysis:');
  console.log(`  - Vendor revenue shares:`, vendorSummary.map(v => `${v.vendor}=${v.revenuePercentage.toFixed(1)}%`));
  console.log(`  - Category revenue shares:`, categorySummary.map(c => `${c.category}=${c.revenuePercentage.toFixed(1)}%`));

  const candidates = products.filter(p => {
    const vendor = p.vendor || 'Unknown';
    const category = p.category || 'Unknown';

    // Check if from low-performing segment
    const vendorRevShare = vendorSummary.find(v => v.vendor === vendor)?.revenuePercentage || 0;
    const categoryRevShare = categorySummary.find(c => c.category === category)?.revenuePercentage || 0;
    const isLowPerformingSegment = vendorRevShare < 15 || categoryRevShare < 15;

    if (!isLowPerformingSegment) return false;

    // Check if outperforms segment average
    const segmentAvg = segmentAverages.byVendor.get(vendor) || segmentAverages.byCategory.get(category) || 0;
    const outperformanceRatio = segmentAvg > 0 ? p.sellThroughRate / segmentAvg : 0;

    // Adjusted: Lowered from 30% outperformance to 20%, and from 50% to 30% sell-through
    return (
      outperformanceRatio > 1.2 &&
      p.sellThroughRate > 30
    );
  });

  console.log(`  Found ${candidates.length} sleeper hits (adjusted: low-rev category + 20% above avg + >30% sell-through)`);

  return candidates
    .map(p => {
      const vendor = p.vendor || 'Unknown';
      const category = p.category || 'Unknown';
      const segmentAvg = segmentAverages.byVendor.get(vendor) || segmentAverages.byCategory.get(category) || 0;
      const outperformance = segmentAvg > 0 ? ((p.sellThroughRate / segmentAvg - 1) * 100).toFixed(0) : '0';

      return {
        ...p,
        rankingReason: `${p.sellThroughRate.toFixed(0)}% sell-through (${outperformance}% above segment avg)`,
        rankingScore: (p.sellThroughRate - segmentAvg) * p.unitsSold,
      };
    })
    .sort((a, b) => b.rankingScore - a.rankingScore)
    .slice(0, 5);
}

/**
 * Identify Slow Movers: Low velocity, needs attention
 */
function identifySlowMovers(
  products: ProductWithRankingData[],
  dropEndTime: string
): RankedProduct[] {
  const dropEnded = new Date(dropEndTime).getTime() < Date.now();

  return products
    .filter(p => {
      const neverSoldOut = !p.soldOutAt;
      const highRemainingInventory = p.remainingInventory > (p.unitsSold + p.remainingInventory) * 0.5;

      return dropEnded && (
        p.sellThroughRate < 25 ||
        (neverSoldOut && highRemainingInventory)
      );
    })
    .map(p => {
      const remainingPercent = ((p.remainingInventory / (p.unitsSold + p.remainingInventory)) * 100).toFixed(0);

      return {
        ...p,
        rankingReason: `${p.sellThroughRate.toFixed(0)}% sell-through, ${remainingPercent}% inventory remaining`,
        rankingScore: (p.remainingInventory / (p.unitsSold + p.remainingInventory) * 100) + (100 - p.sellThroughRate),
      };
    })
    .sort((a, b) => b.rankingScore - a.rankingScore)
    .slice(0, 5);
}

/**
 * Identify Duds: Poor performance across all metrics
 */
function identifyDuds(
  products: ProductWithRankingData[],
  dropStartTime: string
): RankedProduct[] {
  const dropStarted = new Date(dropStartTime).getTime();
  const oneDayMs = 24 * 60 * 60 * 1000;
  const dropOldEnough = Date.now() - dropStarted > oneDayMs;

  console.log('💔 Duds Analysis:');
  console.log(`  - Drop old enough (>24hrs): ${dropOldEnough}`);

  if (!dropOldEnough) {
    console.log(`  - Drop age: ${((Date.now() - dropStarted) / oneDayMs).toFixed(1)} days`);
    return [];
  }

  const sortedByRevenue = [...products].sort((a, b) => a.totalRevenue - b.totalRevenue);
  const bottom20PercentCount = Math.ceil(sortedByRevenue.length * 0.2);
  const lowRevenueProducts = sortedByRevenue.slice(0, Math.max(bottom20PercentCount, 5));

  console.log(`  - Bottom 20% products: ${lowRevenueProducts.length}`);

  const candidates = lowRevenueProducts.filter(p => {
    const revenuePerUnit = p.unitsSold > 0 ? p.totalRevenue / p.unitsSold : 0;
    // Adjusted: Focus on low sell-through for bottom revenue products
    // Removed price constraint since premium products can still be duds
    const passes = p.sellThroughRate < 20;

    if (p.sellThroughRate < 30 || revenuePerUnit < 30) {
      console.log(`  - ${p.productName}: sell-through=${p.sellThroughRate.toFixed(1)}%, rev/unit=$${revenuePerUnit.toFixed(2)}, passes=${passes}`);
    }

    return passes;
  });

  console.log(`  Found ${candidates.length} duds (adjusted criteria: bottom 20% revenue + <20% sell-through)`);

  return candidates
    .map(p => {
      const revenuePerUnit = p.unitsSold > 0 ? p.totalRevenue / p.unitsSold : 0;

      return {
        ...p,
        rankingReason: `${p.sellThroughRate.toFixed(0)}% sell-through, $${revenuePerUnit.toFixed(2)} per unit`,
        rankingScore: (100 - p.sellThroughRate) + (100 - (p.revenuePercentage * 5)),
      };
    })
    .sort((a, b) => b.rankingScore - a.rankingScore)
    .slice(0, 5);
}

/**
 * Main ranking function: categorize products into performance tiers
 */
export function rankProducts(
  productSummary: ProductSummary[],
  aggregatedProductSummary: AggregatedProductSummary[],
  vendorSummary: VendorSummary[],
  categorySummary: CategorySummary[],
  dropStartTime: string,
  dropEndTime: string
): ProductRankingCategories {
  console.log('🔍 Product Ranking Debug:');
  console.log('- Total products:', productSummary.length);
  console.log('- Aggregated products:', aggregatedProductSummary.length);
  console.log('- Vendors:', vendorSummary.length);
  console.log('- Categories:', categorySummary.length);
  console.log('- Drop start:', dropStartTime);
  console.log('- Drop end:', dropEndTime);

  // Enrich product data with vendor/category info
  const enrichedProducts = enrichProductData(productSummary, aggregatedProductSummary);
  console.log('- Enriched products:', enrichedProducts.length);
  console.log('- Sample enriched product:', enrichedProducts[0]);

  // Calculate segment averages for sleeper hit detection
  const segmentAverages = calculateSegmentAverages(aggregatedProductSummary);

  // Track assigned products to prevent duplicates
  const assignedProductIds = new Set<number>();

  // Priority order: Star Performer → Revenue Champion → Sleeper Hit → Dud → Slow Mover

  // 1. Star Performers (highest priority)
  const starPerformers = identifyStarPerformers(enrichedProducts, dropStartTime, dropEndTime);
  console.log('⭐ Star Performers:', starPerformers.length);
  starPerformers.forEach(p => assignedProductIds.add(p.variantId));

  // 2. Revenue Champions
  const availableForRevenue = enrichedProducts.filter(p => !assignedProductIds.has(p.variantId));
  const revenueChampions = identifyRevenueChampions(availableForRevenue);
  console.log('💰 Revenue Champions:', revenueChampions.length);
  revenueChampions.forEach(p => assignedProductIds.add(p.variantId));

  // 3. Sleeper Hits
  const availableForSleeper = enrichedProducts.filter(p => !assignedProductIds.has(p.variantId));
  const sleeperHits = identifySleeperHits(availableForSleeper, segmentAverages, vendorSummary, categorySummary);
  console.log('😴 Sleeper Hits:', sleeperHits.length);
  sleeperHits.forEach(p => assignedProductIds.add(p.variantId));

  // 4. Duds
  const availableForDuds = enrichedProducts.filter(p => !assignedProductIds.has(p.variantId));
  const duds = identifyDuds(availableForDuds, dropStartTime);
  console.log('💔 Duds:', duds.length);
  duds.forEach(p => assignedProductIds.add(p.variantId));

  // 5. Slow Movers (lowest priority)
  const availableForSlow = enrichedProducts.filter(p => !assignedProductIds.has(p.variantId));
  const slowMovers = identifySlowMovers(availableForSlow, dropEndTime);
  console.log('🐌 Slow Movers:', slowMovers.length);

  return {
    starPerformers,
    slowMovers,
    revenueChampions,
    sleeperHits,
    duds,
  };
}
