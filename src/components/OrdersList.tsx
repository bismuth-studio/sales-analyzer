import React, { useState, useEffect } from 'react';
import {
  Card,
  DataTable,
  Badge,
  Spinner,
  Banner,
  Text,
  EmptyState,
  BlockStack,
  InlineStack,
  Select,
  Button,
} from '@shopify/polaris';

interface Order {
  id: number;
  name: string;
  email: string;
  created_at: string;
  total_price: string;
  currency: string;
  financial_status: string;
  line_items: Array<{
    title: string;
    quantity: number;
    price: string;
  }>;
}

interface OrdersListProps {
  shop: string;
}

const OrdersList: React.FC<OrdersListProps> = ({ shop }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [sortedOrders, setSortedOrders] = useState<Order[]>([]);
  const [sortColumn, setSortColumn] = useState<number>(2); // Default to Date column
  const [sortDirection, setSortDirection] = useState<'ascending' | 'descending'>('descending');

  useEffect(() => {
    if (!shop) {
      setLoading(false);
      return;
    }

    fetchOrders();
  }, [shop]);

  useEffect(() => {
    if (orders.length > 0) {
      applySorting(sortColumn, sortDirection);
    }
  }, [orders]);

  const applySorting = (columnIndex: number, direction: 'ascending' | 'descending') => {
    const sorted = [...orders].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (columnIndex) {
        case 0: // Order
          aValue = a.name;
          bValue = b.name;
          break;
        case 1: // Customer
          aValue = a.email || '';
          bValue = b.email || '';
          break;
        case 2: // Date
          aValue = new Date(a.created_at).getTime();
          bValue = new Date(b.created_at).getTime();
          break;
        case 3: // Total
          aValue = parseFloat(a.total_price);
          bValue = parseFloat(b.total_price);
          break;
        case 4: // Status
          aValue = a.financial_status;
          bValue = b.financial_status;
          break;
        case 5: // Items
          aValue = a.line_items.length;
          bValue = b.line_items.length;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return direction === 'ascending' ? -1 : 1;
      if (aValue > bValue) return direction === 'ascending' ? 1 : -1;
      return 0;
    });

    setSortedOrders(sorted);
  };

  const handleSortChange = (value: string) => {
    const [columnStr, direction] = value.split('-');
    const columnIndex = parseInt(columnStr);
    setSortColumn(columnIndex);
    setSortDirection(direction as 'ascending' | 'descending');
    applySorting(columnIndex, direction as 'ascending' | 'descending');
  };

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await fetch(
        `/api/orders/recent?shop=${encodeURIComponent(shop)}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch orders: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        setOrders(data.orders);
      } else {
        setError(data.error || 'Failed to load orders');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while fetching orders');
      console.error('Error fetching orders:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    const statusMap: { [key: string]: 'success' | 'attention' | 'critical' | 'info' } = {
      paid: 'success',
      pending: 'attention',
      refunded: 'critical',
      voided: 'critical',
      authorized: 'info',
    };

    return (
      <Badge tone={statusMap[status] || 'info'}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  if (loading) {
    return (
      <Card>
        <div style={{ padding: '40px', textAlign: 'center' }}>
          <Spinner size="large" />
          <p style={{ marginTop: '16px' }}>Loading your recent sales...</p>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Banner tone="critical" title="Error loading orders">
        <p>{error}</p>
      </Banner>
    );
  }

  if (!shop) {
    return (
      <Card>
        <EmptyState
          heading="Shop parameter missing"
          image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
        >
          <p>Please install the app from your Shopify admin to view your sales data.</p>
        </EmptyState>
      </Card>
    );
  }

  if (orders.length === 0) {
    return (
      <Card>
        <EmptyState
          heading="No orders found"
          image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
        >
          <p>You don't have any orders yet. Once you make sales, they'll appear here.</p>
        </EmptyState>
      </Card>
    );
  }

  const rows = sortedOrders.map((order) => [
    order.name,
    order.email || 'N/A',
    formatDate(order.created_at),
    parseFloat(order.total_price).toFixed(2),
    getStatusBadge(order.financial_status),
    order.line_items.length,
  ]);

  const sortOptions = [
    { label: 'Date (Newest first)', value: '2-descending' },
    { label: 'Date (Oldest first)', value: '2-ascending' },
    { label: 'Order (A-Z)', value: '0-ascending' },
    { label: 'Order (Z-A)', value: '0-descending' },
    { label: 'Customer (A-Z)', value: '1-ascending' },
    { label: 'Customer (Z-A)', value: '1-descending' },
    { label: 'Total (Low to High)', value: '3-ascending' },
    { label: 'Total (High to Low)', value: '3-descending' },
    { label: 'Status (A-Z)', value: '4-ascending' },
    { label: 'Status (Z-A)', value: '4-descending' },
    { label: 'Items (Fewest first)', value: '5-ascending' },
    { label: 'Items (Most first)', value: '5-descending' },
  ];

  return (
    <Card>
      <BlockStack gap="400">
        <InlineStack align="space-between" blockAlign="center">
          <Text as="p" variant="bodyMd" fontWeight="semibold">
            Your Last 10 Sales ({orders.length} orders)
          </Text>
          <Select
            label="Sort by"
            labelInline
            options={sortOptions}
            value={`${sortColumn}-${sortDirection}`}
            onChange={handleSortChange}
          />
        </InlineStack>
        <DataTable
          columnContentTypes={['text', 'text', 'text', 'numeric', 'text', 'numeric']}
          headings={[
            'Order',
            'Customer',
            'Date',
            'Total',
            'Status',
            'Items',
          ]}
          rows={rows}
        />
      </BlockStack>
    </Card>
  );
};

export default OrdersList;
