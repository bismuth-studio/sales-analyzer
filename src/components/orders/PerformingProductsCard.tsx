import React from 'react';
import { Card, BlockStack, Text, InlineStack } from '@shopify/polaris';

interface Product {
  productId: number;
  productName: string;
  unitsSold: number;
  totalRevenue: number;
  imageUrl?: string;
}

interface PerformingProductsCardProps {
  title: string;
  subtitle: string;
  products: Product[];
  formatCurrency: (amount: number) => string;
  isTop?: boolean;
}

export const PerformingProductsCard: React.FC<PerformingProductsCardProps> = ({
  title,
  subtitle,
  products,
  formatCurrency,
  isTop = true,
}) => {
  const displayProducts = products.slice(0, 5); // Show top/bottom 5

  return (
    <Card>
      <BlockStack gap="300">
        <Text as="h2" variant="headingLg">
          {title}
        </Text>
        <Text as="p" variant="bodySm" tone="subdued">
          {subtitle}
        </Text>
        {displayProducts.length > 0 ? (
          <BlockStack gap="200">
            {displayProducts.map((product, index) => (
              <div
                key={product.productId}
                style={{
                  padding: '12px',
                  backgroundColor: '#f6f6f7',
                  borderRadius: '8px',
                }}
              >
                <InlineStack align="space-between" blockAlign="center">
                  <InlineStack gap="300" blockAlign="center">
                    <div
                      style={{
                        width: '28px',
                        height: '28px',
                        backgroundColor: '#6b7280',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        fontWeight: 'bold',
                        fontSize: '12px',
                        flexShrink: 0,
                      }}
                    >
                      {index + 1}
                    </div>
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.productName}
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
                    <BlockStack gap="50">
                      <Text as="p" variant="bodyMd" fontWeight="semibold">
                        {product.productName}
                      </Text>
                      <Text as="p" variant="bodySm" tone="subdued">
                        {product.unitsSold} units sold
                      </Text>
                    </BlockStack>
                  </InlineStack>
                  <Text as="p" variant="bodyMd" fontWeight="semibold">
                    {formatCurrency(product.totalRevenue)}
                  </Text>
                </InlineStack>
              </div>
            ))}
          </BlockStack>
        ) : (
          <Text as="p" variant="bodySm" tone="subdued">
            No product data available
          </Text>
        )}
      </BlockStack>
    </Card>
  );
};
