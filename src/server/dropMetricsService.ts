/**
 * Drop Metrics Calculation Service
 *
 * Calculates and caches metrics for drops based on order data.
 */

import { getOrdersByShop } from './sessionStorage';
import { runDatabaseOperation } from './database';
import type { Drop, DropMetrics } from './databaseWorker';

interface Order {
  id: number | string;
  created_at: string;
  total_line_items_price?: string;
  total_price?: string;
  total_discounts?: string;
  refunds?: Array<{
    transactions: Array<{
      amount?: string;
    }>;
  }>;
}

/**
 * Calculate metrics for a single drop
 */
export function calculateDropMetrics(drop: Drop, orders: Order[]): DropMetrics {
  const dropStart = new Date(drop.start_time);
  const dropEnd = new Date(drop.end_time);

  // Filter orders by drop time range
  const dropOrders = orders.filter(order => {
    const orderTime = new Date(order.created_at);
    return orderTime >= dropStart && orderTime <= dropEnd;
  });

  // Calculate gross sales
  const grossSales = dropOrders.reduce((sum, order) =>
    sum + parseFloat(order.total_line_items_price || order.total_price || '0'), 0);

  // Calculate total discounts
  const discounts = dropOrders.reduce((sum, order) =>
    sum + parseFloat(order.total_discounts || '0'), 0);

  // Calculate total refunds
  const refunds = dropOrders.reduce((sum, order) => {
    if (!order.refunds || order.refunds.length === 0) return sum;
    return sum + order.refunds.reduce((refundSum, refund) =>
      refundSum + refund.transactions.reduce((txSum, tx) =>
        txSum + parseFloat(tx.amount || '0'), 0), 0);
  }, 0);

  // Calculate net sales
  const netSales = grossSales - discounts - refunds;

  return {
    netSales,
    orderCount: dropOrders.length,
    grossSales,
    discounts,
    refunds
  };
}

/**
 * Update cached metrics for a single drop
 */
export async function updateDropMetricsCache(drop: Drop): Promise<void> {
  try {
    const orders = getOrdersByShop(drop.shop) || [];
    const metrics = calculateDropMetrics(drop, orders);

    await runDatabaseOperation({
      type: 'updateDropMetrics',
      id: drop.id,
      metrics
    });
  } catch (error) {
    console.error(`Error updating metrics for drop ${drop.id}:`, error);
    throw error;
  }
}

/**
 * Update cached metrics for all drops in a shop
 */
export async function updateShopDropMetrics(shop: string): Promise<void> {
  try {
    console.log(`Fetching drops for shop: ${shop}`);
    const drops = await runDatabaseOperation({
      type: 'getDropsByShop',
      shop
    }) as Drop[];

    console.log(`Found ${drops.length} drops, fetching orders...`);
    const orders = getOrdersByShop(shop) || [];
    console.log(`Found ${orders.length} orders`);

    // Update metrics for all drops
    console.log(`Calculating metrics for ${drops.length} drops...`);
    await Promise.all(
      drops.map(drop => {
        const metrics = calculateDropMetrics(drop, orders);
        console.log(`Drop ${drop.id}: ${metrics.orderCount} orders, $${metrics.netSales.toFixed(2)} net sales`);
        return runDatabaseOperation({
          type: 'updateDropMetrics',
          id: drop.id,
          metrics
        });
      })
    );
    console.log(`Successfully updated metrics for ${drops.length} drops`);
  } catch (error) {
    console.error(`Error updating shop drop metrics for ${shop}:`, error);
    throw error;
  }
}

/**
 * Update cached metrics for drops affected by an order
 * (drops whose time range includes the order's created_at)
 */
export async function updateDropMetricsForOrder(shop: string, orderCreatedAt: string): Promise<void> {
  try {
    const drops = await runDatabaseOperation({
      type: 'getDropsByShop',
      shop
    }) as Drop[];

    const orderTime = new Date(orderCreatedAt);
    const orders = getOrdersByShop(shop) || [];

    // Find drops that include this order's timestamp
    const affectedDrops = drops.filter(drop => {
      const dropStart = new Date(drop.start_time);
      const dropEnd = new Date(drop.end_time);
      return orderTime >= dropStart && orderTime <= dropEnd;
    });

    if (affectedDrops.length > 0) {
      console.log(`Order affects ${affectedDrops.length} drops, updating metrics...`);
      // Update metrics for affected drops only
      await Promise.all(
        affectedDrops.map(drop => {
          const metrics = calculateDropMetrics(drop, orders);
          return runDatabaseOperation({
            type: 'updateDropMetrics',
            id: drop.id,
            metrics
          });
        })
      );
    }
  } catch (error) {
    console.error(`Error updating metrics for order in ${shop}:`, error);
    throw error;
  }
}
