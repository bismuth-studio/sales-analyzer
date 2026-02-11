import React from 'react';
import { Card, BlockStack, Text, EmptyState, Badge, InlineStack } from '@shopify/polaris';
import type { TopProduct } from './types';

interface TopSellersCardProps {
  topProducts: TopProduct[];
  productImages: Record<string, string>;
}

export const TopSellersCard: React.FC<TopSellersCardProps> = ({
  topProducts,
  productImages,
}) => {
  return (
    <Card>
      <BlockStack gap="300">
        <InlineStack align="space-between" blockAlign="center">
          <Text as="h2" variant="headingLg">
            Top Sellers
          </Text>
          {topProducts.length > 0 && (
            <Badge tone="magic">{topProducts.length}</Badge>
          )}
        </InlineStack>
        <Text as="p" variant="bodySm" tone="subdued">
          Ranked by total units sold during this drop
        </Text>
        {topProducts && topProducts.length > 0 ? (
          <BlockStack gap="200">
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
                      width: '28px',
                      height: '28px',
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
                        width: '48px',
                        height: '48px',
                        objectFit: 'cover',
                        borderRadius: '4px',
                        flexShrink: 0,
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '48px',
                        height: '48px',
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
          <Text as="p" variant="bodySm" tone="subdued">
            No sales data available
          </Text>
        )}
      </BlockStack>
    </Card>
  );
};
