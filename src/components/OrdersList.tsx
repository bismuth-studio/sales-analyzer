import React, { useState, useEffect } from 'react';
import {
  Card,
  DataTable,
  Badge,
  Spinner,
  Banner,
  TextContainer,
  EmptyState,
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

  useEffect(() => {
    if (!shop) {
      setLoading(false);
      return;
    }

    fetchOrders();
  }, [shop]);

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
    const statusMap: { [key: string]: 'success' | 'warning' | 'critical' | 'info' } = {
      paid: 'success',
      pending: 'warning',
      refunded: 'critical',
      voided: 'critical',
      authorized: 'info',
    };

    return (
      <Badge status={statusMap[status] || 'info'}>
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
      <Banner status="critical" title="Error loading orders">
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

  const rows = orders.map((order) => [
    order.name,
    order.email || 'N/A',
    formatDate(order.created_at),
    `${order.currency} ${parseFloat(order.total_price).toFixed(2)}`,
    getStatusBadge(order.financial_status),
    order.line_items.length,
  ]);

  return (
    <Card>
      <TextContainer>
        <p style={{ marginBottom: '16px', fontWeight: 600 }}>
          Your Last 10 Sales ({orders.length} orders)
        </p>
      </TextContainer>
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
    </Card>
  );
};

export default OrdersList;
