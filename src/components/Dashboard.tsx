import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  IndexTable,
  Text,
  Button,
  Badge,
  BlockStack,
  InlineStack,
  EmptyState,
  Spinner,
  Banner,
} from '@shopify/polaris';
import { PlusIcon } from '@shopify/polaris-icons';
import { useNavigate } from 'react-router-dom';
import DropModal from './DropModal';
import OrdersListWithFilters from './OrdersListWithFilters';
import { formatCurrency } from '../utils/formatting';

interface Drop {
  id: string;
  shop: string;
  title: string;
  start_time: string;
  end_time: string;
  collection_id?: string | null;
  collection_title?: string | null;
  cached_net_sales?: number | null;
  cached_order_count?: number | null;
  cached_gross_sales?: number | null;
  cached_discounts?: number | null;
  cached_refunds?: number | null;
  metrics_last_updated?: string | null;
  created_at: string;
  updated_at: string;
}

interface DashboardProps {
  shop: string;
}

type SortKey = 'title' | 'start_time' | 'end_time' | 'collection_title';

function Dashboard({ shop }: DashboardProps) {
  const navigate = useNavigate();
  const [drops, setDrops] = useState<Drop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDrop, setEditingDrop] = useState<Drop | null>(null);
  const [initialDropValues, setInitialDropValues] = useState<{
    startDate: string;
    startTime: string;
    endDate: string;
    endTime: string;
  } | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('start_time');
  const [sortDirection, setSortDirection] = useState<'ascending' | 'descending'>('descending');

  const fetchDrops = useCallback(async () => {
    if (!shop) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/drops?shop=${encodeURIComponent(shop)}`);
      if (!response.ok) {
        throw new Error('Failed to fetch drops');
      }
      const data = await response.json();
      const drops = data.drops || [];
      setDrops(drops);

      // Check if any drops are missing cached metrics
      const missingMetrics = drops.some((drop: Drop) =>
        drop.cached_net_sales === null || drop.cached_net_sales === undefined
      );

      // If metrics are missing, trigger a refresh in the background
      if (missingMetrics && drops.length > 0) {
        console.log('Some drops missing cached metrics, triggering refresh...');
        fetch(`/api/drops/refresh-metrics?shop=${encodeURIComponent(shop)}`, {
          method: 'POST',
        })
          .then(() => {
            console.log('Metrics refresh completed, reloading drops...');
            // Reload drops to get the updated metrics
            return fetch(`/api/drops?shop=${encodeURIComponent(shop)}`);
          })
          .then(response => response.json())
          .then(data => setDrops(data.drops || []))
          .catch(err => console.error('Error refreshing metrics:', err));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch drops');
    } finally {
      setLoading(false);
    }
  }, [shop]);

  useEffect(() => {
    fetchDrops();
  }, [fetchDrops]);

  const handleSort = useCallback(
    (key: SortKey) => {
      if (sortKey === key) {
        setSortDirection(sortDirection === 'ascending' ? 'descending' : 'ascending');
      } else {
        setSortKey(key);
        setSortDirection('descending');
      }
    },
    [sortKey, sortDirection]
  );

  const sortedDrops = [...drops].sort((a, b) => {
    let comparison = 0;
    const aVal = a[sortKey] || '';
    const bVal = b[sortKey] || '';

    if (sortKey === 'start_time' || sortKey === 'end_time') {
      comparison = new Date(aVal).getTime() - new Date(bVal).getTime();
    } else {
      comparison = String(aVal).localeCompare(String(bVal));
    }

    return sortDirection === 'ascending' ? comparison : -comparison;
  });

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

  const handleCreateDrop = () => {
    setEditingDrop(null);
    setInitialDropValues(null);
    setModalOpen(true);
  };

  const handleCreateDropFromExplorer = (startDate: string, startTime: string, endDate: string, endTime: string) => {
    setEditingDrop(null);
    setInitialDropValues({ startDate, startTime, endDate, endTime });
    setModalOpen(true);
  };

  const handleEditDrop = (drop: Drop) => {
    setEditingDrop(drop);
    setModalOpen(true);
  };

  const handleRowClick = (dropId: string) => {
    const searchParams = new URLSearchParams(window.location.search);
    const shopParam = searchParams.get('shop');
    navigate(`/drop/${dropId}${shopParam ? `?shop=${encodeURIComponent(shopParam)}` : ''}`);
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setEditingDrop(null);
    setInitialDropValues(null);
  };

  const handleDropSaved = (drop: Drop, isNew: boolean) => {
    if (isNew) {
      // Navigate to the new drop's analysis page
      const searchParams = new URLSearchParams(window.location.search);
      const shopParam = searchParams.get('shop');
      navigate(`/drop/${drop.id}${shopParam ? `?shop=${encodeURIComponent(shopParam)}` : ''}`);
    } else {
      // Refresh the drops list
      fetchDrops();
    }
    setModalOpen(false);
    setEditingDrop(null);
  };

  const handleDeleteDrop = async (dropId: string) => {
    try {
      const response = await fetch(`/api/drops/${dropId}?shop=${encodeURIComponent(shop)}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete drop');
      }
      fetchDrops();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete drop');
    }
  };

  if (!shop) {
    return (
      <Card>
        <EmptyState
          heading="Shop not detected"
          image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
        >
          <p>Please access this app through your Shopify admin.</p>
        </EmptyState>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <div style={{ padding: '40px', textAlign: 'center' }}>
          <Spinner size="large" />
          <div style={{ marginTop: '16px' }}>
            <Text as="p" tone="subdued">Loading drops...</Text>
          </div>
        </div>
      </Card>
    );
  }

  const resourceName = {
    singular: 'drop',
    plural: 'drops',
  };

  const rowMarkup = sortedDrops.map((drop, index) => {
    const status = getDropStatus(drop);
    return (
      <IndexTable.Row
        id={drop.id}
        key={drop.id}
        position={index}
        onClick={() => handleRowClick(drop.id)}
      >
        <IndexTable.Cell>
          <Text variant="bodyMd" fontWeight="bold" as="span">
            {drop.title}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>{formatDateTime(drop.start_time)}</IndexTable.Cell>
        <IndexTable.Cell>{formatDateTime(drop.end_time)}</IndexTable.Cell>
        <IndexTable.Cell>
          {drop.collection_title || <Text as="span" tone="subdued">All products</Text>}
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text variant="bodyMd" fontWeight="semibold" as="span">
            {drop.cached_net_sales !== null && drop.cached_net_sales !== undefined
              ? formatCurrency(drop.cached_net_sales)
              : <Text as="span" tone="subdued">—</Text>}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          {drop.cached_order_count !== null && drop.cached_order_count !== undefined
            ? drop.cached_order_count
            : <Text as="span" tone="subdued">—</Text>}
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Badge tone={status.status}>{status.label}</Badge>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <div onClick={(e) => e.stopPropagation()}>
            <InlineStack gap="200">
              <Button
                size="slim"
                onClick={() => {
                  handleEditDrop(drop);
                }}
              >
                Edit
              </Button>
              <Button
                size="slim"
                tone="critical"
                onClick={() => {
                  if (confirm('Are you sure you want to delete this drop?')) {
                    handleDeleteDrop(drop.id);
                  }
                }}
              >
                Delete
              </Button>
            </InlineStack>
          </div>
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  return (
    <BlockStack gap="400">
      {error && (
        <Banner tone="critical" onDismiss={() => setError(null)}>
          {error}
        </Banner>
      )}

      <Card>
        <BlockStack gap="400">
          <InlineStack align="space-between">
            <Text as="h2" variant="headingMd">Your Drops</Text>
            <Button variant="primary" icon={PlusIcon} onClick={handleCreateDrop}>
              New Drop
            </Button>
          </InlineStack>

          {drops.length === 0 ? (
            <EmptyState
              heading="No drops yet"
              action={{ content: 'Create your first drop', onAction: handleCreateDrop }}
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
            >
              <p>Create a drop to start tracking sales for specific time periods.</p>
            </EmptyState>
          ) : (
            <IndexTable
              resourceName={resourceName}
              itemCount={sortedDrops.length}
              headings={[
                { title: 'Title' },
                { title: 'Start Time' },
                { title: 'End Time' },
                { title: 'Collection' },
                { title: 'Net Sales' },
                { title: 'Orders' },
                { title: 'Status' },
                { title: 'Actions' },
              ]}
              selectable={false}
              sortable={[true, true, true, true, false, false, false, false]}
              sortDirection={sortDirection}
              sortColumnIndex={['title', 'start_time', 'end_time', 'collection_title'].indexOf(sortKey)}
              onSort={(headingIndex) => {
                const keys: SortKey[] = ['title', 'start_time', 'end_time', 'collection_title'];
                if (headingIndex < keys.length) {
                  handleSort(keys[headingIndex]);
                }
              }}
            >
              {rowMarkup}
            </IndexTable>
          )}
        </BlockStack>
      </Card>

      <DropModal
        open={modalOpen}
        onClose={handleModalClose}
        onSave={handleDropSaved}
        shop={shop}
        editingDrop={editingDrop}
        initialValues={initialDropValues}
      />

      {/* Order Explorer Section */}
      <OrdersListWithFilters shop={shop} onCreateDrop={handleCreateDropFromExplorer} />
    </BlockStack>
  );
}

export default Dashboard;
