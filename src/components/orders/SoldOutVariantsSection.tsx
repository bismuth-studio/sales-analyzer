import React from 'react';
import {
  Card,
  Text,
  Badge,
  BlockStack,
  InlineStack,
} from '@shopify/polaris';
import type { ProductSummary } from './types';

interface SoldOutVariantsSectionProps {
  soldOutVariants: ProductSummary[];
  dropStartTime?: string;
  formatCurrency: (amount: number) => string;
}

// Helper functions for velocity calculations
const formatDuration = (startTime: string, endTime: string) => {
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  const durationMs = end - start;

  if (durationMs < 0) return 'N/A';

  const seconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    const remainingHours = hours % 24;
    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
  }
  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  }
  if (minutes > 0) {
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }
  return `${seconds}s`;
};

const calculateSalesVelocity = (
  unitsSold: number,
  dropStartTime: string,
  soldOutAt: string
): { value: number; unit: 'min' | 'hr' | 'day' } => {
  const durationMs = new Date(soldOutAt).getTime() - new Date(dropStartTime).getTime();
  if (durationMs <= 0) return { value: 0, unit: 'hr' };

  const hours = durationMs / 3600000;

  if (hours < 1) {
    return { value: unitsSold / (durationMs / 60000), unit: 'min' };
  } else if (hours > 24) {
    return { value: unitsSold / (hours / 24), unit: 'day' };
  }
  return { value: unitsSold / hours, unit: 'hr' };
};

const formatVelocity = (value: number, unit: 'min' | 'hr' | 'day'): string => {
  const formatted = value < 10 ? value.toFixed(1) : Math.round(value).toString();
  return `${formatted}/${unit}`;
};

const calculateRevenueVelocity = (
  totalRevenue: number,
  dropStartTime: string,
  soldOutAt: string
): { value: number; unit: 'min' | 'hr' | 'day' } => {
  const durationMs = new Date(soldOutAt).getTime() - new Date(dropStartTime).getTime();
  if (durationMs <= 0) return { value: 0, unit: 'hr' };

  const hours = durationMs / 3600000;

  if (hours < 1) {
    return { value: totalRevenue / (durationMs / 60000), unit: 'min' };
  } else if (hours > 24) {
    return { value: totalRevenue / (hours / 24), unit: 'day' };
  }
  return { value: totalRevenue / hours, unit: 'hr' };
};

export const SoldOutVariantsSection: React.FC<SoldOutVariantsSectionProps> = ({
  soldOutVariants,
  dropStartTime,
  formatCurrency,
}) => {
  // Defensive check for empty or undefined array
  if (!soldOutVariants || soldOutVariants.length === 0) {
    return null;
  }

  return (
    <Card>
      <BlockStack gap="300">
        <InlineStack align="space-between" blockAlign="center">
          <Text as="h2" variant="headingLg">
            Sold Out Variants
          </Text>
          <Badge tone="critical">
            {soldOutVariants.length.toString()}
          </Badge>
        </InlineStack>
        <Text as="p" variant="bodySm" tone="subdued">
          Products that have reached 100% sell-through based on starting inventory
        </Text>
        <BlockStack gap="200">
          {soldOutVariants.map((product) => (
            <div
              key={`${product.productId}-${product.variantId}`}
              style={{
                padding: '12px',
                backgroundColor: '#f6f6f7',
                borderRadius: '8px',
              }}
            >
              <InlineStack align="space-between" blockAlign="start">
                <InlineStack gap="300" blockAlign="center">
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
                  <BlockStack gap="050">
                    <Text as="p" variant="bodyMd" fontWeight="semibold">
                      {product.productName}
                    </Text>
                    {(product.color || product.size) && (
                      <Text as="p" variant="bodySm" tone="subdued">
                        {[product.color, product.size].filter(Boolean).join(' / ')}
                      </Text>
                    )}
                    <Text as="p" variant="bodySm" tone="critical">
                      {product.unitsSold} sold (100%)
                    </Text>
                    {product.soldOutAt && dropStartTime && (() => {
                      const salesVel = calculateSalesVelocity(
                        product.unitsSold,
                        dropStartTime,
                        product.soldOutAt
                      );
                      const revVel = calculateRevenueVelocity(
                        product.totalRevenue,
                        dropStartTime,
                        product.soldOutAt
                      );

                      return (
                        <InlineStack gap="200" wrap={false}>
                          <Text as="span" variant="bodySm">
                            {formatVelocity(salesVel.value, salesVel.unit)} units
                          </Text>
                          <Text as="span" variant="bodySm" tone="subdued">•</Text>
                          <Text as="span" variant="bodySm" tone="success">
                            {formatCurrency(revVel.value)}/{revVel.unit}
                          </Text>
                        </InlineStack>
                      );
                    })()}
                    {product.soldOutAt && dropStartTime && (
                      <Text as="p" variant="bodySm" tone="success">
                        Sold out in {formatDuration(dropStartTime, product.soldOutAt)}
                      </Text>
                    )}
                  </BlockStack>
                </InlineStack>
                <Text as="p" variant="bodyMd" fontWeight="semibold">
                  {formatCurrency(product.totalRevenue)}
                </Text>
              </InlineStack>
            </div>
          ))}
        </BlockStack>
      </BlockStack>
    </Card>
  );
};
