/**
 * Centralized type definitions barrel export
 * Import types from here to ensure consistency across the application
 *
 * Example usage:
 *   import type { Order, ProductSummary, SalesMetrics } from '../types';
 */

// Order types
export type {
  Order,
  OrderCustomer,
  OrderRefund,
  RefundTransaction,
  OrderLineItem,
} from './order';

// Product types
export type {
  ProductSummary,
  AggregatedProductSummary,
  VendorSummary,
  ColorSummary,
  SizeSummary,
  ProductTypeSummary,
  CategorySummary,
  TopProduct,
} from './product';

// Metrics types
export type {
  SalesMetrics,
  CustomerMetrics,
  FulfillmentStatus,
  PeakOrderTime,
  OrderVelocity,
} from './metrics';

// Sync types
export type { SyncStatus } from './sync';

// Analysis types
export type { OrderAnalysisData } from './analysis';
