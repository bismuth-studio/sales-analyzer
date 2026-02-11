import React from 'react';
import {
  Card,
  Text,
  BlockStack,
  InlineGrid,
  InlineStack,
  EmptyState,
} from '@shopify/polaris';
import type { SalesMetrics, CustomerMetrics, TopProduct } from './types';

interface SummaryMetricsCardProps {
  salesMetrics: SalesMetrics;
  customerMetrics: CustomerMetrics;
  topProducts: TopProduct[];
  productImages: Record<string, string>;
  formatCurrency: (amount: number) => string;
}

export const SummaryMetricsCard: React.FC<SummaryMetricsCardProps> = ({
  salesMetrics,
  customerMetrics,
  topProducts,
  productImages,
  formatCurrency,
}) => {
  // Defensive defaults
  const {
    totalOrders = 0,
    totalItemsSold = 0,
    grossSales = 0,
    totalDiscounts = 0,
    refundedOrdersCount = 0,
    netSales = 0,
    avgOrderValue = 0,
  } = salesMetrics || {};

  const { uniqueCustomers = 0, newCustomers = 0, returningCustomers = 0 } = customerMetrics || {};

  return (
    <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
      {/* Card 1: Drop Summary Metrics */}
      <Card>
        <BlockStack gap="400">
          <Text as="h2" variant="headingLg">
            Drop Summary
          </Text>
          <Text as="p" variant="bodySm" tone="subdued">
            Key metrics and statistics for your drop including revenue, orders, and customer data
          </Text>
          {/* Row 1: Sales Metrics */}
          <InlineStack gap="800" align="start" wrap>
            <BlockStack gap="100">
              <Text as="p" variant="bodySm" tone="subdued">
                Gross Sales
              </Text>
              <Text as="p" variant="heading2xl">
                {formatCurrency(grossSales)}
              </Text>
            </BlockStack>
            <BlockStack gap="100">
              <Text as="p" variant="bodySm" tone="subdued">
                Discounts
              </Text>
              <Text as="p" variant="heading2xl" tone={totalDiscounts > 0 ? 'caution' : undefined}>
                -{formatCurrency(totalDiscounts)}
              </Text>
            </BlockStack>
            <BlockStack gap="100">
              <Text as="p" variant="bodySm" tone="subdued">
                Returns
              </Text>
              <Text as="p" variant="heading2xl" tone={refundedOrdersCount > 0 ? 'critical' : undefined}>
                {refundedOrdersCount.toLocaleString()}
              </Text>
            </BlockStack>
            <BlockStack gap="100">
              <Text as="p" variant="bodySm" tone="subdued">
                Net Sales
              </Text>
              <Text as="p" variant="heading2xl" fontWeight="bold">
                {formatCurrency(netSales)}
              </Text>
            </BlockStack>
          </InlineStack>
          {/* Row 2: Orders & Customers */}
          <InlineStack gap="800" align="start" wrap>
            <BlockStack gap="100">
              <Text as="p" variant="bodySm" tone="subdued">
                Orders
              </Text>
              <Text as="p" variant="heading2xl">
                {totalOrders.toLocaleString()}
              </Text>
            </BlockStack>
            <BlockStack gap="100">
              <Text as="p" variant="bodySm" tone="subdued">
                Avg Order Value
              </Text>
              <Text as="p" variant="heading2xl">
                {formatCurrency(avgOrderValue)}
              </Text>
            </BlockStack>
            <BlockStack gap="100">
              <Text as="p" variant="bodySm" tone="subdued">
                Items Sold
              </Text>
              <Text as="p" variant="heading2xl">
                {totalItemsSold.toLocaleString()}
              </Text>
            </BlockStack>
            <BlockStack gap="100">
              <Text as="p" variant="bodySm" tone="subdued">
                Customers
              </Text>
              <Text as="p" variant="heading2xl">
                {uniqueCustomers.toLocaleString()}
              </Text>
            </BlockStack>
            <BlockStack gap="100">
              <Text as="p" variant="bodySm" tone="subdued">
                New Customers
              </Text>
              <Text as="p" variant="heading2xl" tone="success">
                {newCustomers.toLocaleString()}
              </Text>
            </BlockStack>
            <BlockStack gap="100">
              <Text as="p" variant="bodySm" tone="subdued">
                Returning
              </Text>
              <Text as="p" variant="heading2xl">
                {returningCustomers.toLocaleString()}
              </Text>
            </BlockStack>
          </InlineStack>
          {/* Row 3: Performance Metrics */}
          <InlineStack gap="800" align="start" wrap>
            {/* Fulfillment Status */}
            {salesMetrics.fulfillmentStatus && (
              <>
                <BlockStack gap="100">
                  <Text as="p" variant="bodySm" tone="subdued">
                    Unfulfilled
                  </Text>
                  <Text as="p" variant="heading2xl" tone={salesMetrics.fulfillmentStatus.unfulfilled > 0 ? 'caution' : undefined}>
                    {salesMetrics.fulfillmentStatus.unfulfilled.toLocaleString()}
                  </Text>
                </BlockStack>
                <BlockStack gap="100">
                  <Text as="p" variant="bodySm" tone="subdued">
                    Partial
                  </Text>
                  <Text as="p" variant="heading2xl">
                    {salesMetrics.fulfillmentStatus.partial.toLocaleString()}
                  </Text>
                </BlockStack>
                <BlockStack gap="100">
                  <Text as="p" variant="bodySm" tone="subdued">
                    Fulfilled
                  </Text>
                  <Text as="p" variant="heading2xl" tone="success">
                    {salesMetrics.fulfillmentStatus.fulfilled.toLocaleString()}
                  </Text>
                </BlockStack>
              </>
            )}

            {/* Overall Sell-through Rate */}
            {salesMetrics.overallSellThroughRate !== undefined && (
              <BlockStack gap="100">
                <Text as="p" variant="bodySm" tone="subdued">
                  Sell-through Rate
                </Text>
                <Text
                  as="p"
                  variant="heading2xl"
                  tone={
                    salesMetrics.overallSellThroughRate >= 80 ? 'success' :
                    salesMetrics.overallSellThroughRate >= 50 ? undefined :
                    'caution'
                  }
                >
                  {salesMetrics.overallSellThroughRate.toFixed(1)}%
                </Text>
              </BlockStack>
            )}

            {/* Peak Order Time */}
            {salesMetrics.peakOrderTime && (
              <BlockStack gap="100">
                <Text as="p" variant="bodySm" tone="subdued">
                  Peak Order Time
                </Text>
                <Text as="p" variant="heading2xl">
                  {salesMetrics.peakOrderTime.displayText}
                </Text>
              </BlockStack>
            )}

            {/* Order Velocity */}
            {salesMetrics.orderVelocity && (
              <BlockStack gap="100">
                <Text as="p" variant="bodySm" tone="subdued">
                  Order Velocity
                </Text>
                <Text as="p" variant="heading2xl">
                  {salesMetrics.orderVelocity.ordersPerHour.toFixed(1)}/hr
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  ({salesMetrics.orderVelocity.ordersPerDay.toFixed(0)}/day)
                </Text>
              </BlockStack>
            )}
          </InlineStack>
        </BlockStack>
      </Card>

      {/* Card 2: Top Sellers */}
      <Card>
        <BlockStack gap="400">
          <Text as="h2" variant="headingLg">
            Top Sellers
          </Text>
          <Text as="p" variant="bodySm" tone="subdued">
            Best performing products during this drop
          </Text>
          {topProducts && topProducts.length > 0 ? (
            <BlockStack gap="300">
              {topProducts.map((p, rank) => {
                const imageUrl = productImages[String(p.productId)];
                return (
                  <div
                    key={p.title}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px',
                      backgroundColor: '#f6f6f7',
                      borderRadius: '8px',
                      width: '100%',
                    }}
                  >
                    <div
                      style={{
                        width: '24px',
                        height: '24px',
                        backgroundColor: rank === 0 ? '#ffd700' : rank === 1 ? '#c0c0c0' : rank === 2 ? '#cd7f32' : '#6b7280',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: rank === 0 ? '#000' : '#fff',
                        fontWeight: 'bold',
                        fontSize: '12px',
                        flexShrink: 0,
                      }}
                    >
                      {rank + 1}
                    </div>
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={p.title}
                        style={{
                          width: '40px',
                          height: '40px',
                          objectFit: 'cover',
                          borderRadius: '4px',
                          flexShrink: 0,
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '40px',
                          height: '40px',
                          backgroundColor: '#e1e1e1',
                          borderRadius: '4px',
                          flexShrink: 0,
                        }}
                      />
                    )}
                    <div style={{ overflow: 'hidden', flex: 1 }}>
                      <Text as="p" variant="bodySm" fontWeight="semibold" truncate>
                        {p.title}
                      </Text>
                      <Text as="p" variant="bodySm" tone="subdued">
                        {p.unitsSold} sold
                      </Text>
                    </div>
                  </div>
                );
              })}
            </BlockStack>
          ) : (
            <EmptyState
              heading="No sales data yet"
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
            >
              <p>Top selling products will appear here once orders are placed during this drop.</p>
            </EmptyState>
          )}
        </BlockStack>
      </Card>
    </InlineGrid>
  );
};
