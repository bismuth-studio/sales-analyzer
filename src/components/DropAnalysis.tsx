import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Page,
  Card,
  BlockStack,
  Text,
  Spinner,
  Banner,
  InlineStack,
  InlineGrid,
  Badge,
  Button,
  SkeletonBodyText,
  SkeletonDisplayText,
} from '@shopify/polaris';
import { EditIcon } from '@shopify/polaris-icons';
import OrdersListWithFilters from './OrdersListWithFilters';
import DropModal from './DropModal';
import InventoryManagement from './InventoryManagement/InventoryManagement';
import PerformanceScoreCard from './PerformanceScoreCard';
import {
  OrderDataCard,
  SummaryMetricsCard,
  PerformingProductsCard,
  SoldOutVariantsSection,
  type OrderAnalysisData,
} from './orders';
import type { DropPerformanceScore } from '../utils/dropScore';
import { useOrderAnalysis } from '../hooks/useOrderAnalysis';

interface Drop {
  id: string;
  shop: string;
  title: string;
  start_time: string;
  end_time: string;
  collection_id?: string | null;
  collection_title?: string | null;
  inventory_snapshot?: string | null; // JSON string: { [variantId: string]: number }
  snapshot_taken_at?: string | null;
  inventory_source?: 'auto' | 'manual' | 'csv' | null;
  original_inventory_snapshot?: string | null;
  created_at: string;
  updated_at: string;
}

interface DropAnalysisProps {
  shop: string;
}

