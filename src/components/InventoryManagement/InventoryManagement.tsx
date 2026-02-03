import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card,
  BlockStack,
  InlineStack,
  Text,
  Badge,
  Button,
  Banner,
  Spinner,
} from '@shopify/polaris';
import { ChevronUpIcon, ChevronDownIcon, ImportIcon, RefreshIcon, ResetIcon } from '@shopify/polaris-icons';
import InventoryTable from './InventoryTable';
import CSVImportModal from './CSVImportModal';
import type { Drop, InventoryItem, VariantMetadata } from './InventoryTypes';

interface InventoryManagementProps {
  dropId: string;
  shop: string;
  inventorySnapshot: string | null;
  inventorySource: 'auto' | 'manual' | 'csv' | null;
  snapshotTakenAt: string | null;
  hasOriginalSnapshot: boolean;
  onInventoryUpdated: (updatedDrop: Drop) => void;
}

function InventoryManagement({
  dropId,
  shop,
  inventorySnapshot,
  inventorySource,
  snapshotTakenAt,
  hasOriginalSnapshot,
  onInventoryUpdated,
}: InventoryManagementProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [variantMetadata, setVariantMetadata] = useState<Map<string, VariantMetadata>>(new Map());
  const [modifiedInventory, setModifiedInventory] = useState<Map<string, number>>(new Map());
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [csvModalOpen, setCSVModalOpen] = useState(false);

  // Parse the inventory snapshot
  const parsedSnapshot: { [variantId: string]: number } | null = useMemo(() => {
    if (inventorySnapshot) {
      try {
        return JSON.parse(inventorySnapshot);
      } catch {
        return null;
      }
    }
    return null;
  }, [inventorySnapshot]);

  // Get list of variant IDs from snapshot
  const variantIds = useMemo(() => {
    return parsedSnapshot ? Object.keys(parsedSnapshot) : [];
  }, [parsedSnapshot]);

  // Fetch variant metadata when expanded and we have variant IDs
  useEffect(() => {
    if (!isExpanded || variantIds.length === 0 || variantMetadata.size > 0) {
      return;
    }

    const fetchMetadata = async () => {
      setMetadataLoading(true);
      try {
        const response = await fetch(
          `/api/orders/variants?shop=${encodeURIComponent(shop)}&variantIds=${variantIds.join(',')}`
        );
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.variants) {
            const metadataMap = new Map<string, VariantMetadata>();
            for (const v of data.variants) {
              metadataMap.set(v.variantId, v);
            }
            setVariantMetadata(metadataMap);
          }
        }
      } catch (err) {
        console.error('Error fetching variant metadata:', err);
      } finally {
        setMetadataLoading(false);
      }
    };

    fetchMetadata();
  }, [isExpanded, variantIds, shop, variantMetadata.size]);

  // Build inventory items for the table
  const inventoryItems: InventoryItem[] = useMemo(() => {
    if (!parsedSnapshot) return [];

    return variantIds.map(variantId => {
      const metadata = variantMetadata.get(variantId);
      const originalQuantity = parsedSnapshot[variantId] ?? 0;
      const currentQuantity = modifiedInventory.has(variantId)
        ? modifiedInventory.get(variantId)!
        : originalQuantity;
      const isModified = modifiedInventory.has(variantId) && modifiedInventory.get(variantId) !== originalQuantity;

      let source: InventoryItem['source'] = 'snapshot';
      if (inventorySource === 'manual') source = 'manual';
      else if (inventorySource === 'csv') source = 'csv';

      return {
        variantId,
        sku: metadata?.sku || '',
        productName: metadata?.productName || 'Loading...',
        variantName: metadata?.variantName || 'Loading...',
        initialInventory: currentQuantity,
        source,
        isModified,
      };
    });
  }, [parsedSnapshot, variantIds, variantMetadata, modifiedInventory, inventorySource]);

  const hasUnsavedChanges = modifiedInventory.size > 0;

  const handleQuantityChange = useCallback((variantId: string, newQuantity: number) => {
    setModifiedInventory(prev => {
      const next = new Map(prev);
      const originalQuantity = parsedSnapshot?.[variantId] ?? 0;
      if (newQuantity === originalQuantity) {
        next.delete(variantId);
      } else {
        next.set(variantId, newQuantity);
      }
      return next;
    });
  }, [parsedSnapshot]);

  const handleSave = async () => {
    if (!parsedSnapshot) return;

    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // Merge modified values with original snapshot
      const updatedInventory = { ...parsedSnapshot };
      modifiedInventory.forEach((quantity, variantId) => {
        updatedInventory[variantId] = quantity;
      });

      const response = await fetch(`/api/drops/${dropId}/inventory`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inventory: updatedInventory,
          source: 'manual',
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save inventory');
      }

      const data = await response.json();
      setModifiedInventory(new Map());
      setSuccessMessage('Inventory saved successfully');
      onInventoryUpdated(data.drop);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save inventory');
    } finally {
      setSaving(false);
    }
  };

  const handleTakeSnapshot = async () => {
    setSnapshotLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`/api/drops/${dropId}/inventory/snapshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shop }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to take snapshot');
      }

      const data = await response.json();
      setModifiedInventory(new Map());
      setVariantMetadata(new Map()); // Clear metadata to refetch
      setSuccessMessage(`New snapshot taken with ${data.variantCount} variants`);
      onInventoryUpdated(data.drop);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to take snapshot');
    } finally {
      setSnapshotLoading(false);
    }
  };

  const handleReset = async () => {
    setResetLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`/api/drops/${dropId}/inventory/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to reset inventory');
      }

      const data = await response.json();
      setModifiedInventory(new Map());
      setSuccessMessage('Inventory reset to original snapshot');
      onInventoryUpdated(data.drop);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset inventory');
    } finally {
      setResetLoading(false);
    }
  };

  const handleCSVImport = async (importedInventory: { [variantId: string]: number }) => {
    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // Merge imported values with original snapshot
      const updatedInventory = { ...parsedSnapshot, ...importedInventory };

      const response = await fetch(`/api/drops/${dropId}/inventory`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inventory: updatedInventory,
          source: 'csv',
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to import inventory');
      }

      const data = await response.json();
      setModifiedInventory(new Map());
      setCSVModalOpen(false);
      setSuccessMessage(`Imported inventory for ${Object.keys(importedInventory).length} variants`);
      onInventoryUpdated(data.drop);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import inventory');
    } finally {
      setSaving(false);
    }
  };

  const formatSnapshotTime = (dateStr: string | null) => {
    if (!dateStr) return 'Unknown';
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getSourceBadge = () => {
    switch (inventorySource) {
      case 'auto':
        return <Badge tone="success">Auto Snapshot</Badge>;
      case 'manual':
        return <Badge tone="attention">Manual Edit</Badge>;
      case 'csv':
        return <Badge tone="info">CSV Import</Badge>;
      default:
        return <Badge>No Snapshot</Badge>;
    }
  };

  return (
    <>
      <Card>
        <BlockStack gap="400">
          <div
            onClick={() => setIsExpanded(!isExpanded)}
            style={{ cursor: 'pointer' }}
          >
            <InlineStack align="space-between">
              <InlineStack gap="200" blockAlign="center">
                <Text as="h2" variant="headingMd">Inventory Management</Text>
                {getSourceBadge()}
                {snapshotTakenAt && (
                  <Text as="span" variant="bodySm" tone="subdued">
                    {formatSnapshotTime(snapshotTakenAt)}
                  </Text>
                )}
              </InlineStack>
              <Button
                variant="plain"
                icon={isExpanded ? ChevronUpIcon : ChevronDownIcon}
                accessibilityLabel={isExpanded ? 'Collapse' : 'Expand'}
              />
            </InlineStack>
          </div>

          {isExpanded && (
            <BlockStack gap="400">
              {error && (
                <Banner tone="critical" onDismiss={() => setError(null)}>
                  {error}
                </Banner>
              )}

              {successMessage && (
                <Banner tone="success" onDismiss={() => setSuccessMessage(null)}>
                  {successMessage}
                </Banner>
              )}

              {hasUnsavedChanges && (
                <Banner tone="warning">
                  You have unsaved changes. Click "Save Changes" to apply them.
                </Banner>
              )}

              <InlineStack gap="200">
                <Button
                  variant="primary"
                  onClick={handleSave}
                  loading={saving}
                  disabled={!hasUnsavedChanges || saving}
                >
                  Save Changes
                </Button>
                <Button
                  icon={ImportIcon}
                  onClick={() => setCSVModalOpen(true)}
                  disabled={saving}
                >
                  Import CSV
                </Button>
                <Button
                  icon={RefreshIcon}
                  onClick={handleTakeSnapshot}
                  loading={snapshotLoading}
                  disabled={snapshotLoading || saving}
                >
                  Take New Snapshot
                </Button>
                {hasOriginalSnapshot && (
                  <Button
                    icon={ResetIcon}
                    onClick={handleReset}
                    loading={resetLoading}
                    disabled={resetLoading || saving}
                  >
                    Reset to Original
                  </Button>
                )}
              </InlineStack>

              {metadataLoading ? (
                <div style={{ padding: '40px', textAlign: 'center' }}>
                  <Spinner size="large" />
                  <Text as="p" variant="bodySm" tone="subdued">
                    Loading inventory data...
                  </Text>
                </div>
              ) : inventoryItems.length > 0 ? (
                <InventoryTable
                  items={inventoryItems}
                  onQuantityChange={handleQuantityChange}
                  disabled={saving}
                />
              ) : (
                <Banner tone="info">
                  No inventory snapshot available. Click "Take New Snapshot" to capture current inventory levels.
                </Banner>
              )}
            </BlockStack>
          )}
        </BlockStack>
      </Card>

      <CSVImportModal
        open={csvModalOpen}
        onClose={() => setCSVModalOpen(false)}
        onImport={handleCSVImport}
        variantMetadata={variantMetadata}
        existingVariantIds={variantIds}
      />
    </>
  );
}

export default InventoryManagement;
