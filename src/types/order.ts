/**
 * Order-related type definitions
 * Centralized source of truth for Order interface
 */

/**
 * Customer information attached to an order
 */
export interface OrderCustomer {
  id: number;
  email: string;
  orders_count: number;
}

/**
 * Refund transaction details
 */
export interface RefundTransaction {
  amount: string;
}

/**
 * Refund information for an order
 */
export interface OrderRefund {
  id: number;
  created_at: string;
  transactions: RefundTransaction[];
}

/**
 * Line item (product) in an order
 */
export interface OrderLineItem {
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
}

/**
 * Complete order structure from Shopify
 */
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
  customer?: OrderCustomer | null;
  refunds?: OrderRefund[];
  line_items: OrderLineItem[];
}
