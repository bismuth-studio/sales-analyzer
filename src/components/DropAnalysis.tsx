import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Page,
  Card,
  BlockStack,
  Text,
  Spinner,
  Banner,
  InlineStack,
  Badge,
  Button,
} from '@shopify/polaris';
import { EditIcon } from '@shopify/polaris-icons';
import OrdersListWithFilters from './OrdersListWithFilters';
import DropModal from './DropModal';

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
      const response = await fetch(`/api/drops/${dropId}`);
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
          <Card>
            <BlockStack gap="300">
              <InlineStack align="space-between">
                <Text as="h2" variant="headingMd">Drop Details</Text>
                <Button icon={EditIcon} onClick={() => setEditModalOpen(true)}>
                  Edit Drop
                </Button>
              </InlineStack>
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

          <OrdersListWithFilters
            shop={shop}
            dropStartTime={drop.start_time}
            dropEndTime={drop.end_time}
            inventorySnapshot={drop.inventory_snapshot}
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
