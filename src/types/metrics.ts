/**
 * Sales and customer metrics type definitions
 * Centralized source of truth for analytics metrics
 */

/**
 * Fulfillment status breakdown
 */
export interface FulfillmentStatus {
  unfulfilled: number;
  partial: number;
  fulfilled: number;
}

/**
 * Peak ordering time information
 */
export interface PeakOrderTime {
  hour: number;
  orderCount: number;
  displayText: string;
}

/**
 * Order velocity metrics
 */
export interface OrderVelocity {
  ordersPerHour: number;
  ordersPerDay: number;
}

/**
 * Comprehensive sales metrics for a drop or time period
 */
export interface SalesMetrics {
  totalOrders: number;
  totalItemsSold: number;
  grossSales: number;
  totalDiscounts: number;
  totalRefunds: number;
  refundedOrdersCount: number;
  netSales: number;
  avgOrderValue: number;
  fulfillmentStatus?: FulfillmentStatus;
  overallSellThroughRate?: number;
  peakOrderTime?: PeakOrderTime;
  orderVelocity?: OrderVelocity;
}

/**
 * Customer behavior metrics
 */
export interface CustomerMetrics {
  uniqueCustomers: number;
  newCustomers: number;
  returningCustomers: number;
}
