import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  IndexTable,
  Badge,
  Spinner,
  Banner,
  Text,
  EmptyState,
  BlockStack,
  InlineStack,
  Link,
  Tabs,
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
  tags: string;
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
  color: string;
  size: string;
  sku: string;
  unitsSold: number;
  remainingInventory: number;
  totalRevenue: number;
  currency: string;
  sellThroughRate: number;
  revenuePercentage: number;
  imageUrl?: string;
}

interface AggregatedProductSummary {
  productId: number;
  productName: string;
  unitsSold: number;
  remainingInventory: number;
  totalRevenue: number;
  currency: string;
  sellThroughRate: number;
  revenuePercentage: number;
  imageUrl?: string;
}

interface VendorSummary {
  vendor: string;
  productCount: number;
  unitsSold: number;
  totalRevenue: number;
  currency: string;
  revenuePercentage: number;
}

interface OrdersListProps {
  shop: string;
  dropStartTime?: string;
  dropEndTime?: string;
}

const OrdersListWithFilters: React.FC<OrdersListProps> = ({ shop, dropStartTime, dropEndTime }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [sortedOrders, setSortedOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [sortColumn, setSortColumn] = useState<number>(3); // Default to Date column
  const [sortDirection, setSortDirection] = useState<'ascending' | 'descending'>('descending');

  // Product summary states
  const [productSummary, setProductSummary] = useState<ProductSummary[]>([]);
  const [productSortColumn, setProductSortColumn] = useState<number>(5); // Default to Units Sold
  const [productSortDirection, setProductSortDirection] = useState<'ascending' | 'descending'>('descending');

  // Aggregated product summary (by product, not variant)
  const [aggregatedProductSummary, setAggregatedProductSummary] = useState<AggregatedProductSummary[]>([]);
  const [aggregatedSortColumn, setAggregatedSortColumn] = useState<number>(2); // Default to Units Sold
  const [aggregatedSortDirection, setAggregatedSortDirection] = useState<'ascending' | 'descending'>('descending');
  const [selectedProductTab, setSelectedProductTab] = useState<number>(0);

  // Vendor summary (by vendor)
  const [vendorSummary, setVendorSummary] = useState<VendorSummary[]>([]);
  const [vendorSortColumn, setVendorSortColumn] = useState<number>(2); // Default to Units Sold
  const [vendorSortDirection, setVendorSortDirection] = useState<'ascending' | 'descending'>('descending');

  // Product images state (keys can be numbers or strings from JSON)
  const [productImages, setProductImages] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    if (!shop) {
      setLoading(false);
      return;
    }

    fetchOrders();
  }, [shop]);

  useEffect(() => {
    applyFilters();
  }, [orders, dropStartTime, dropEndTime]);

  useEffect(() => {
    if (filteredOrders.length >= 0) {
      applySorting(sortColumn, sortDirection);
    }
  }, [filteredOrders, sortColumn, sortDirection]);

  const applyFilters = () => {
    let filtered = [...orders];

    // Apply drop time range filter (from drop definition)
    if (dropStartTime) {
      const dropStart = new Date(dropStartTime);
      filtered = filtered.filter(order => new Date(order.created_at) >= dropStart);
    }
    if (dropEndTime) {
      const dropEnd = new Date(dropEndTime);
      filtered = filtered.filter(order => new Date(order.created_at) <= dropEnd);
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

  // Handle sort for Orders table (IndexTable)
  const handleOrderSort = (index: number, direction: 'ascending' | 'descending') => {
    setSortColumn(index);
    setSortDirection(direction);
    applySorting(index, direction);
  };

  // Generate product summary from filtered orders
  const generateProductSummary = useCallback(() => {
    const productMap = new Map<string, ProductSummary>();

    filteredOrders.forEach((order) => {
      if (!order.line_items || order.line_items.length === 0) {
        return;
      }

      order.line_items.forEach((item) => {
        // Skip items with null/invalid product_id or variant_id
        if (!item.product_id || !item.variant_id) {
          return;
        }

        // Use product name + variant + SKU as unique key to show separate rows per variant
        const key = `${item.title}-${item.variant_title || 'Default'}-${item.sku || 'N/A'}`;

        // Parse variant title to extract color and size
        // Expected format: "Color / Size" (e.g., "Black / M")
        let color = '';
        let size = '';
        if (item.variant_title) {
          const parts = item.variant_title.split('/').map(part => part.trim());
          color = parts[0] || '';
          size = parts[1] || '';
        }

        if (productMap.has(key)) {
          const existing = productMap.get(key)!;
          existing.unitsSold += item.quantity;
          existing.remainingInventory = 50 - existing.unitsSold;
          existing.totalRevenue += parseFloat(item.price) * item.quantity;
          existing.sellThroughRate = (existing.unitsSold / 50) * 100;
        } else {
          const unitsSold = item.quantity;
          const remainingInventory = 50 - unitsSold;
          const sellThroughRate = (unitsSold / 50) * 100;

          productMap.set(key, {
            productId: item.product_id,
            variantId: item.variant_id,
            productName: item.title,
            variantName: item.variant_title || '',
            color: color,
            size: size,
            sku: item.sku || '',
            unitsSold: unitsSold,
            remainingInventory: remainingInventory,
            totalRevenue: parseFloat(item.price) * item.quantity,
            currency: order.currency,
            sellThroughRate: sellThroughRate,
            revenuePercentage: 0, // Will be calculated below
            imageUrl: undefined,
          });
        }
      });
    });

    // Calculate total revenue from all products
    const summary = Array.from(productMap.values());
    const totalRevenue = summary.reduce((sum, product) => sum + product.totalRevenue, 0);

    // Update revenue percentage and image URL for each product
    // Note: JSON keys are strings, so we look up by string key
    summary.forEach(product => {
      product.revenuePercentage = totalRevenue > 0 ? (product.totalRevenue / totalRevenue) * 100 : 0;
      product.imageUrl = productImages[String(product.productId)];
    });

    setProductSummary(summary);
  }, [filteredOrders, productImages]);

  // Update product summary when filtered orders change
  useEffect(() => {
    generateProductSummary();
  }, [generateProductSummary]);

  // Generate aggregated product summary (by product, not variant)
  const generateAggregatedProductSummary = useCallback(() => {
    // First, count unique variants per product from the variant-level summary
    const variantCountByProduct = new Map<string, Set<number>>();
    productSummary.forEach(variant => {
      const productName = variant.productName;
      if (!variantCountByProduct.has(productName)) {
        variantCountByProduct.set(productName, new Set());
      }
      variantCountByProduct.get(productName)!.add(variant.variantId);
    });

    const productMap = new Map<string, AggregatedProductSummary & { variantCount: number }>();

    filteredOrders.forEach((order) => {
      if (!order.line_items || order.line_items.length === 0) {
        return;
      }

      order.line_items.forEach((item) => {
        if (!item.product_id) {
          return;
        }

        // Use product name as key to aggregate all variants
        const key = item.title;
        const variantCount = variantCountByProduct.get(key)?.size || 1;
        const totalInitialStock = 50 * variantCount;

        if (productMap.has(key)) {
          const existing = productMap.get(key)!;
          existing.unitsSold += item.quantity;
          existing.remainingInventory = totalInitialStock - existing.unitsSold;
          existing.totalRevenue += parseFloat(item.price) * item.quantity;
          existing.sellThroughRate = (existing.unitsSold / totalInitialStock) * 100;
        } else {
          const unitsSold = item.quantity;
          const remainingInventory = totalInitialStock - unitsSold;
          const sellThroughRate = (unitsSold / totalInitialStock) * 100;

          productMap.set(key, {
            productId: item.product_id,
            productName: item.title,
            unitsSold: unitsSold,
            remainingInventory: remainingInventory,
            totalRevenue: parseFloat(item.price) * item.quantity,
            currency: order.currency,
            sellThroughRate: sellThroughRate,
            revenuePercentage: 0,
            imageUrl: undefined,
            variantCount: variantCount,
          });
        }
      });
    });

    const summary = Array.from(productMap.values());
    const totalRevenue = summary.reduce((sum, product) => sum + product.totalRevenue, 0);

    summary.forEach(product => {
      product.revenuePercentage = totalRevenue > 0 ? (product.totalRevenue / totalRevenue) * 100 : 0;
      product.imageUrl = productImages[String(product.productId)];
    });

    setAggregatedProductSummary(summary);
  }, [filteredOrders, productImages, productSummary]);

  // Update aggregated product summary when filtered orders change
  useEffect(() => {
    generateAggregatedProductSummary();
  }, [generateAggregatedProductSummary]);

  // Generate vendor summary (by vendor)
  const generateVendorSummary = useCallback(() => {
    const vendorMap = new Map<string, VendorSummary & { productIds: Set<number> }>();

    filteredOrders.forEach((order) => {
      if (!order.line_items || order.line_items.length === 0) {
        return;
      }

      order.line_items.forEach((item) => {
        const vendor = item.vendor || 'Unknown';

        if (vendorMap.has(vendor)) {
          const existing = vendorMap.get(vendor)!;
          existing.unitsSold += item.quantity;
          existing.totalRevenue += parseFloat(item.price) * item.quantity;
          if (item.product_id) {
            existing.productIds.add(item.product_id);
          }
        } else {
          const productIds = new Set<number>();
          if (item.product_id) {
            productIds.add(item.product_id);
          }

          vendorMap.set(vendor, {
            vendor,
            productCount: 0,
            unitsSold: item.quantity,
            totalRevenue: parseFloat(item.price) * item.quantity,
            currency: order.currency,
            revenuePercentage: 0,
            productIds,
          });
        }
      });
    });

    const summary = Array.from(vendorMap.values()).map(v => ({
      vendor: v.vendor,
      productCount: v.productIds.size,
      unitsSold: v.unitsSold,
      totalRevenue: v.totalRevenue,
      currency: v.currency,
      revenuePercentage: 0,
    }));

    const totalRevenue = summary.reduce((sum, v) => sum + v.totalRevenue, 0);
    summary.forEach(v => {
      v.revenuePercentage = totalRevenue > 0 ? (v.totalRevenue / totalRevenue) * 100 : 0;
    });

    setVendorSummary(summary);
  }, [filteredOrders]);

  // Update vendor summary when filtered orders change
  useEffect(() => {
    generateVendorSummary();
  }, [generateVendorSummary]);

  // Fetch product images when orders are loaded
  useEffect(() => {
    if (orders.length > 0 && shop) {
      // Extract all unique product IDs from all orders
      const productIds: number[] = [];
      orders.forEach(order => {
        order.line_items.forEach(item => {
          if (item.product_id && item.product_id > 0) {
            productIds.push(item.product_id);
          }
        });
      });

      const uniqueIds = [...new Set(productIds)];
      if (uniqueIds.length === 0) return;

      console.log('Fetching images for', uniqueIds.length, 'products:', uniqueIds);
      fetch(`/api/orders/product-images?shop=${encodeURIComponent(shop)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ productIds: uniqueIds }),
      })
        .then(response => {
          console.log('Product images response status:', response.status, response.statusText);
          if (!response.ok) {
            return response.text().then(text => {
              throw new Error(`HTTP ${response.status}: ${text}`);
            });
          }
          return response.json();
        })
        .then(data => {
          console.log('Product images data:', data);
          if (data.success && data.productImages) {
            console.log('Setting product images:', Object.keys(data.productImages).length, 'images');
            setProductImages(data.productImages);
          }
        })
        .catch(error => console.error('Error fetching product images:', error));
    }
  }, [orders.length, shop]);

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
    const authUrl = `${window.location.origin}/api/shopify/auth?shop=${encodeURIComponent(shop)}`;

    return (
      <Banner tone="critical" title="Error loading orders">
        <p>{error}</p>
        <p style={{ marginTop: '12px' }}>
          This usually happens when the session expires. {' '}
          <Link url={authUrl} target="_blank">
            Click here to re-authenticate
          </Link>
        </p>
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

  // Column headings for Orders table
  const orderHeadings: [{ title: string }, ...{ title: string }[]] = [
    { title: '#' },
    { title: 'Order' },
    { title: 'Customer' },
    { title: 'Date' },
    { title: 'Total' },
    { title: 'Status' },
    { title: 'Items' },
    { title: 'Total Units' },
  ];

  // Sort product summary
  const sortedProductSummary = [...productSummary].sort((a, b) => {
    let aValue: any;
    let bValue: any;
    const direction = productSortDirection;

    switch (productSortColumn) {
      case 0: // Row index (not sortable)
        return 0;
      case 1: // Image (not sortable)
        return 0;
      case 2: // Product name
        aValue = a.productName.toLowerCase();
        bValue = b.productName.toLowerCase();
        break;
      case 3: // Color
        aValue = a.color.toLowerCase();
        bValue = b.color.toLowerCase();
        break;
      case 4: // Size
        aValue = a.size.toLowerCase();
        bValue = b.size.toLowerCase();
        break;
      case 5: // SKU
        aValue = a.sku.toLowerCase();
        bValue = b.sku.toLowerCase();
        break;
      case 6: // Units sold
        aValue = a.unitsSold;
        bValue = b.unitsSold;
        break;
      case 7: // Remaining inventory
        aValue = a.remainingInventory;
        bValue = b.remainingInventory;
        break;
      case 8: // Sell-Through Rate
        aValue = a.sellThroughRate;
        bValue = b.sellThroughRate;
        break;
      case 9: // Total revenue
        aValue = a.totalRevenue;
        bValue = b.totalRevenue;
        break;
      case 10: // Revenue percentage
        aValue = a.revenuePercentage;
        bValue = b.revenuePercentage;
        break;
      default:
        return 0;
    }

    if (aValue < bValue) return direction === 'ascending' ? -1 : 1;
    if (aValue > bValue) return direction === 'ascending' ? 1 : -1;
    return 0;
  });

  // Column headings for Product Summary table
  const productHeadings: [{ title: string }, ...{ title: string }[]] = [
    { title: '#' },
    { title: 'Image' },
    { title: 'Product Name' },
    { title: 'Color' },
    { title: 'Size' },
    { title: 'SKU' },
    { title: 'Units Sold' },
    { title: 'Remaining Inventory' },
    { title: 'Sell-Through Rate' },
    { title: 'Total Revenue' },
    { title: 'Revenue %' },
  ];

  // Handle sort for Product Summary table (IndexTable)
  const handleProductSort = (index: number, direction: 'ascending' | 'descending') => {
    setProductSortColumn(index);
    setProductSortDirection(direction);
  };

  // Sort aggregated product summary
  const sortedAggregatedProductSummary = [...aggregatedProductSummary].sort((a, b) => {
    let aValue: any;
    let bValue: any;
    const direction = aggregatedSortDirection;

    switch (aggregatedSortColumn) {
      case 0: // Row index (not sortable)
        return 0;
      case 1: // Image (not sortable)
        return 0;
      case 2: // Product name
        aValue = a.productName.toLowerCase();
        bValue = b.productName.toLowerCase();
        break;
      case 3: // Units sold
        aValue = a.unitsSold;
        bValue = b.unitsSold;
        break;
      case 4: // Remaining inventory
        aValue = a.remainingInventory;
        bValue = b.remainingInventory;
        break;
      case 5: // Sell-Through Rate
        aValue = a.sellThroughRate;
        bValue = b.sellThroughRate;
        break;
      case 6: // Total revenue
        aValue = a.totalRevenue;
        bValue = b.totalRevenue;
        break;
      case 7: // Revenue percentage
        aValue = a.revenuePercentage;
        bValue = b.revenuePercentage;
        break;
      default:
        return 0;
    }

    if (aValue < bValue) return direction === 'ascending' ? -1 : 1;
    if (aValue > bValue) return direction === 'ascending' ? 1 : -1;
    return 0;
  });

  // Column headings for Aggregated Product Summary table (By Product)
  const aggregatedProductHeadings: [{ title: string }, ...{ title: string }[]] = [
    { title: '#' },
    { title: 'Image' },
    { title: 'Product Name' },
    { title: 'Units Sold' },
    { title: 'Remaining Inventory' },
    { title: 'Sell-Through Rate' },
    { title: 'Total Revenue' },
    { title: 'Revenue %' },
  ];

  // Handle sort for Aggregated Product Summary table
  const handleAggregatedProductSort = (index: number, direction: 'ascending' | 'descending') => {
    setAggregatedSortColumn(index);
    setAggregatedSortDirection(direction);
  };

  // Sort vendor summary
  const sortedVendorSummary = [...vendorSummary].sort((a, b) => {
    let aValue: any;
    let bValue: any;
    const direction = vendorSortDirection;

    switch (vendorSortColumn) {
      case 0: // Row index (not sortable)
        return 0;
      case 1: // Vendor name
        aValue = a.vendor.toLowerCase();
        bValue = b.vendor.toLowerCase();
        break;
      case 2: // Products
        aValue = a.productCount;
        bValue = b.productCount;
        break;
      case 3: // Units sold
        aValue = a.unitsSold;
        bValue = b.unitsSold;
        break;
      case 4: // Total revenue
        aValue = a.totalRevenue;
        bValue = b.totalRevenue;
        break;
      case 5: // Revenue percentage
        aValue = a.revenuePercentage;
        bValue = b.revenuePercentage;
        break;
      default:
        return 0;
    }

    if (aValue < bValue) return direction === 'ascending' ? -1 : 1;
    if (aValue > bValue) return direction === 'ascending' ? 1 : -1;
    return 0;
  });

  // Column headings for Vendor Summary table
  const vendorHeadings: [{ title: string }, ...{ title: string }[]] = [
    { title: '#' },
    { title: 'Vendor' },
    { title: 'Products' },
    { title: 'Units Sold' },
    { title: 'Total Revenue' },
    { title: 'Revenue %' },
  ];

  // Handle sort for Vendor Summary table
  const handleVendorSort = (index: number, direction: 'ascending' | 'descending') => {
    setVendorSortColumn(index);
    setVendorSortDirection(direction);
  };

  // Tabs for Product Summary section
  const productSummaryTabs = [
    { id: 'by-variant', content: 'By Variant' },
    { id: 'by-product', content: 'By Product' },
    { id: 'by-vendor', content: 'By Vendor' },
  ];

  // Calculate summary metrics
  const totalOrders = sortedOrders.length;
  const uniqueCustomers = new Set(sortedOrders.map(order => order.email).filter(Boolean)).size;
  const totalRevenue = sortedOrders.reduce((sum, order) => sum + parseFloat(order.total_price), 0);
  const totalItemsSold = sortedOrders.reduce((sum, order) =>
    sum + order.line_items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0);
  // Calculate top 4 best-selling products (aggregated by product, not variant)
  const topProducts = (() => {
    const productTotals = new Map<string, { title: string; productId: number; unitsSold: number }>();

    sortedOrders.forEach(order => {
      order.line_items.forEach(item => {
        const title = item.title;
        const existing = productTotals.get(title);
        if (existing) {
          existing.unitsSold += item.quantity;
        } else {
          productTotals.set(title, { title, productId: item.product_id, unitsSold: item.quantity });
        }
      });
    });

    return Array.from(productTotals.values())
      .sort((a, b) => b.unitsSold - a.unitsSold)
      .slice(0, 4);
  })();

  // Helper function to format currency
  const formatCurrency = (amount: number) => {
    return '$' + amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Export to CSV function
  const exportToCSV = () => {
    let csvContent = '';

    // Section 1: By Variant
    csvContent += 'PRODUCT SALES SUMMARY - BY VARIANT\n';
    csvContent += '#,Product Name,Color,Size,SKU,Units Sold,Remaining Inventory,Sell-Through Rate,Total Revenue,Revenue %\n';
    sortedProductSummary.forEach((product, index) => {
      csvContent += `${index + 1},"${product.productName}","${product.color || 'N/A'}","${product.size || 'N/A'}","${product.sku || 'N/A'}",${product.unitsSold},${product.remainingInventory},${product.sellThroughRate.toFixed(1)}%,${formatCurrency(product.totalRevenue)},${product.revenuePercentage.toFixed(1)}%\n`;
    });

    csvContent += '\n\n';

    // Section 2: By Product
    csvContent += 'PRODUCT SALES SUMMARY - BY PRODUCT\n';
    csvContent += '#,Product Name,Units Sold,Remaining Inventory,Sell-Through Rate,Total Revenue,Revenue %\n';
    sortedAggregatedProductSummary.forEach((product, index) => {
      csvContent += `${index + 1},"${product.productName}",${product.unitsSold},${product.remainingInventory},${product.sellThroughRate.toFixed(1)}%,${formatCurrency(product.totalRevenue)},${product.revenuePercentage.toFixed(1)}%\n`;
    });

    // Create and download the file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `product_sales_summary_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <BlockStack gap="400">
      {/* Summary Metrics Section */}
      <Card>
        <BlockStack gap="400">
          <Text as="h2" variant="headingMd">
            Summary
          </Text>
          <InlineStack gap="800" align="start">
            <BlockStack gap="100">
              <Text as="p" variant="bodySm" tone="subdued">
                Customers
              </Text>
              <Text as="p" variant="headingXl">
                {uniqueCustomers.toLocaleString()}
              </Text>
            </BlockStack>
            <BlockStack gap="100">
              <Text as="p" variant="bodySm" tone="subdued">
                Orders
              </Text>
              <Text as="p" variant="headingXl">
                {totalOrders.toLocaleString()}
              </Text>
            </BlockStack>
            <BlockStack gap="100">
              <Text as="p" variant="bodySm" tone="subdued">
                Items
              </Text>
              <Text as="p" variant="headingXl">
                {totalItemsSold.toLocaleString()}
              </Text>
            </BlockStack>
            <BlockStack gap="100">
              <Text as="p" variant="bodySm" tone="subdued">
                Revenue
              </Text>
              <Text as="p" variant="headingXl">
                {formatCurrency(totalRevenue)}
              </Text>
            </BlockStack>
          </InlineStack>
          {topProducts.length > 0 && (
            <BlockStack gap="200">
              <Text as="p" variant="bodySm" tone="subdued">Top Sellers</Text>
              <InlineStack gap="400" align="start">
                {topProducts.map((p, rank) => {
                  const imageUrl = productImages[String(p.productId)];
                  return (
                    <div
                      key={p.title}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '12px',
                        backgroundColor: '#f6f6f7',
                        borderRadius: '8px',
                        minWidth: '200px',
                      }}
                    >
                      <div
                        style={{
                          width: '24px',
                          height: '24px',
                          backgroundColor: rank === 0 ? '#ffd700' : rank === 1 ? '#c0c0c0' : rank === 2 ? '#cd7f32' : '#6b7280',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: rank === 0 ? '#000' : '#fff',
                          fontWeight: 'bold',
                          fontSize: '12px',
                          flexShrink: 0,
                        }}
                      >
                        {rank + 1}
                      </div>
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={p.title}
                          style={{
                            width: '40px',
                            height: '40px',
                            objectFit: 'cover',
                            borderRadius: '4px',
                            flexShrink: 0,
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: '40px',
                            height: '40px',
                            backgroundColor: '#e1e1e1',
                            borderRadius: '4px',
                            flexShrink: 0,
                          }}
                        />
                      )}
                      <div style={{ overflow: 'hidden' }}>
                        <Text as="p" variant="bodySm" fontWeight="semibold" truncate>
                          {p.title}
                        </Text>
                        <Text as="p" variant="bodySm" tone="subdued">
                          {p.unitsSold} sold
                        </Text>
                      </div>
                    </div>
                  );
                })}
              </InlineStack>
            </BlockStack>
          )}
        </BlockStack>
      </Card>

      {/* Sold Out Variants Section */}
      {sortedProductSummary.filter(p => p.remainingInventory <= 0).length > 0 && (
        <Card>
          <BlockStack gap="400">
            <InlineStack gap="200" align="start" blockAlign="center">
              <Text as="h2" variant="headingMd">
                Sold Out Variants
              </Text>
              <Badge tone="critical">
                {sortedProductSummary.filter(p => p.remainingInventory <= 0).length.toString()}
              </Badge>
            </InlineStack>
            <InlineStack gap="400" wrap>
              {sortedProductSummary
                .filter(p => p.remainingInventory <= 0)
                .map((product) => (
                  <div
                    key={`${product.productId}-${product.variantId}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px',
                      backgroundColor: '#fef2f2',
                      border: '1px solid #fecaca',
                      borderRadius: '8px',
                      minWidth: '220px',
                    }}
                  >
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.productName}
                        style={{
                          width: '50px',
                          height: '50px',
                          objectFit: 'cover',
                          borderRadius: '4px',
                          flexShrink: 0,
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '50px',
                          height: '50px',
                          backgroundColor: '#e1e1e1',
                          borderRadius: '4px',
                          flexShrink: 0,
                        }}
                      />
                    )}
                    <div style={{ overflow: 'hidden' }}>
                      <Text as="p" variant="bodySm" fontWeight="semibold" truncate>
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
                    </div>
                  </div>
                ))}
            </InlineStack>
          </BlockStack>
        </Card>
      )}

      {/* Product Sales Summary Section */}
      {productSummary.length > 0 && (
        <Card>
          <BlockStack gap="400">
            <InlineStack align="space-between">
              <Text as="h2" variant="headingMd">
                Product Sales Summary
              </Text>
              <Button onClick={exportToCSV}>
                Export CSV
              </Button>
            </InlineStack>
            <div className="large-tabs">
              <Tabs tabs={productSummaryTabs} selected={selectedProductTab} onSelect={setSelectedProductTab}>
              {selectedProductTab === 0 ? (
                <>
                  <Text as="p" variant="bodyMd" fontWeight="semibold">
                    {productSummary.length} variants from {sortedOrders.length} orders
                  </Text>
                  <div style={{ maxHeight: '70vh', overflow: 'auto' }}>
                    <IndexTable
                      resourceName={{ singular: 'product', plural: 'products' }}
                      itemCount={sortedProductSummary.length}
                      headings={productHeadings}
                      selectable={false}
                      sortable={[false, false, true, true, true, true, true, true, true, true, true]}
                      defaultSortDirection="descending"
                      sortDirection={productSortDirection}
                      sortColumnIndex={productSortColumn}
                      onSort={handleProductSort}
                    >
                      {sortedProductSummary.map((product, index) => (
                        <IndexTable.Row
                          id={`${product.productId}-${product.variantId}`}
                          key={`${product.productId}-${product.variantId}`}
                          position={index}
                        >
                          <IndexTable.Cell>{index + 1}</IndexTable.Cell>
                          <IndexTable.Cell>
                            {product.imageUrl ? (
                              <img
                                src={product.imageUrl}
                                alt={product.productName}
                                style={{
                                  width: '80px',
                                  height: '80px',
                                  objectFit: 'cover',
                                  borderRadius: '4px'
                                }}
                              />
                            ) : (
                              <div style={{
                                width: '80px',
                                height: '80px',
                                backgroundColor: '#f0f0f0',
                                borderRadius: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '12px',
                                color: '#999'
                              }}>
                                No image
                              </div>
                            )}
                          </IndexTable.Cell>
                          <IndexTable.Cell>{product.productName}</IndexTable.Cell>
                          <IndexTable.Cell>{product.color || 'N/A'}</IndexTable.Cell>
                          <IndexTable.Cell>{product.size || 'N/A'}</IndexTable.Cell>
                          <IndexTable.Cell>{product.sku || 'N/A'}</IndexTable.Cell>
                          <IndexTable.Cell>{product.unitsSold}</IndexTable.Cell>
                          <IndexTable.Cell>{product.remainingInventory}</IndexTable.Cell>
                          <IndexTable.Cell>{product.sellThroughRate.toFixed(1)}%</IndexTable.Cell>
                          <IndexTable.Cell>
                            {formatCurrency(product.totalRevenue)}
                          </IndexTable.Cell>
                          <IndexTable.Cell>{product.revenuePercentage.toFixed(1)}%</IndexTable.Cell>
                        </IndexTable.Row>
                      ))}
                    </IndexTable>
                  </div>
                </>
              ) : selectedProductTab === 1 ? (
                <>
                  <Text as="p" variant="bodyMd" fontWeight="semibold">
                    {aggregatedProductSummary.length} products from {sortedOrders.length} orders
                  </Text>
                  <div style={{ maxHeight: '70vh', overflow: 'auto' }}>
                    <IndexTable
                      resourceName={{ singular: 'product', plural: 'products' }}
                      itemCount={sortedAggregatedProductSummary.length}
                      headings={aggregatedProductHeadings}
                      selectable={false}
                      sortable={[false, false, true, true, true, true, true, true]}
                      defaultSortDirection="descending"
                      sortDirection={aggregatedSortDirection}
                      sortColumnIndex={aggregatedSortColumn}
                      onSort={handleAggregatedProductSort}
                    >
                      {sortedAggregatedProductSummary.map((product, index) => (
                        <IndexTable.Row
                          id={`${product.productId}`}
                          key={`${product.productId}`}
                          position={index}
                        >
                          <IndexTable.Cell>{index + 1}</IndexTable.Cell>
                          <IndexTable.Cell>
                            {product.imageUrl ? (
                              <img
                                src={product.imageUrl}
                                alt={product.productName}
                                style={{
                                  width: '80px',
                                  height: '80px',
                                  objectFit: 'cover',
                                  borderRadius: '4px'
                                }}
                              />
                            ) : (
                              <div style={{
                                width: '80px',
                                height: '80px',
                                backgroundColor: '#f0f0f0',
                                borderRadius: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '12px',
                                color: '#999'
                              }}>
                                No image
                              </div>
                            )}
                          </IndexTable.Cell>
                          <IndexTable.Cell>{product.productName}</IndexTable.Cell>
                          <IndexTable.Cell>{product.unitsSold}</IndexTable.Cell>
                          <IndexTable.Cell>{product.remainingInventory}</IndexTable.Cell>
                          <IndexTable.Cell>{product.sellThroughRate.toFixed(1)}%</IndexTable.Cell>
                          <IndexTable.Cell>
                            {formatCurrency(product.totalRevenue)}
                          </IndexTable.Cell>
                          <IndexTable.Cell>{product.revenuePercentage.toFixed(1)}%</IndexTable.Cell>
                        </IndexTable.Row>
                      ))}
                    </IndexTable>
                  </div>
                </>
              ) : selectedProductTab === 2 ? (
                <>
                  <Text as="p" variant="bodyMd" fontWeight="semibold">
                    {vendorSummary.length} vendors from {sortedOrders.length} orders
                  </Text>
                  <div style={{ maxHeight: '70vh', overflow: 'auto' }}>
                    <IndexTable
                      resourceName={{ singular: 'vendor', plural: 'vendors' }}
                      itemCount={sortedVendorSummary.length}
                      headings={vendorHeadings}
                      selectable={false}
                      sortable={[false, true, true, true, true, true]}
                      defaultSortDirection="descending"
                      sortDirection={vendorSortDirection}
                      sortColumnIndex={vendorSortColumn}
                      onSort={handleVendorSort}
                    >
                      {sortedVendorSummary.map((vendor, index) => (
                        <IndexTable.Row
                          id={vendor.vendor}
                          key={vendor.vendor}
                          position={index}
                        >
                          <IndexTable.Cell>{index + 1}</IndexTable.Cell>
                          <IndexTable.Cell>
                            <Text as="span" fontWeight="semibold">{vendor.vendor}</Text>
                          </IndexTable.Cell>
                          <IndexTable.Cell>{vendor.productCount}</IndexTable.Cell>
                          <IndexTable.Cell>{vendor.unitsSold}</IndexTable.Cell>
                          <IndexTable.Cell>
                            {formatCurrency(vendor.totalRevenue)}
                          </IndexTable.Cell>
                          <IndexTable.Cell>{vendor.revenuePercentage.toFixed(1)}%</IndexTable.Cell>
                        </IndexTable.Row>
                      ))}
                    </IndexTable>
                  </div>
                </>
              ) : null}
            </Tabs>
            </div>
          </BlockStack>
        </Card>
      )}

      {/* Orders Section - Last */}
      <Card>
        <BlockStack gap="400">
          <Text as="h2" variant="headingMd">
            Orders
          </Text>
          <Text as="p" variant="bodyMd" fontWeight="semibold">
            Showing {sortedOrders.length} of {orders.length} orders
          </Text>

          <div style={{ maxHeight: '50vh', overflow: 'auto' }}>
            <IndexTable
              resourceName={{ singular: 'order', plural: 'orders' }}
              itemCount={sortedOrders.length}
              headings={orderHeadings}
              selectable={false}
              sortable={[false, true, true, true, true, true, true, true]}
              defaultSortDirection="descending"
              sortDirection={sortDirection}
              sortColumnIndex={sortColumn}
              onSort={handleOrderSort}
            >
              {sortedOrders.map((order, index) => (
                <IndexTable.Row id={order.id.toString()} key={order.id} position={index}>
                  <IndexTable.Cell>{index + 1}</IndexTable.Cell>
                  <IndexTable.Cell>
                    <Link url={getOrderLink(order)} target="_blank" removeUnderline>
                      {order.name}
                    </Link>
                  </IndexTable.Cell>
                  <IndexTable.Cell>{order.email || 'N/A'}</IndexTable.Cell>
                  <IndexTable.Cell>{formatDate(order.created_at)}</IndexTable.Cell>
                  <IndexTable.Cell>{formatCurrency(parseFloat(order.total_price))}</IndexTable.Cell>
                  <IndexTable.Cell>{getStatusBadge(order.financial_status)}</IndexTable.Cell>
                  <IndexTable.Cell>{order.line_items.length}</IndexTable.Cell>
                  <IndexTable.Cell>
                    {order.line_items.reduce((sum, item) => sum + item.quantity, 0)}
                  </IndexTable.Cell>
                </IndexTable.Row>
              ))}
            </IndexTable>
          </div>
        </BlockStack>
      </Card>
    </BlockStack>
  );
};

export default OrdersListWithFilters;
