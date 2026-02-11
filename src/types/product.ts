/**
 * Product-related type definitions
 * Centralized source of truth for product summaries and aggregations
 */

/**
 * Summary of a single product variant's performance
 */
export interface ProductSummary {
  productId: number;
  variantId: number;
  productName: string;
  variantName: string;
  color: string;
  size: string;
  sku: string;
  unitsSold: number;
  remainingInventory: number;
  totalRevenue: number;
  currency: string;
  sellThroughRate: number;
  revenuePercentage: number;
  imageUrl?: string;
  soldOutAt?: string;
}

/**
 * Aggregated summary of all variants for a single product
 */
export interface AggregatedProductSummary {
  productId: number;
  productName: string;
  productType: string;
  vendor: string;
  category: string;
  unitsSold: number;
  remainingInventory: number;
  totalRevenue: number;
  currency: string;
  sellThroughRate: number;
  revenuePercentage: number;
  imageUrl?: string;
}

/**
 * Summary of sales by vendor
 */
export interface VendorSummary {
  vendor: string;
  productCount: number;
  unitsSold: number;
  totalRevenue: number;
  currency: string;
  revenuePercentage: number;
}

/**
 * Summary of sales by product color
 */
export interface ColorSummary {
  color: string;
  variantCount: number;
  unitsSold: number;
  totalRevenue: number;
  currency: string;
  revenuePercentage: number;
}

/**
 * Summary of sales by product size
 */
export interface SizeSummary {
  size: string;
  variantCount: number;
  unitsSold: number;
  totalRevenue: number;
  currency: string;
  revenuePercentage: number;
}

/**
 * Summary of sales by product type
 */
export interface ProductTypeSummary {
  productType: string;
  productCount: number;
  unitsSold: number;
  totalRevenue: number;
  currency: string;
  revenuePercentage: number;
}

/**
 * Summary of sales by category
 */
export interface CategorySummary {
  category: string;
  productCount: number;
  unitsSold: number;
  totalRevenue: number;
  currency: string;
  revenuePercentage: number;
}

/**
 * Top selling product (simplified view)
 */
export interface TopProduct {
  title: string;
  productId: number;
  unitsSold: number;
}