function DropAnalysis({ shop }: DropAnalysisProps) {
  const { dropId } = useParams<{ dropId: string }>();
  const navigate = useNavigate();
  const [drop, setDrop] = useState<Drop | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [performanceScore, setPerformanceScore] = useState<DropPerformanceScore | null>(null);

  // Use custom hook for order analysis data
  const { orderData, isLoading: isDataLoading, handleDataCalculated } = useOrderAnalysis();

  // Reference to OrdersListWithFilters to access its methods
  const ordersListRef = useRef<{ triggerSync: () => void } | null>(null);

  const handleScoreCalculated = useCallback((score: DropPerformanceScore | null) => {
    setPerformanceScore(score);
  }, []);

  useEffect(() => {
    if (!dropId) {
      setError('No drop ID provided');
      setLoading(false);
      return;
    }

    fetchDrop();
  }, [dropId]);

  const fetchDrop = async () => {
    try {
      const response = await fetch(`/api/drops/${dropId}?shop=${encodeURIComponent(shop)}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Drop not found');
        }
        throw new Error('Failed to fetch drop');
      }
      const data = await response.json();
      setDrop(data.drop);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch drop');
    } finally {
      setLoading(false);
    }
  };

  const handleBackClick = () => {
    const searchParams = new URLSearchParams(window.location.search);
    const shopParam = searchParams.get('shop');
    navigate(`/${shopParam ? `?shop=${encodeURIComponent(shopParam)}` : ''}`);
  };

  const formatDateTime = (dateStr: string) => {
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

  const handleDropSaved = (updatedDrop: Drop) => {
    setDrop(updatedDrop);
    setEditModalOpen(false);
  };

  const getDropStatus = (drop: Drop): { status: 'success' | 'attention' | 'info'; label: string } => {
    const now = new Date();
    const start = new Date(drop.start_time);
    const end = new Date(drop.end_time);

    if (now < start) {
      return { status: 'info', label: 'Scheduled' };
    } else if (now >= start && now <= end) {
      return { status: 'attention', label: 'Active' };
    } else {
      return { status: 'success', label: 'Completed' };
    }
  };

  if (loading) {
    return (
      <Page title="Loading...">
        <div style={{ padding: '40px', textAlign: 'center' }}>
          <Spinner size="large" />
        </div>
      </Page>
    );
  }

  if (error || !drop) {
    return (
      <Page
        title="Error"
        backAction={{ content: 'Back to Dashboard', onAction: handleBackClick }}
      >
        <Banner tone="critical">
          {error || 'Drop not found'}
        </Banner>
      </Page>
    );
  }

  const status = getDropStatus(drop);

  // Extract data from orderData or use defaults
  const formatCurrency = orderData?.formatCurrency || ((amount: number) => `$${amount.toFixed(2)}`);
  const salesMetrics = orderData?.salesMetrics || {
    totalOrders: 0,
    totalItemsSold: 0,
    grossSales: 0,
    totalDiscounts: 0,
    totalRefunds: 0,
    refundedOrdersCount: 0,
    netSales: 0,
    avgOrderValue: 0,
  };
  const customerMetrics = orderData?.customerMetrics || {
    uniqueCustomers: 0,
    newCustomers: 0,
    returningCustomers: 0,
  };
  const topProductsForSummary = orderData?.topProducts || [];
  const productImages = orderData?.productImages || {};
  const soldOutVariants = orderData?.soldOutVariants || [];
  const syncStatus = orderData?.syncStatus;

  // Calculate top and worst performing products from productSummary
  const productSummary = orderData?.productSummary || [];
  const sortedByRevenue = [...productSummary].sort((a, b) => b.totalRevenue - a.totalRevenue);
  const topProducts = sortedByRevenue.slice(0, 5);
  const worstProducts = sortedByRevenue.slice(-5).reverse();

  // Loading skeleton for cards
  const LoadingSkeleton = () => (
    <Card>
      <BlockStack gap="300">
        <SkeletonDisplayText size="small" />
        <SkeletonBodyText lines={3} />
      </BlockStack>
    </Card>
  );

  return (
    <Page
      title={drop.title}
      subtitle={`${formatDateTime(drop.start_time)} - ${formatDateTime(drop.end_time)}`}
      backAction={{ content: 'Back to Dashboard', onAction: handleBackClick }}
      titleMetadata={<Badge tone={status.status}>{status.label}</Badge>}
      fullWidth
    >
      <div style={{ paddingLeft: '5%', paddingRight: '5%' }}>
        <BlockStack gap="400">
          {/* 1. Order Data Section */}
          {isDataLoading ? (
            <LoadingSkeleton />
          ) : (
            <OrderDataCard
              lastSyncAt={syncStatus?.lastSyncAt || null}
              onSync={() => ordersListRef.current?.triggerSync()}
              isSyncing={syncStatus?.status === 'syncing'}
            />
          )}

          {/* 2. Drop Performance Score Section */}
          <PerformanceScoreCard score={performanceScore} />

          {/* 3. Drop Summary and Drop Details - Two Column Layout */}
          <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
            {/* Drop Summary */}
            {isDataLoading ? (
              <LoadingSkeleton />
            ) : (
              <SummaryMetricsCard
                salesMetrics={salesMetrics}
                customerMetrics={customerMetrics}
                topProducts={topProductsForSummary}
                productImages={productImages}
                formatCurrency={formatCurrency}
              />
            )}

            {/* Drop Details */}
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between">
                  <Text as="h2" variant="headingLg">Drop details</Text>
                  <Button icon={EditIcon} onClick={() => setEditModalOpen(true)}>
                    Edit Drop
                  </Button>
                </InlineStack>
                <Text as="p" variant="bodySm" tone="subdued">
                  Basic information about your product drop
                </Text>
                <InlineStack gap="800" align="start" wrap>
                  <BlockStack gap="100">
                    <Text as="span" variant="bodySm" tone="subdued">Title</Text>
                    <Text as="span" variant="bodyMd" fontWeight="semibold">{drop.title}</Text>
                  </BlockStack>
                  <BlockStack gap="100">
                    <Text as="span" variant="bodySm" tone="subdued">Start Time</Text>
                    <Text as="span" variant="bodyMd">{formatDateTime(drop.start_time)}</Text>
                  </BlockStack>
                  <BlockStack gap="100">
                    <Text as="span" variant="bodySm" tone="subdued">End Time</Text>
                    <Text as="span" variant="bodyMd">{formatDateTime(drop.end_time)}</Text>
                  </BlockStack>
                  <BlockStack gap="100">
                    <Text as="span" variant="bodySm" tone="subdued">Collection</Text>
                    <Text as="span" variant="bodyMd">{drop.collection_title || 'All products'}</Text>
                  </BlockStack>
                  <BlockStack gap="100">
                    <Text as="span" variant="bodySm" tone="subdued">Status</Text>
                    <Badge tone={status.status}>{status.label}</Badge>
                  </BlockStack>
                  <BlockStack gap="100">
                    <Text as="span" variant="bodySm" tone="subdued">Created</Text>
                    <Text as="span" variant="bodyMd">{formatDateTime(drop.created_at)}</Text>
                  </BlockStack>
                </InlineStack>
              </BlockStack>
            </Card>
          </InlineGrid>

          {/* 4. Top Performing and Worst Performing Products - Two Column Layout */}
          <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
            {isDataLoading ? (
              <>
                <LoadingSkeleton />
                <LoadingSkeleton />
              </>
            ) : (
              <>
                <PerformingProductsCard
                  title="Top Performing products"
                  subtitle="Best selling products during this drop"
                  products={topProducts}
                  formatCurrency={formatCurrency}
                  isTop={true}
                />
                <PerformingProductsCard
                  title="Worst Performing products"
                  subtitle="Lowest selling products during this drop"
                  products={worstProducts}
                  formatCurrency={formatCurrency}
                  isTop={false}
                />
              </>
            )}
          </InlineGrid>

          {/* 5. Sold Out Variants Section */}
          {isDataLoading ? (
            <LoadingSkeleton />
          ) : (
            <SoldOutVariantsSection
              soldOutVariants={soldOutVariants}
              dropStartTime={drop.start_time}
              formatCurrency={formatCurrency}
            />
          )}

          {/* 6. Inventory Management Section */}
          <InventoryManagement
            dropId={drop.id}
            shop={shop}
            inventorySnapshot={drop.inventory_snapshot || null}
            inventorySource={drop.inventory_source || 'auto'}
            snapshotTakenAt={drop.snapshot_taken_at || null}
            hasOriginalSnapshot={!!drop.original_inventory_snapshot}
            onInventoryUpdated={handleDropSaved}
          />

          {/* 7-8. Product Sales Breakdown and Orders Section */}
          {/* OrdersListWithFilters now only renders the sections we want */}
          <OrdersListWithFilters
            shop={shop}
            dropStartTime={drop.start_time}
            dropEndTime={drop.end_time}
            inventorySnapshot={drop.inventory_snapshot}
            onScoreCalculated={handleScoreCalculated}
            onDataCalculated={handleDataCalculated}
            onMethodsReady={(methods) => {
              ordersListRef.current = methods;
            }}
            hideSections={{
              orderData: true,
              summaryMetrics: true,
              soldOutVariants: true,
              productSalesBreakdown: false,
              ordersTable: false,
            }}
          />
        </BlockStack>
      </div>

      <DropModal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        onSave={handleDropSaved}
        shop={shop}
        editingDrop={drop}
      />
    </Page>
  );
}

export default DropAnalysis;
