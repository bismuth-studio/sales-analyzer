/**
 * Order analysis data structure type definitions
 * Combined data passed from OrdersListWithFilters to parent components
 */

import type { SalesMetrics, CustomerMetrics } from './metrics';
import type {
  ProductSummary,
  AggregatedProductSummary,
  VendorSummary,
  CategorySummary,
  ProductTypeSummary,
  TopProduct,
} from './product';
import type { SyncStatus } from './sync';
import type { ProductRankingCategories } from '../utils/productRanking';

/**
 * Combined data structure passed from OrdersListWithFilters to parent components
 * This interface aggregates all analysis results for a set of orders
 */
export interface OrderAnalysisData {
  salesMetrics: SalesMetrics;
  customerMetrics: CustomerMetrics;
  topProducts: TopProduct[];
  productSummary: ProductSummary[];
  soldOutVariants: ProductSummary[];
  productImages: Record<string, string>;
  syncStatus: SyncStatus | null;
  formatCurrency: (amount: number) => string;
  aggregatedProductSummary?: AggregatedProductSummary[];
  vendorSummary?: VendorSummary[];
  categorySummary?: CategorySummary[];
  productTypeSummary?: ProductTypeSummary[];
  productRankings?: ProductRankingCategories;
}
