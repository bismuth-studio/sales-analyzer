import React from 'react';
import { Card, InlineStack, Text, Button } from '@shopify/polaris';
import { RefreshIcon } from '@shopify/polaris-icons';

interface OrderDataCardProps {
  lastSyncAt?: string | null;
  onSync: () => void;
  isSyncing?: boolean;
}

export const OrderDataCard: React.FC<OrderDataCardProps> = ({
  lastSyncAt,
  onSync,
  isSyncing = false,
}) => {
  return (
    <Card>
      <InlineStack align="space-between" blockAlign="center">
        <InlineStack gap="200" blockAlign="center">
          <Text as="h2" variant="headingLg">
            Order Data Sync
          </Text>
          {lastSyncAt && (
            <Text as="span" variant="bodySm" tone="subdued">
              Last synced: {new Date(lastSyncAt).toLocaleString()}
            </Text>
          )}
        </InlineStack>
        <Button onClick={onSync} icon={RefreshIcon} loading={isSyncing}>
          Sync Orders from Shopify
        </Button>
      </InlineStack>
    </Card>
  );
};
