/**
 * Shared types for order-related components
 */

import type { ProductRankingCategories } from '../../utils/productRanking';

export interface Order {
  id: number;
  name: string;
  email: string;
  created_at: string;
  total_price: string;
  subtotal_price: string;
  total_discounts: string;
  total_line_items_price: string;
  currency: string;
  financial_status: string;
  fulfillment_status?: string;
  tags: string;
  customer?: {
    id: number;
    email: string;
    orders_count: number;
  } | null;
  refunds?: Array<{
    id: number;
    created_at: string;
    transactions: Array<{
      amount: string;
    }>;
  }>;
  line_items: Array<{
    id: number;
    title: string;
    quantity: number;
    price: string;
    variant_title: string | null;
    sku: string | null;
    product_id: number;
    variant_id: number;
    vendor: string | null;
    product_type: string | null;
  }>;
}

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

export interface VendorSummary {
  vendor: string;
  productCount: number;
  unitsSold: number;
  totalRevenue: number;
  currency: string;
  revenuePercentage: number;
}

export interface ColorSummary {
  color: string;
  variantCount: number;
  unitsSold: number;
  totalRevenue: number;
  currency: string;
  revenuePercentage: number;
}

export interface ProductTypeSummary {
  productType: string;
  productCount: number;
  unitsSold: number;
  totalRevenue: number;
  currency: string;
  revenuePercentage: number;
}

export interface CategorySummary {
  category: string;
  productCount: number;
  unitsSold: number;
  totalRevenue: number;
  currency: string;
  revenuePercentage: number;
}

export interface SalesMetrics {
  totalOrders: number;
  totalItemsSold: number;
  grossSales: number;
  totalDiscounts: number;
  totalRefunds: number;
  refundedOrdersCount: number;
  netSales: number;
  avgOrderValue: number;
  fulfillmentStatus?: {
    unfulfilled: number;
    partial: number;
    fulfilled: number;
  };
  overallSellThroughRate?: number;
  peakOrderTime?: {
    hour: number;
    orderCount: number;
    displayText: string;
  };
  orderVelocity?: {
    ordersPerHour: number;
    ordersPerDay: number;
  };
}

export interface CustomerMetrics {
  uniqueCustomers: number;
  newCustomers: number;
  returningCustomers: number;
}

export interface TopProduct {
  title: string;
  productId: number;
  unitsSold: number;
}

export interface SyncStatus {
  status: 'idle' | 'syncing' | 'completed' | 'error';
  syncedOrders: number;
  totalOrders: number | null;
  lastSyncAt: string | null;
  syncRequired: boolean;
}

/**
 * Combined data structure passed from OrdersListWithFilters to parent components
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
