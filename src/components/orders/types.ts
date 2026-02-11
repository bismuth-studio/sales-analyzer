/**
 * Shared types for order-related components
 *
 * NOTE: This file now re-exports types from the centralized /src/types directory.
 * For new code, prefer importing directly from '@/types' or '../../types'
 * This file is kept for backward compatibility with existing imports.
 */

// Re-export all types from centralized location
export type {
  Order,
  OrderCustomer,
  OrderRefund,
  RefundTransaction,
  OrderLineItem,
} from '../../types/order';

export type {
  ProductSummary,
  AggregatedProductSummary,
  VendorSummary,
  ColorSummary,
  SizeSummary,
  ProductTypeSummary,
  CategorySummary,
  TopProduct,
} from '../../types/product';

export type {
  SalesMetrics,
  CustomerMetrics,
  FulfillmentStatus,
  PeakOrderTime,
  OrderVelocity,
} from '../../types/metrics';

export type { SyncStatus } from '../../types/sync';

export type { OrderAnalysisData } from '../../types/analysis';
