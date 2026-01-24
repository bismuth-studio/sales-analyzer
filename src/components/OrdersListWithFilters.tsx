import React, { useState, useEffect, useCallback } from 'react';
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
  Link,
  Filters,
  ChoiceList,
  TextField,
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
    id: number;
    title: string;
    quantity: number;
    price: string;
    variant_title: string | null;
    sku: string | null;
    product_id: number;
    variant_id: number;
    vendor: string | null;
    product_type: string | null;
  }>;
}

interface ProductSummary {
  productId: number;
  variantId: number;
  productName: string;
  variantName: string;
  sku: string;
  unitsSold: number;
  totalRevenue: number;
  currency: string;
  vendor: string;
  productType: string;
  imageUrl?: string;
}

interface OrdersListProps {
  shop: string;
}

const OrdersListWithFilters: React.FC<OrdersListProps> = ({ shop }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [sortedOrders, setSortedOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [sortColumn, setSortColumn] = useState<number>(3); // Default to Date column
  const [sortDirection, setSortDirection] = useState<'ascending' | 'descending'>('descending');

  // Product summary states
  const [productSummary, setProductSummary] = useState<ProductSummary[]>([]);
  const [productSortColumn, setProductSortColumn] = useState<number>(6); // Default to Units Sold
  const [productSortDirection, setProductSortDirection] = useState<'ascending' | 'descending'>('descending');

  // Filter states for Polaris Filters component
  const [queryValue, setQueryValue] = useState<string>('');
  const [dateRange, setDateRange] = useState<string[]>([]);
  const [orderStatus, setOrderStatus] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState<string[]>([]);
  const [dayOfWeek, setDayOfWeek] = useState<string[]>([]);

  // Additional filter states
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [startTime, setStartTime] = useState<string>('');
  const [endTime, setEndTime] = useState<string>('');

  useEffect(() => {
    if (!shop) {
      setLoading(false);
      return;
    }

    fetchOrders();
  }, [shop]);

  useEffect(() => {
    applyFilters();
  }, [orders, queryValue, dateRange, orderStatus, priceRange, dayOfWeek, startDate, endDate, minPrice, maxPrice, startTime, endTime]);

  useEffect(() => {
    if (filteredOrders.length >= 0) {
      applySorting(sortColumn, sortDirection);
    }
  }, [filteredOrders, sortColumn, sortDirection]);

  const applyFilters = () => {
    let filtered = [...orders];

    // Apply search query
    if (queryValue) {
      const query = queryValue.toLowerCase();
      filtered = filtered.filter(order =>
        order.name.toLowerCase().includes(query) ||
        (order.email && order.email.toLowerCase().includes(query))
      );
    }

    // Apply date range filter
    if (dateRange.length > 0) {
      const now = new Date();
      let startOfPeriod = new Date();

      dateRange.forEach(preset => {
        switch (preset) {
          case 'today':
            startOfPeriod.setHours(0, 0, 0, 0);
            filtered = filtered.filter(order => new Date(order.created_at) >= startOfPeriod);
            break;
          case 'yesterday':
            startOfPeriod.setDate(now.getDate() - 1);
            startOfPeriod.setHours(0, 0, 0, 0);
            const endOfYesterday = new Date(startOfPeriod);
            endOfYesterday.setHours(23, 59, 59, 999);
            filtered = filtered.filter(order => {
              const orderDate = new Date(order.created_at);
              return orderDate >= startOfPeriod && orderDate <= endOfYesterday;
            });
            break;
          case 'last7days':
            startOfPeriod.setDate(now.getDate() - 7);
            filtered = filtered.filter(order => new Date(order.created_at) >= startOfPeriod);
            break;
          case 'last30days':
            startOfPeriod.setDate(now.getDate() - 30);
            filtered = filtered.filter(order => new Date(order.created_at) >= startOfPeriod);
            break;
          case 'thisweek':
            const dayOfWeek = now.getDay();
            startOfPeriod.setDate(now.getDate() - dayOfWeek);
            startOfPeriod.setHours(0, 0, 0, 0);
            filtered = filtered.filter(order => new Date(order.created_at) >= startOfPeriod);
            break;
          case 'thismonth':
            startOfPeriod = new Date(now.getFullYear(), now.getMonth(), 1);
            filtered = filtered.filter(order => new Date(order.created_at) >= startOfPeriod);
            break;
          case 'custom':
            if (startDate) {
              const start = new Date(startDate);
              start.setHours(0, 0, 0, 0);
              filtered = filtered.filter(order => new Date(order.created_at) >= start);
            }
            if (endDate) {
              const end = new Date(endDate);
              end.setHours(23, 59, 59, 999);
              filtered = filtered.filter(order => new Date(order.created_at) <= end);
            }
            break;
        }
      });
    }

    // Apply status filter
    if (orderStatus.length > 0) {
      filtered = filtered.filter(order => orderStatus.includes(order.financial_status));
    }

    // Apply price range
    if (priceRange.includes('custom')) {
      if (minPrice) {
        const min = parseFloat(minPrice);
        filtered = filtered.filter(order => parseFloat(order.total_price) >= min);
      }
      if (maxPrice) {
        const max = parseFloat(maxPrice);
        filtered = filtered.filter(order => parseFloat(order.total_price) <= max);
      }
    }

    // Apply day of week filter
    if (dayOfWeek.length > 0) {
      filtered = filtered.filter(order => {
        const orderDate = new Date(order.created_at);
        const day = orderDate.getDay().toString();
        return dayOfWeek.includes(day);
      });
    }

    // Apply time range (custom only)
    if (startTime || endTime) {
      filtered = filtered.filter(order => {
        const orderDate = new Date(order.created_at);
        const orderHour = orderDate.getHours();
        const orderMinute = orderDate.getMinutes();
        const orderTimeInMinutes = orderHour * 60 + orderMinute;

        if (startTime) {
          const [startHour, startMin] = startTime.split(':').map(Number);
          const startTimeInMinutes = startHour * 60 + startMin;
          if (orderTimeInMinutes < startTimeInMinutes) return false;
        }

        if (endTime) {
          const [endHour, endMin] = endTime.split(':').map(Number);
          const endTimeInMinutes = endHour * 60 + endMin;
          if (orderTimeInMinutes > endTimeInMinutes) return false;
        }

        return true;
      });
    }

    setFilteredOrders(filtered);
  };

  const applySorting = (columnIndex: number, direction: 'ascending' | 'descending') => {
    const sorted = [...filteredOrders].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (columnIndex) {
        case 0: // Row index (not sortable)
          return 0;
        case 1: // Order
          aValue = a.name;
          bValue = b.name;
          break;
        case 2: // Customer
          aValue = a.email || '';
          bValue = b.email || '';
          break;
        case 3: // Date
          aValue = new Date(a.created_at).getTime();
          bValue = new Date(b.created_at).getTime();
          break;
        case 4: // Total
          aValue = parseFloat(a.total_price);
          bValue = parseFloat(b.total_price);
          break;
        case 5: // Status
          aValue = a.financial_status;
          bValue = b.financial_status;
          break;
        case 6: // Items
          aValue = a.line_items.length;
          bValue = b.line_items.length;
          break;
        case 7: // Total Units
          aValue = a.line_items.reduce((sum, item) => sum + item.quantity, 0);
          bValue = b.line_items.reduce((sum, item) => sum + item.quantity, 0);
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

  const handleQueryValueRemove = useCallback(() => setQueryValue(''), []);
  const handleFiltersClearAll = useCallback(() => {
    setQueryValue('');
    setDateRange([]);
    setOrderStatus([]);
    setPriceRange([]);
    setDayOfWeek([]);
    setStartDate('');
    setEndDate('');
    setMinPrice('');
    setMaxPrice('');
    setStartTime('');
    setEndTime('');
  }, []);

  // Generate product summary from filtered orders
  const generateProductSummary = useCallback(() => {
    const productMap = new Map<string, ProductSummary>();

    filteredOrders.forEach((order) => {
      if (!order.line_items || order.line_items.length === 0) {
        return;
      }

      order.line_items.forEach((item) => {
        // Use title as the unique key since product_id might be null
        const key = item.title;

        if (productMap.has(key)) {
          const existing = productMap.get(key)!;
          existing.unitsSold += item.quantity;
          existing.totalRevenue += parseFloat(item.price) * item.quantity;
        } else {
          productMap.set(key, {
            productId: item.product_id,
            variantId: item.variant_id,
            productName: item.title,
            variantName: item.variant_title || '',
            sku: item.sku || '',
            unitsSold: item.quantity,
            totalRevenue: parseFloat(item.price) * item.quantity,
            currency: order.currency,
            vendor: item.vendor || '',
            productType: item.product_type || '',
          });
        }
      });
    });

    const summary = Array.from(productMap.values());
    setProductSummary(summary);
  }, [filteredOrders]);

  // Update product summary when filtered orders change
  useEffect(() => {
    generateProductSummary();
  }, [generateProductSummary]);

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

  const getOrderLink = (order: Order) => {
    const shopName = shop.replace('.myshopify.com', '');
    return `https://admin.shopify.com/store/${shopName}/orders/${order.id}`;
  };

  const rows = sortedOrders.map((order, index) => [
    index + 1,
    <Link url={getOrderLink(order)} target="_blank" removeUnderline>
      {order.name}
    </Link>,
    order.email || 'N/A',
    formatDate(order.created_at),
    parseFloat(order.total_price).toFixed(2),
    getStatusBadge(order.financial_status),
    order.line_items.length,
    order.line_items.reduce((sum, item) => sum + item.quantity, 0),
  ]);

  // Sort product summary
  const sortedProductSummary = [...productSummary].sort((a, b) => {
    let aValue: any;
    let bValue: any;
    const direction = productSortDirection;

    switch (productSortColumn) {
      case 0: // Row index (not sortable)
        return 0;
      case 1: // Product name
        aValue = a.productName.toLowerCase();
        bValue = b.productName.toLowerCase();
        break;
      case 2: // Product type
        aValue = a.productType.toLowerCase();
        bValue = b.productType.toLowerCase();
        break;
      case 3: // Vendor
        aValue = a.vendor.toLowerCase();
        bValue = b.vendor.toLowerCase();
        break;
      case 4: // Variant name
        aValue = a.variantName.toLowerCase();
        bValue = b.variantName.toLowerCase();
        break;
      case 5: // SKU
        aValue = a.sku.toLowerCase();
        bValue = b.sku.toLowerCase();
        break;
      case 6: // Units sold
        aValue = a.unitsSold;
        bValue = b.unitsSold;
        break;
      case 7: // Total revenue
        aValue = a.totalRevenue;
        bValue = b.totalRevenue;
        break;
      default:
        return 0;
    }

    if (aValue < bValue) return direction === 'ascending' ? -1 : 1;
    if (aValue > bValue) return direction === 'ascending' ? 1 : -1;
    return 0;
  });

  const productRows = sortedProductSummary.map((product, index) => [
    index + 1,
    product.productName,
    product.productType || 'N/A',
    product.vendor || 'N/A',
    product.variantName || 'Default',
    product.sku || 'N/A',
    product.unitsSold,
    `${product.currency} ${product.totalRevenue.toFixed(2)}`,
  ]);

  const handleProductSortChange = (value: string) => {
    const [columnStr, direction] = value.split('-');
    setProductSortColumn(parseInt(columnStr));
    setProductSortDirection(direction as 'ascending' | 'descending');
  };

  const sortOptions = [
    { label: 'Date (Newest first)', value: '3-descending' },
    { label: 'Date (Oldest first)', value: '3-ascending' },
    { label: 'Order (A-Z)', value: '1-ascending' },
    { label: 'Order (Z-A)', value: '1-descending' },
    { label: 'Customer (A-Z)', value: '2-ascending' },
    { label: 'Customer (Z-A)', value: '2-descending' },
    { label: 'Total (Low to High)', value: '4-ascending' },
    { label: 'Total (High to Low)', value: '4-descending' },
    { label: 'Status (A-Z)', value: '5-ascending' },
    { label: 'Status (Z-A)', value: '5-descending' },
    { label: 'Items (Fewest first)', value: '6-ascending' },
    { label: 'Items (Most first)', value: '6-descending' },
    { label: 'Total Units (Least first)', value: '7-ascending' },
    { label: 'Total Units (Most first)', value: '7-descending' },
  ];

  const filters = [
    {
      key: 'dateRange',
      label: 'Date range',
      filter: (
        <ChoiceList
          title="Date range"
          titleHidden
          choices={[
            { label: 'Today', value: 'today' },
            { label: 'Yesterday', value: 'yesterday' },
            { label: 'Last 7 days', value: 'last7days' },
            { label: 'Last 30 days', value: 'last30days' },
            { label: 'This week', value: 'thisweek' },
            { label: 'This month', value: 'thismonth' },
            { label: 'Custom range', value: 'custom' },
          ]}
          selected={dateRange}
          onChange={setDateRange}
          allowMultiple
        />
      ),
      shortcut: true,
    },
    {
      key: 'orderStatus',
      label: 'Order status',
      filter: (
        <ChoiceList
          title="Order status"
          titleHidden
          choices={[
            { label: 'Paid', value: 'paid' },
            { label: 'Pending', value: 'pending' },
            { label: 'Authorized', value: 'authorized' },
            { label: 'Refunded', value: 'refunded' },
            { label: 'Voided', value: 'voided' },
          ]}
          selected={orderStatus}
          onChange={setOrderStatus}
          allowMultiple
        />
      ),
      shortcut: true,
    },
    {
      key: 'dayOfWeek',
      label: 'Day of week',
      filter: (
        <ChoiceList
          title="Day of week"
          titleHidden
          choices={[
            { label: 'Sunday', value: '0' },
            { label: 'Monday', value: '1' },
            { label: 'Tuesday', value: '2' },
            { label: 'Wednesday', value: '3' },
            { label: 'Thursday', value: '4' },
            { label: 'Friday', value: '5' },
            { label: 'Saturday', value: '6' },
          ]}
          selected={dayOfWeek}
          onChange={setDayOfWeek}
          allowMultiple
        />
      ),
    },
    {
      key: 'priceRange',
      label: 'Price range',
      filter: (
        <BlockStack gap="200">
          <ChoiceList
            title="Price range"
            titleHidden
            choices={[{ label: 'Custom range', value: 'custom' }]}
            selected={priceRange}
            onChange={setPriceRange}
          />
          {priceRange.includes('custom') && (
            <InlineStack gap="200">
              <TextField
                label="Min price"
                type="number"
                value={minPrice}
                onChange={setMinPrice}
                prefix="$"
                autoComplete="off"
                labelHidden
                placeholder="Min"
              />
              <TextField
                label="Max price"
                type="number"
                value={maxPrice}
                onChange={setMaxPrice}
                prefix="$"
                autoComplete="off"
                labelHidden
                placeholder="Max"
              />
            </InlineStack>
          )}
        </BlockStack>
      ),
    },
    {
      key: 'timeRange',
      label: 'Time of day',
      filter: (
        <InlineStack gap="200">
          <TextField
            label="Start time"
            type="time"
            value={startTime}
            onChange={setStartTime}
            autoComplete="off"
            placeholder="Start"
          />
          <TextField
            label="End time"
            type="time"
            value={endTime}
            onChange={setEndTime}
            autoComplete="off"
            placeholder="End"
          />
        </InlineStack>
      ),
    },
  ];

  // Build applied filters for display
  const appliedFilters = [];

  // Date range filters
  if (dateRange.length > 0) {
    dateRange.forEach(range => {
      const labels: { [key: string]: string } = {
        today: 'Today',
        yesterday: 'Yesterday',
        last7days: 'Last 7 days',
        last30days: 'Last 30 days',
        thisweek: 'This week',
        thismonth: 'This month',
        custom: startDate && endDate ? `${startDate} to ${endDate}` : 'Custom date range',
      };

      appliedFilters.push({
        key: `dateRange-${range}`,
        label: labels[range] || range,
        onRemove: () => {
          setDateRange(dateRange.filter(d => d !== range));
          if (range === 'custom') {
            setStartDate('');
            setEndDate('');
          }
        },
      });
    });
  }

  // Order status filters
  if (orderStatus.length > 0) {
    orderStatus.forEach(status => {
      const labels: { [key: string]: string } = {
        paid: 'Paid',
        pending: 'Pending',
        authorized: 'Authorized',
        refunded: 'Refunded',
        voided: 'Voided',
      };

      appliedFilters.push({
        key: `status-${status}`,
        label: labels[status] || status,
        onRemove: () => setOrderStatus(orderStatus.filter(s => s !== status)),
      });
    });
  }

  // Day of week filters
  if (dayOfWeek.length > 0) {
    const dayLabels: { [key: string]: string } = {
      '0': 'Sunday',
      '1': 'Monday',
      '2': 'Tuesday',
      '3': 'Wednesday',
      '4': 'Thursday',
      '5': 'Friday',
      '6': 'Saturday',
    };

    dayOfWeek.forEach(day => {
      appliedFilters.push({
        key: `day-${day}`,
        label: dayLabels[day] || day,
        onRemove: () => setDayOfWeek(dayOfWeek.filter(d => d !== day)),
      });
    });
  }

  // Price range filter
  if (priceRange.includes('custom') && (minPrice || maxPrice)) {
    let priceLabel = 'Price: ';
    if (minPrice && maxPrice) {
      priceLabel += `$${minPrice} - $${maxPrice}`;
    } else if (minPrice) {
      priceLabel += `$${minPrice}+`;
    } else if (maxPrice) {
      priceLabel += `up to $${maxPrice}`;
    }

    appliedFilters.push({
      key: 'priceRange',
      label: priceLabel,
      onRemove: () => {
        setPriceRange([]);
        setMinPrice('');
        setMaxPrice('');
      },
    });
  }

  // Time range filter
  if (startTime || endTime) {
    let timeLabel = 'Time: ';
    if (startTime && endTime) {
      timeLabel += `${startTime} - ${endTime}`;
    } else if (startTime) {
      timeLabel += `after ${startTime}`;
    } else if (endTime) {
      timeLabel += `before ${endTime}`;
    }

    appliedFilters.push({
      key: 'timeRange',
      label: timeLabel,
      onRemove: () => {
        setStartTime('');
        setEndTime('');
      },
    });
  }

  return (
    <>
      <Card>
        <BlockStack gap="400">
          <Text as="h2" variant="headingMd">
            Orders
          </Text>
          <InlineStack align="space-between" blockAlign="center">
            <Text as="p" variant="bodyMd" fontWeight="semibold">
              Your Last 50 Sales ({sortedOrders.length} of {orders.length} orders)
            </Text>
            <Select
              label="Sort by"
              labelInline
              options={sortOptions}
              value={`${sortColumn}-${sortDirection}`}
              onChange={handleSortChange}
            />
          </InlineStack>

          <Filters
            queryValue={queryValue}
            filters={filters}
            appliedFilters={appliedFilters}
            onQueryChange={setQueryValue}
            onQueryClear={handleQueryValueRemove}
            onClearAll={handleFiltersClearAll}
            queryPlaceholder="Search by order number or customer email"
          />

          {dateRange.includes('custom') && (
            <InlineStack gap="200">
              <TextField
                label="Start date"
                type="date"
                value={startDate}
                onChange={setStartDate}
                autoComplete="off"
              />
              <TextField
                label="End date"
                type="date"
                value={endDate}
                onChange={setEndDate}
                autoComplete="off"
              />
            </InlineStack>
          )}

          <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
            <DataTable
              columnContentTypes={['numeric', 'text', 'text', 'text', 'numeric', 'text', 'numeric', 'numeric']}
              headings={[
                '#',
                'Order',
                'Customer',
                'Date',
                'Total',
                'Status',
                'Items',
                'Total Units',
              ]}
              rows={rows}
            />
          </div>
        </BlockStack>
      </Card>

      {productSummary.length > 0 && (
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">
              Product Summary
            </Text>
            <InlineStack align="space-between" blockAlign="center">
              <Text as="p" variant="bodyMd" fontWeight="semibold">
                {productSummary.length} products from {sortedOrders.length} orders
              </Text>
              <Select
                label="Sort by"
                labelInline
                options={[
                  { label: 'Units Sold (Most first)', value: '6-descending' },
                  { label: 'Units Sold (Least first)', value: '6-ascending' },
                  { label: 'Revenue (High to Low)', value: '7-descending' },
                  { label: 'Revenue (Low to High)', value: '7-ascending' },
                  { label: 'Product Name (A-Z)', value: '1-ascending' },
                  { label: 'Product Name (Z-A)', value: '1-descending' },
                  { label: 'Type (A-Z)', value: '2-ascending' },
                  { label: 'Type (Z-A)', value: '2-descending' },
                  { label: 'Vendor (A-Z)', value: '3-ascending' },
                  { label: 'Vendor (Z-A)', value: '3-descending' },
                  { label: 'Variant (A-Z)', value: '4-ascending' },
                  { label: 'Variant (Z-A)', value: '4-descending' },
                  { label: 'SKU (A-Z)', value: '5-ascending' },
                  { label: 'SKU (Z-A)', value: '5-descending' },
                ]}
                value={`${productSortColumn}-${productSortDirection}`}
                onChange={handleProductSortChange}
              />
            </InlineStack>

            <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
              <DataTable
                columnContentTypes={['numeric', 'text', 'text', 'text', 'text', 'text', 'numeric', 'numeric']}
                headings={[
                  '#',
                  'Product Name',
                  'Type',
                  'Vendor',
                  'Variant',
                  'SKU',
                  'Units Sold',
                  'Total Revenue',
                ]}
                rows={productRows}
              />
            </div>
          </BlockStack>
        </Card>
      )}
    </>
  );
};

export default OrdersListWithFilters;
