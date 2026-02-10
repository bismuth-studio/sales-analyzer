/**
 * Product ranking utility for categorizing products by performance
 */

import type {
  ProductSummary,
  AggregatedProductSummary,
  VendorSummary,
  CategorySummary,
} from '../components/orders/types';

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
  const vendorGroups = new Map<string, ProductSummary[]>();
  aggregatedProducts.forEach(p => {
    const vendor = p.vendor || 'Unknown';
    if (!vendorGroups.has(vendor)) vendorGroups.set(vendor, []);
    vendorGroups.get(vendor)!.push(p as ProductSummary);
  });

  vendorGroups.forEach((products, vendor) => {
    const avgSellThrough = products.reduce((sum, p) => sum + p.sellThroughRate, 0) / products.length;
    byVendor.set(vendor, avgSellThrough);
  });

  // Group by category
  const categoryGroups = new Map<string, ProductSummary[]>();
  aggregatedProducts.forEach(p => {
    const category = p.category || 'Unknown';
    if (!categoryGroups.has(category)) categoryGroups.set(category, []);
    categoryGroups.get(category)!.push(p as ProductSummary);
  });

  categoryGroups.forEach((products, category) => {
    const avgSellThrough = products.reduce((sum, p) => sum + p.sellThroughRate, 0) / products.length;
    byCategory.set(category, avgSellThrough);
  });

  // Group by product type
  const typeGroups = new Map<string, ProductSummary[]>();
  aggregatedProducts.forEach(p => {
    const type = p.productType || 'Unknown';
    if (!typeGroups.has(type)) typeGroups.set(type, []);
    typeGroups.get(type)!.push(p as ProductSummary);
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
  return products
    .filter(p => {
      const velocity = calculateVelocity(p, dropStartTime, dropEndTime);
      return (
        p.sellThroughRate > 70 &&
        (velocity !== null ? velocity < 0.5 : p.sellThroughRate > 85) && // Fallback if no velocity data
        p.unitsSold >= 5
      );
    })
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
  const totalRevenue = vendorSummary.reduce((sum, v) => sum + v.totalRevenue, 0);

  return products
    .filter(p => {
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

      return (
        outperformanceRatio > 1.3 &&
        p.sellThroughRate > 50
      );
    })
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

  if (!dropOldEnough) return [];

  const sortedByRevenue = [...products].sort((a, b) => a.totalRevenue - b.totalRevenue);
  const bottom20PercentCount = Math.ceil(sortedByRevenue.length * 0.2);
  const lowRevenueProducts = sortedByRevenue.slice(0, Math.max(bottom20PercentCount, 5));

  return lowRevenueProducts
    .filter(p => {
      const revenuePerUnit = p.unitsSold > 0 ? p.totalRevenue / p.unitsSold : 0;
      return (
        p.sellThroughRate < 20 &&
        revenuePerUnit < 20
      );
    })
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
  // Enrich product data with vendor/category info
  const enrichedProducts = enrichProductData(productSummary, aggregatedProductSummary);

  // Calculate segment averages for sleeper hit detection
  const segmentAverages = calculateSegmentAverages(aggregatedProductSummary);

  // Track assigned products to prevent duplicates
  const assignedProductIds = new Set<number>();

  // Priority order: Star Performer → Revenue Champion → Sleeper Hit → Dud → Slow Mover

  // 1. Star Performers (highest priority)
  const starPerformers = identifyStarPerformers(enrichedProducts, dropStartTime, dropEndTime);
  starPerformers.forEach(p => assignedProductIds.add(p.variantId));

  // 2. Revenue Champions
  const availableForRevenue = enrichedProducts.filter(p => !assignedProductIds.has(p.variantId));
  const revenueChampions = identifyRevenueChampions(availableForRevenue);
  revenueChampions.forEach(p => assignedProductIds.add(p.variantId));

  // 3. Sleeper Hits
  const availableForSleeper = enrichedProducts.filter(p => !assignedProductIds.has(p.variantId));
  const sleeperHits = identifySleeperHits(availableForSleeper, segmentAverages, vendorSummary, categorySummary);
  sleeperHits.forEach(p => assignedProductIds.add(p.variantId));

  // 4. Duds
  const availableForDuds = enrichedProducts.filter(p => !assignedProductIds.has(p.variantId));
  const duds = identifyDuds(availableForDuds, dropStartTime);
  duds.forEach(p => assignedProductIds.add(p.variantId));

  // 5. Slow Movers (lowest priority)
  const availableForSlow = enrichedProducts.filter(p => !assignedProductIds.has(p.variantId));
  const slowMovers = identifySlowMovers(availableForSlow, dropEndTime);

  return {
    starPerformers,
    slowMovers,
    revenueChampions,
    sleeperHits,
    duds,
  };
}
