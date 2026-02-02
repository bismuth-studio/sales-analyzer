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
} from '@shopify/polaris';
import { ArrowLeftIcon } from '@shopify/polaris-icons';
import OrdersListWithFilters from './OrdersListWithFilters';

interface Drop {
  id: string;
  shop: string;
  title: string;
  start_time: string;
  end_time: string;
  collection_id?: string | null;
  collection_title?: string | null;
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
            <BlockStack gap="200">
              <InlineStack gap="400" align="start">
                <BlockStack gap="100">
                  <Text as="span" variant="bodySm" tone="subdued">Time Range</Text>
                  <Text as="span" variant="bodyMd">
                    {formatDateTime(drop.start_time)} — {formatDateTime(drop.end_time)}
                  </Text>
                </BlockStack>
                {drop.collection_title && (
                  <BlockStack gap="100">
                    <Text as="span" variant="bodySm" tone="subdued">Collection</Text>
                    <Text as="span" variant="bodyMd">{drop.collection_title}</Text>
                  </BlockStack>
                )}
              </InlineStack>
            </BlockStack>
          </Card>

          <OrdersListWithFilters
            shop={shop}
            dropStartTime={drop.start_time}
            dropEndTime={drop.end_time}
          />
        </BlockStack>
      </div>
    </Page>
  );
}

export default DropAnalysis;
