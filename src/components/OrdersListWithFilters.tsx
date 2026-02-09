import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { RefreshIcon } from '@shopify/polaris-icons';
import { calculateDropPerformanceScore, type DropPerformanceScore } from '../utils/dropScore';
import {
  SummaryMetricsCard,
  SoldOutVariantsSection,
  FilterSection,
  getDatePreset,
  type DatePreset,
  type OrderAnalysisData,
  type SyncStatus,
  type ProductSummary,
} from './orders';
import { getClientConfig } from '../client/services/config';

interface Order {
  id: number;
  name: string;
  email: string;
  created_at: string;
  total_price: string;
  subtotal_price: string;
  total_discounts: string;
  total_line_items_price: string;
  currency: string;
  financial_status: string;
  tags: string;
  customer?: {
    id: number;
    email: string;
    orders_count: number;
  } | null;
  refunds?: Array<{
    id: number;
    created_at: string;
    transactions: Array<{
      amount: string;
    }>;
  }>;
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

interface AggregatedProductSummary {
  productId: number;
  productName: string;
  productType: string;
  vendor: string;
  category: string;
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

interface ColorSummary {
  color: string;
  variantCount: number;
  unitsSold: number;
  totalRevenue: number;
  currency: string;
  revenuePercentage: number;
}

interface ProductTypeSummary {
  productType: string;
  productCount: number;
  unitsSold: number;
  totalRevenue: number;
  currency: string;
  revenuePercentage: number;
}

interface CategorySummary {
  category: string;
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
  onCreateDrop?: (startDate: string, startTime: string, endDate: string, endTime: string) => void;
  inventorySnapshot?: string | null; // JSON string: { [variantId: string]: number }
  onScoreCalculated?: (score: DropPerformanceScore | null) => void;
  // Data callbacks to pass data to parent
  onDataCalculated?: (data: OrderAnalysisData) => void;
  // Control which sections to render
  hideSections?: {
    orderData?: boolean;
    summaryMetrics?: boolean;
    soldOutVariants?: boolean;
    productSalesBreakdown?: boolean;
    ordersTable?: boolean;
  };
}

const OrdersListWithFilters: React.FC<OrdersListProps> = ({
  shop,
  dropStartTime,
  dropEndTime,
  onCreateDrop,
  inventorySnapshot,
  onScoreCalculated,
  onDataCalculated,
  hideSections = {},
}) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [storeDomain, setStoreDomain] = useState<string>('myshopify.com');

  // Sync status state
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [syncProgress, setSyncProgress] = useState<number>(0);
  const eventSourceRef = React.useRef<EventSource | null>(null);
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
  const [aggregatedSortColumn, setAggregatedSortColumn] = useState<number>(6); // Default to Units Sold
  const [aggregatedSortDirection, setAggregatedSortDirection] = useState<'ascending' | 'descending'>('descending');
  const [selectedProductTab, setSelectedProductTab] = useState<number>(0);

  // Vendor summary (by vendor)
  const [vendorSummary, setVendorSummary] = useState<VendorSummary[]>([]);
  const [vendorSortColumn, setVendorSortColumn] = useState<number>(2); // Default to Units Sold
  const [vendorSortDirection, setVendorSortDirection] = useState<'ascending' | 'descending'>('descending');

  // Color summary (by color)
  const [colorSummary, setColorSummary] = useState<ColorSummary[]>([]);
  const [colorSortColumn, setColorSortColumn] = useState<number>(2); // Default to Units Sold
  const [colorSortDirection, setColorSortDirection] = useState<'ascending' | 'descending'>('descending');

  // Product type summary (by product type)
  const [productTypeSummary, setProductTypeSummary] = useState<ProductTypeSummary[]>([]);
  const [productTypeSortColumn, setProductTypeSortColumn] = useState<number>(2); // Default to Units Sold
  const [productTypeSortDirection, setProductTypeSortDirection] = useState<'ascending' | 'descending'>('descending');

  // Category summary (by category)
  const [categorySummary, setCategorySummary] = useState<CategorySummary[]>([]);
  const [categorySortColumn, setCategorySortColumn] = useState<number>(2); // Default to Units Sold
  const [categorySortDirection, setCategorySortDirection] = useState<'ascending' | 'descending'>('descending');

  // Product images state (keys can be numbers or strings from JSON)
  const [productImages, setProductImages] = useState<{ [key: string]: string }>({});
  const [productMetadata, setProductMetadata] = useState<{ [key: string]: { productType: string; vendor: string; category: string } }>({});

  // Inventory state
  const [currentInventory, setCurrentInventory] = useState<{ [variantId: string]: number }>({});
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [isEstimatedInventory, setIsEstimatedInventory] = useState(false);

  // Parse inventory snapshot if available
  const parsedSnapshot: { [variantId: string]: number } | null = React.useMemo(() => {
    if (inventorySnapshot) {
      try {
        return JSON.parse(inventorySnapshot);
      } catch {
        return null;
      }
    }
    return null;
  }, [inventorySnapshot]);

  // Filter state (only used when no drop time range is provided)
  const isExploreMode = !dropStartTime && !dropEndTime;
  const today = new Date().toISOString().split('T')[0];
  const [filterStartDate, setFilterStartDate] = useState<string>(today);
  const [filterStartTime, setFilterStartTime] = useState<string>('00:00');
  const [filterEndDate, setFilterEndDate] = useState<string>(today);
  const [filterEndTime, setFilterEndTime] = useState<string>('23:59');

  // Track last calculated score to avoid unnecessary updates
  const lastScoreRef = React.useRef<string | null>(null);

  useEffect(() => {
    if (!shop) {
      setLoading(false);
      return;
    }

    fetchOrders();
  }, [shop]);

  // Fetch current inventory for reverse calculation when no snapshot exists
  useEffect(() => {
    if (!shop || !dropStartTime || parsedSnapshot) {
      // Don't fetch if: no shop, not in drop mode, or we have a snapshot
      return;
    }

    setInventoryLoading(true);
    setIsEstimatedInventory(true);

    fetch(`/api/orders/inventory?shop=${encodeURIComponent(shop)}`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.inventory) {
          setCurrentInventory(data.inventory);
        }
      })
      .catch(err => {
        console.error('Error fetching current inventory:', err);
      })
      .finally(() => {
        setInventoryLoading(false);
      });
  }, [shop, dropStartTime, parsedSnapshot]);

  useEffect(() => {
    applyFilters();
  }, [orders, dropStartTime, dropEndTime, filterStartDate, filterStartTime, filterEndDate, filterEndTime]);

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

    // Apply manual filters (explore mode on dashboard)
    if (isExploreMode) {
      if (filterStartDate) {
        const startDateTime = new Date(`${filterStartDate}T${filterStartTime}`);
        filtered = filtered.filter(order => new Date(order.created_at) >= startDateTime);
      }
      if (filterEndDate) {
        const endDateTime = new Date(`${filterEndDate}T${filterEndTime}`);
        filtered = filtered.filter(order => new Date(order.created_at) <= endDateTime);
      }
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

  // Helper to get initial inventory for a variant
  const getInitialInventory = useCallback((variantId: number, unitsSold: number): number => {
    const variantIdStr = String(variantId);

    // Priority 1: Use snapshot if available (accurate)
    if (parsedSnapshot && parsedSnapshot[variantIdStr] !== undefined) {
      return parsedSnapshot[variantIdStr];
    }

    // Priority 2: Reverse calculate from current inventory (estimated)
    if (currentInventory[variantIdStr] !== undefined) {
      // Initial inventory = current inventory + units sold during drop
      return currentInventory[variantIdStr] + unitsSold;
    }

    // Fallback: Use a reasonable default (will show as estimated)
    return 50;
  }, [parsedSnapshot, currentInventory]);

  // Generate product summary from filtered orders
  const generateProductSummary = useCallback(() => {
    const productMap = new Map<string, ProductSummary & { runningTotal: number }>();

    // Sort orders by time to track when variants sold out
    const sortedByTime = [...filteredOrders].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    // First pass: calculate total units sold per variant
    const unitsSoldByVariant = new Map<number, number>();
    sortedByTime.forEach((order) => {
      order.line_items?.forEach((item) => {
        if (item.variant_id) {
          const current = unitsSoldByVariant.get(item.variant_id) || 0;
          unitsSoldByVariant.set(item.variant_id, current + item.quantity);
        }
      });
    });

    sortedByTime.forEach((order) => {
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

        // Get initial inventory for this variant
        const totalSoldForVariant = unitsSoldByVariant.get(item.variant_id) || 0;
        const initialInventory = getInitialInventory(item.variant_id, totalSoldForVariant);

        if (productMap.has(key)) {
          const existing = productMap.get(key)!;
          const previousTotal = existing.runningTotal;
          existing.runningTotal += item.quantity;
          existing.unitsSold = existing.runningTotal;
          existing.remainingInventory = Math.max(0, initialInventory - existing.unitsSold);
          existing.totalRevenue += parseFloat(item.price) * item.quantity;
          existing.sellThroughRate = initialInventory > 0 ? (existing.unitsSold / initialInventory) * 100 : 0;

          // Check if this order caused the variant to sell out
          if (previousTotal < initialInventory && existing.runningTotal >= initialInventory && !existing.soldOutAt) {
            existing.soldOutAt = order.created_at;
          }
        } else {
          const unitsSold = item.quantity;
          const remainingInventory = Math.max(0, initialInventory - unitsSold);
          const sellThroughRate = initialInventory > 0 ? (unitsSold / initialInventory) * 100 : 0;

          const entry: ProductSummary & { runningTotal: number } = {
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
            revenuePercentage: 0,
            imageUrl: undefined,
            runningTotal: unitsSold,
            soldOutAt: unitsSold >= initialInventory ? order.created_at : undefined,
          };

          productMap.set(key, entry);
        }
      });
    });

    // Calculate total revenue from all products
    const summary = Array.from(productMap.values()).map(({ runningTotal, ...rest }) => rest);
    const totalRevenue = summary.reduce((sum, product) => sum + product.totalRevenue, 0);

    // Update revenue percentage and image URL for each product
    summary.forEach(product => {
      product.revenuePercentage = totalRevenue > 0 ? (product.totalRevenue / totalRevenue) * 100 : 0;
      product.imageUrl = productImages[String(product.productId)];
    });

    setProductSummary(summary);
  }, [filteredOrders, productImages, getInitialInventory]);

  // Update product summary when filtered orders change
  useEffect(() => {
    generateProductSummary();
  }, [generateProductSummary]);

  // Generate aggregated product summary (by product, not variant)
  const generateAggregatedProductSummary = useCallback(() => {
    // First, collect initial inventory per variant and calculate totals per product
    const variantsByProduct = new Map<string, Map<number, number>>(); // productName -> (variantId -> initialInventory)
    const unitsSoldByVariant = new Map<number, number>();

    // Calculate units sold per variant
    filteredOrders.forEach((order) => {
      order.line_items?.forEach((item) => {
        if (item.variant_id) {
          const current = unitsSoldByVariant.get(item.variant_id) || 0;
          unitsSoldByVariant.set(item.variant_id, current + item.quantity);
        }
      });
    });

    // Group variants by product and get their initial inventory
    productSummary.forEach(variant => {
      const productName = variant.productName;
      if (!variantsByProduct.has(productName)) {
        variantsByProduct.set(productName, new Map());
      }
      const totalSold = unitsSoldByVariant.get(variant.variantId) || variant.unitsSold;
      const initialInv = getInitialInventory(variant.variantId, totalSold);
      variantsByProduct.get(productName)!.set(variant.variantId, initialInv);
    });

    const productMap = new Map<string, AggregatedProductSummary & { variantCount: number; totalInitialStock: number }>();

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
        const variantsMap = variantsByProduct.get(key);
        const variantCount = variantsMap?.size || 1;
        // Sum up initial inventory for all variants of this product
        const totalInitialStock = variantsMap
          ? Array.from(variantsMap.values()).reduce((sum, inv) => sum + inv, 0)
          : getInitialInventory(item.variant_id, unitsSoldByVariant.get(item.variant_id) || item.quantity);

        if (productMap.has(key)) {
          const existing = productMap.get(key)!;
          existing.unitsSold += item.quantity;
          existing.remainingInventory = Math.max(0, existing.totalInitialStock - existing.unitsSold);
          existing.totalRevenue += parseFloat(item.price) * item.quantity;
          existing.sellThroughRate = existing.totalInitialStock > 0 ? (existing.unitsSold / existing.totalInitialStock) * 100 : 0;
        } else {
          const unitsSold = item.quantity;
          const remainingInventory = Math.max(0, totalInitialStock - unitsSold);
          const sellThroughRate = totalInitialStock > 0 ? (unitsSold / totalInitialStock) * 100 : 0;

          const metadata = productMetadata[String(item.product_id)];
          productMap.set(key, {
            productId: item.product_id,
            productName: item.title,
            productType: metadata?.productType || item.product_type || 'N/A',
            vendor: metadata?.vendor || item.vendor || 'N/A',
            category: metadata?.category || 'N/A',
            unitsSold: unitsSold,
            remainingInventory: remainingInventory,
            totalRevenue: parseFloat(item.price) * item.quantity,
            currency: order.currency,
            sellThroughRate: sellThroughRate,
            revenuePercentage: 0,
            imageUrl: undefined,
            variantCount: variantCount,
            totalInitialStock: totalInitialStock,
          });
        }
      });
    });

    const summary = Array.from(productMap.values()).map(({ totalInitialStock, ...rest }) => rest);
    const totalRevenue = summary.reduce((sum, product) => sum + product.totalRevenue, 0);

    summary.forEach(product => {
      product.revenuePercentage = totalRevenue > 0 ? (product.totalRevenue / totalRevenue) * 100 : 0;
      product.imageUrl = productImages[String(product.productId)];
    });

    setAggregatedProductSummary(summary);
  }, [filteredOrders, productImages, productMetadata, productSummary, getInitialInventory]);

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

  // Generate color summary (by color)
  const generateColorSummary = useCallback(() => {
    const colorMap = new Map<string, ColorSummary & { variantIds: Set<number> }>();

    filteredOrders.forEach((order) => {
      if (!order.line_items || order.line_items.length === 0) {
        return;
      }

      order.line_items.forEach((item) => {
        // Parse color from variant_title (format: "Color / Size")
        let color = 'Unknown';
        if (item.variant_title) {
          const parts = item.variant_title.split('/').map(part => part.trim());
          color = parts[0] || 'Unknown';
        }

        if (colorMap.has(color)) {
          const existing = colorMap.get(color)!;
          existing.unitsSold += item.quantity;
          existing.totalRevenue += parseFloat(item.price) * item.quantity;
          if (item.variant_id) {
            existing.variantIds.add(item.variant_id);
          }
        } else {
          const variantIds = new Set<number>();
          if (item.variant_id) {
            variantIds.add(item.variant_id);
          }

          colorMap.set(color, {
            color,
            variantCount: 0,
            unitsSold: item.quantity,
            totalRevenue: parseFloat(item.price) * item.quantity,
            currency: order.currency,
            revenuePercentage: 0,
            variantIds,
          });
        }
      });
    });

    const summary = Array.from(colorMap.values()).map(c => ({
      color: c.color,
      variantCount: c.variantIds.size,
      unitsSold: c.unitsSold,
      totalRevenue: c.totalRevenue,
      currency: c.currency,
      revenuePercentage: 0,
    }));

    const totalRevenue = summary.reduce((sum, c) => sum + c.totalRevenue, 0);
    summary.forEach(c => {
      c.revenuePercentage = totalRevenue > 0 ? (c.totalRevenue / totalRevenue) * 100 : 0;
    });

    setColorSummary(summary);
  }, [filteredOrders]);

  // Update color summary when filtered orders change
  useEffect(() => {
    generateColorSummary();
  }, [generateColorSummary]);

  // Generate product type summary (by product type)
  const generateProductTypeSummary = useCallback(() => {
    const productTypeMap = new Map<string, ProductTypeSummary & { productIds: Set<number> }>();

    aggregatedProductSummary.forEach((product) => {
      const productType = product.productType || 'Unknown';

      if (productTypeMap.has(productType)) {
        const existing = productTypeMap.get(productType)!;
        existing.unitsSold += product.unitsSold;
        existing.totalRevenue += product.totalRevenue;
        existing.productIds.add(product.productId);
      } else {
        const productIds = new Set<number>();
        productIds.add(product.productId);

        productTypeMap.set(productType, {
          productType,
          productCount: 0,
          unitsSold: product.unitsSold,
          totalRevenue: product.totalRevenue,
          currency: product.currency,
          revenuePercentage: 0,
          productIds,
        });
      }
    });

    const summary = Array.from(productTypeMap.values()).map(pt => ({
      productType: pt.productType,
      productCount: pt.productIds.size,
      unitsSold: pt.unitsSold,
      totalRevenue: pt.totalRevenue,
      currency: pt.currency,
      revenuePercentage: 0,
    }));

    const totalRevenue = summary.reduce((sum, pt) => sum + pt.totalRevenue, 0);
    summary.forEach(pt => {
      pt.revenuePercentage = totalRevenue > 0 ? (pt.totalRevenue / totalRevenue) * 100 : 0;
    });

    setProductTypeSummary(summary);
  }, [aggregatedProductSummary]);

  // Update product type summary when aggregated products change
  useEffect(() => {
    generateProductTypeSummary();
  }, [generateProductTypeSummary]);

  // Generate category summary (by category)
  const generateCategorySummary = useCallback(() => {
    const categoryMap = new Map<string, CategorySummary & { productIds: Set<number> }>();

    aggregatedProductSummary.forEach((product) => {
      const category = product.category || 'Unknown';

      if (categoryMap.has(category)) {
        const existing = categoryMap.get(category)!;
        existing.unitsSold += product.unitsSold;
        existing.totalRevenue += product.totalRevenue;
        existing.productIds.add(product.productId);
      } else {
        const productIds = new Set<number>();
        productIds.add(product.productId);

        categoryMap.set(category, {
          category,
          productCount: 0,
          unitsSold: product.unitsSold,
          totalRevenue: product.totalRevenue,
          currency: product.currency,
          revenuePercentage: 0,
          productIds,
        });
      }
    });

    const summary = Array.from(categoryMap.values()).map(cat => ({
      category: cat.category,
      productCount: cat.productIds.size,
      unitsSold: cat.unitsSold,
      totalRevenue: cat.totalRevenue,
      currency: cat.currency,
      revenuePercentage: 0,
    }));

    const totalRevenue = summary.reduce((sum, cat) => sum + cat.totalRevenue, 0);
    summary.forEach(cat => {
      cat.revenuePercentage = totalRevenue > 0 ? (cat.totalRevenue / totalRevenue) * 100 : 0;
    });

    setCategorySummary(summary);
  }, [aggregatedProductSummary]);

  // Update category summary when aggregated products change
  useEffect(() => {
    generateCategorySummary();
  }, [generateCategorySummary]);

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
          console.log('Product metadata data:', data);
          if (data.success && data.productImages) {
            console.log('Setting product images:', Object.keys(data.productImages).length, 'images');
            setProductImages(data.productImages);
          }
          if (data.success && data.productMetadata) {
            console.log('Setting product metadata:', Object.keys(data.productMetadata).length, 'products');
            setProductMetadata(data.productMetadata);
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

        // Handle sync status
        if (data.syncStatus) {
          setSyncStatus(data.syncStatus);

          // If sync is in progress, connect to SSE for updates
          if (data.syncStatus.status === 'syncing') {
            connectToSyncProgress();
          }
          // If no orders and sync required, trigger sync automatically
          else if (data.syncStatus.syncRequired && data.orders.length === 0) {
            triggerSync();
          }
        }
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

  const triggerSync = async () => {
    try {
      const response = await fetch(`/api/orders/sync/start?shop=${encodeURIComponent(shop)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shop }),
      });

      const data = await response.json();

      if (data.success) {
        setSyncStatus(prev => prev ? { ...prev, status: 'syncing' } : {
          status: 'syncing',
          syncedOrders: 0,
          totalOrders: null,
          lastSyncAt: null,
          syncRequired: false,
        });
        connectToSyncProgress();
      }
    } catch (err) {
      console.error('Error triggering sync:', err);
    }
  };

  const connectToSyncProgress = () => {
    // Close existing connection if any
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const eventSource = new EventSource(`/api/orders/sync/progress?shop=${encodeURIComponent(shop)}`);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'progress' || data.type === 'status') {
          setSyncProgress(data.total ? (data.synced / data.total) * 100 : 0);
          setSyncStatus(prev => prev ? {
            ...prev,
            syncedOrders: data.synced,
            totalOrders: data.total,
            status: data.status || prev.status,
          } : null);
        } else if (data.type === 'complete') {
          eventSource.close();
          eventSourceRef.current = null;
          // Refresh orders after sync completes
          fetchOrders();
        } else if (data.type === 'error') {
          setSyncStatus(prev => prev ? { ...prev, status: 'error' } : null);
          setError(data.message || 'Sync failed');
          eventSource.close();
          eventSourceRef.current = null;
        }
      } catch (err) {
        console.error('Error parsing SSE event:', err);
      }
    };

    eventSource.onerror = () => {
      console.error('SSE connection error');
      eventSource.close();
      eventSourceRef.current = null;
    };
  };

  // Cleanup SSE connection on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

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

  // Sync progress banner component
  const SyncProgressBanner = () => {
    if (!syncStatus || syncStatus.status !== 'syncing') return null;

    return (
      <Banner tone="info" title="Syncing orders from Shopify">
        <BlockStack gap="200">
          <Text as="p">
            {syncStatus.syncedOrders.toLocaleString()} orders synced
            {syncStatus.totalOrders ? ` of ${syncStatus.totalOrders.toLocaleString()}` : '...'}
          </Text>
          <div style={{
            width: '100%',
            height: '8px',
            backgroundColor: '#e4e5e7',
            borderRadius: '4px',
            overflow: 'hidden',
          }}>
            <div style={{
              width: `${syncProgress}%`,
              height: '100%',
              backgroundColor: '#2c6ecb',
              borderRadius: '4px',
              transition: 'width 0.3s ease',
            }} />
          </div>
          <Text as="p" tone="subdued">
            Orders will appear as they sync. You can continue browsing.
          </Text>
        </BlockStack>
      </Banner>
    );
  };

  // Load client config on mount
  useEffect(() => {
    getClientConfig().then(config => {
      setStoreDomain(config.storeDomain);
    }).catch(err => {
      console.error('Failed to load config:', err);
      // Keep default domain if config fails to load
    });
  }, []);

  const getOrderLink = (order: Order) => {
    const shopName = shop.replace(`.${storeDomain}`, '');
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

  // Sort product summary (memoized)
  const sortedProductSummary = useMemo(() => {
    return [...productSummary].sort((a, b) => {
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
  }, [productSummary, productSortColumn, productSortDirection]);

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

  // Sort aggregated product summary (memoized)
  const sortedAggregatedProductSummary = useMemo(() => {
    return [...aggregatedProductSummary].sort((a, b) => {
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
        case 3: // Product type
          aValue = a.productType.toLowerCase();
          bValue = b.productType.toLowerCase();
          break;
        case 4: // Category
          aValue = a.category.toLowerCase();
          bValue = b.category.toLowerCase();
          break;
        case 5: // Vendor
          aValue = a.vendor.toLowerCase();
          bValue = b.vendor.toLowerCase();
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
  }, [aggregatedProductSummary, aggregatedSortColumn, aggregatedSortDirection]);

  // Column headings for Aggregated Product Summary table (By Product)
  const aggregatedProductHeadings: [{ title: string }, ...{ title: string }[]] = [
    { title: '#' },
    { title: 'Image' },
    { title: 'Product Name' },
    { title: 'Product Type' },
    { title: 'Category' },
    { title: 'Vendor' },
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

  // Sort vendor summary (memoized)
  const sortedVendorSummary = useMemo(() => {
    return [...vendorSummary].sort((a, b) => {
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
  }, [vendorSummary, vendorSortColumn, vendorSortDirection]);

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

  // Sort color summary (memoized)
  const sortedColorSummary = useMemo(() => {
    return [...colorSummary].sort((a, b) => {
      let aValue: any;
      let bValue: any;
      const direction = colorSortDirection;

      switch (colorSortColumn) {
        case 0: // Row index (not sortable)
          return 0;
        case 1: // Color name
          aValue = a.color.toLowerCase();
          bValue = b.color.toLowerCase();
          break;
        case 2: // Variants
          aValue = a.variantCount;
          bValue = b.variantCount;
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
  }, [colorSummary, colorSortColumn, colorSortDirection]);

  // Column headings for Color Summary table
  const colorHeadings: [{ title: string }, ...{ title: string }[]] = [
    { title: '#' },
    { title: 'Color' },
    { title: 'Variants' },
    { title: 'Units Sold' },
    { title: 'Total Revenue' },
    { title: 'Revenue %' },
  ];

  // Handle sort for Color Summary table
  const handleColorSort = (index: number, direction: 'ascending' | 'descending') => {
    setColorSortColumn(index);
    setColorSortDirection(direction);
  };

  // Sort product type summary (memoized)
  const sortedProductTypeSummary = useMemo(() => {
    return [...productTypeSummary].sort((a, b) => {
      let aValue: any;
      let bValue: any;
      const direction = productTypeSortDirection;

      switch (productTypeSortColumn) {
        case 0: // Row index (not sortable)
          return 0;
        case 1: // Product type name
          aValue = a.productType.toLowerCase();
          bValue = b.productType.toLowerCase();
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
  }, [productTypeSummary, productTypeSortColumn, productTypeSortDirection]);

  // Column headings for Product Type Summary table
  const productTypeHeadings: [{ title: string }, ...{ title: string }[]] = [
    { title: '#' },
    { title: 'Product Type' },
    { title: 'Products' },
    { title: 'Units Sold' },
    { title: 'Total Revenue' },
    { title: 'Revenue %' },
  ];

  // Handle sort for Product Type Summary table
  const handleProductTypeSort = (index: number, direction: 'ascending' | 'descending') => {
    setProductTypeSortColumn(index);
    setProductTypeSortDirection(direction);
  };

  // Sort category summary (memoized)
  const sortedCategorySummary = useMemo(() => {
    return [...categorySummary].sort((a, b) => {
      let aValue: any;
      let bValue: any;
      const direction = categorySortDirection;

      switch (categorySortColumn) {
        case 0: // Row index (not sortable)
          return 0;
        case 1: // Category name
          aValue = a.category.toLowerCase();
          bValue = b.category.toLowerCase();
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
  }, [categorySummary, categorySortColumn, categorySortDirection]);

  // Column headings for Category Summary table
  const categoryHeadings: [{ title: string }, ...{ title: string }[]] = [
    { title: '#' },
    { title: 'Category' },
    { title: 'Products' },
    { title: 'Units Sold' },
    { title: 'Total Revenue' },
    { title: 'Revenue %' },
  ];

  // Handle sort for Category Summary table
  const handleCategorySort = (index: number, direction: 'ascending' | 'descending') => {
    setCategorySortColumn(index);
    setCategorySortDirection(direction);
  };

  // Tabs for Product Summary section
  const productSummaryTabs = [
    { id: 'by-variant', content: 'By Variant' },
    { id: 'by-product', content: 'By Product' },
    { id: 'by-color', content: 'By Color' },
    { id: 'by-vendor', content: 'By Vendor' },
    { id: 'by-product-type', content: 'By Product Type' },
    { id: 'by-category', content: 'By Category' },
  ];

  // Calculate summary metrics (memoized)
  const salesMetrics = useMemo(() => {
    const totalOrders = sortedOrders.length;
    const totalItemsSold = sortedOrders.reduce((sum, order) =>
      sum + order.line_items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0);

    const grossSales = sortedOrders.reduce((sum, order) =>
      sum + parseFloat(order.total_line_items_price || order.total_price || '0'), 0);
    const totalDiscounts = sortedOrders.reduce((sum, order) =>
      sum + parseFloat(order.total_discounts || '0'), 0);
    const totalRefunds = sortedOrders.reduce((sum, order) => {
      if (!order.refunds || order.refunds.length === 0) return sum;
      return sum + order.refunds.reduce((refundSum, refund) =>
        refundSum + refund.transactions.reduce((txSum, tx) => txSum + parseFloat(tx.amount || '0'), 0), 0);
    }, 0);
    const refundedOrdersCount = sortedOrders.filter(order => order.refunds && order.refunds.length > 0).length;
    const netSales = grossSales - totalDiscounts - totalRefunds;
    const avgOrderValue = totalOrders > 0 ? netSales / totalOrders : 0;

    return { totalOrders, totalItemsSold, grossSales, totalDiscounts, totalRefunds, refundedOrdersCount, netSales, avgOrderValue };
  }, [sortedOrders]);

  const { totalOrders, totalItemsSold, grossSales, totalDiscounts, totalRefunds, refundedOrdersCount, netSales, avgOrderValue } = salesMetrics;

  // Customer metrics (memoized)
  const customerMetrics = useMemo(() => {
    // Group orders by customer email to count unique customers
    const customerMap = new Map<string, { email: string; orders_count: number }>();

    sortedOrders.forEach(order => {
      if (order.email && order.customer) {
        // Use the first occurrence's orders_count (they should all be the same for a customer)
        if (!customerMap.has(order.email)) {
          customerMap.set(order.email, {
            email: order.email,
            orders_count: order.customer.orders_count,
          });
        }
      }
    });

    const uniqueCustomers = customerMap.size;

    // Count new customers (orders_count === 1) vs returning customers (orders_count > 1)
    let newCustomers = 0;
    let returningCustomers = 0;

    customerMap.forEach(customer => {
      if (customer.orders_count === 1) {
        newCustomers++;
      } else if (customer.orders_count > 1) {
        returningCustomers++;
      }
    });

    return { uniqueCustomers, newCustomers, returningCustomers };
  }, [sortedOrders]);

  const { uniqueCustomers, newCustomers, returningCustomers } = customerMetrics;

  // Calculate top 4 best-selling products (memoized)
  const topProducts = useMemo(() => {
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
  }, [sortedOrders]);

  // Helper function to format currency
  const formatCurrency = useCallback((amount: number) => {
    return '$' + amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }, []);

  // Memoize the calculated data object for performance
  const calculatedData: OrderAnalysisData = useMemo(() => ({
    salesMetrics,
    customerMetrics,
    topProducts,
    productSummary: sortedProductSummary,
    soldOutVariants: sortedProductSummary.filter(p => p.remainingInventory <= 0),
    productImages,
    syncStatus,
    formatCurrency,
  }), [salesMetrics, customerMetrics, topProducts, sortedProductSummary, productImages, syncStatus, formatCurrency]);

  // Pass calculated data to parent component
  useEffect(() => {
    if (onDataCalculated) {
      onDataCalculated(calculatedData);
    }
  }, [onDataCalculated, calculatedData]);

  // Early returns - placed after all hooks to comply with Rules of Hooks
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
    // Show sync progress if syncing
    if (syncStatus?.status === 'syncing') {
      return (
        <Card>
          <div style={{ padding: '20px' }}>
            <SyncProgressBanner />
          </div>
        </Card>
      );
    }

    // Show option to trigger sync if needed
    if (syncStatus?.syncRequired) {
      return (
        <Card>
          <EmptyState
            heading="No orders synced yet"
            image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
            action={{
              content: 'Sync Orders from Shopify',
              onAction: triggerSync,
            }}
          >
            <p>Click the button above to sync your orders from Shopify. This may take a few minutes for stores with many orders.</p>
          </EmptyState>
        </Card>
      );
    }

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

  // Calculate Drop Performance Score (computed value, not a hook)
  let performanceScore: ReturnType<typeof calculateDropPerformanceScore> | null = null;
  if (dropStartTime && dropEndTime) {
    try {
      performanceScore = calculateDropPerformanceScore({
        productSummary: sortedProductSummary,
        orders: sortedOrders,
        dropStartTime,
        dropEndTime,
        netSales,
        avgOrderValue,
        totalOrders,
        newCustomers,
        returningCustomers,
        uniqueCustomers,
      });
    } catch (error) {
      console.error('Error calculating performance score:', error);
      performanceScore = null;
    }
  }

  // Notify parent of score changes (only when score actually changes)
  const scoreKey = performanceScore ? `${performanceScore.overall}-${performanceScore.grade}` : 'null';
  if (onScoreCalculated && lastScoreRef.current !== scoreKey) {
    lastScoreRef.current = scoreKey;
    onScoreCalculated(performanceScore);
  }

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

  // Handle date preset selection
  const handlePresetClick = (preset: DatePreset) => {
    const { startDate, endDate, startTime, endTime } = getDatePreset(preset);
    setFilterStartDate(startDate);
    setFilterStartTime(startTime);
    setFilterEndDate(endDate);
    setFilterEndTime(endTime);
  };

  return (
    <BlockStack gap="400">
      {/* Sync Progress Banner (shown when sync is in progress) */}
      {syncStatus?.status === 'syncing' && <SyncProgressBanner />}

      {/* Sync Orders Button (always visible when not syncing) */}
      {!hideSections.orderData && syncStatus?.status !== 'syncing' && (
        <Card>
          <InlineStack align="space-between" blockAlign="center">
            <InlineStack gap="200" blockAlign="center">
              <Text as="h2" variant="headingMd">
                Order Data
              </Text>
              {syncStatus?.lastSyncAt && (
                <Text as="span" variant="bodySm" tone="subdued">
                  Last synced: {new Date(syncStatus.lastSyncAt).toLocaleString()}
                </Text>
              )}
            </InlineStack>
            <Button onClick={triggerSync} icon={RefreshIcon}>
              Sync Orders from Shopify
            </Button>
          </InlineStack>
        </Card>
      )}

      {/* Filters Section (only in explore mode) */}
      {isExploreMode && (
        <FilterSection
          filterStartDate={filterStartDate}
          filterStartTime={filterStartTime}
          filterEndDate={filterEndDate}
          filterEndTime={filterEndTime}
          onStartDateChange={setFilterStartDate}
          onStartTimeChange={setFilterStartTime}
          onEndDateChange={setFilterEndDate}
          onEndTimeChange={setFilterEndTime}
          onPresetClick={handlePresetClick}
          onCreateDrop={onCreateDrop}
        />
      )}

      {/* Summary Metrics Section */}
      {!hideSections.summaryMetrics && (
        <SummaryMetricsCard
          salesMetrics={salesMetrics}
          customerMetrics={customerMetrics}
          topProducts={topProducts}
          productImages={productImages}
          formatCurrency={formatCurrency}
        />
      )}

      {/* Inventory Loading Indicator */}
      {inventoryLoading && !isExploreMode && (
        <Card>
          <InlineStack gap="200" blockAlign="center">
            <Spinner size="small" />
            <Text as="span" variant="bodySm" tone="subdued">
              Loading current inventory for sell-through calculations...
            </Text>
          </InlineStack>
        </Card>
      )}

      {/* Sold Out Variants Section (only in drop analysis mode) */}
      {!hideSections.soldOutVariants && !isExploreMode && (
        <SoldOutVariantsSection
          soldOutVariants={sortedProductSummary.filter(p => p.remainingInventory <= 0)}
          dropStartTime={dropStartTime}
          formatCurrency={formatCurrency}
        />
      )}

      {/* Product Sales Summary Section (only in drop analysis mode) */}
      {!hideSections.productSalesBreakdown && !isExploreMode && productSummary.length > 0 && (
        <Card>
          <BlockStack gap="400">
            <InlineStack align="space-between">
              <InlineStack gap="200" blockAlign="center">
                <Text as="h2" variant="headingLg">
                  Product Sales Breakdown
                </Text>
                {isEstimatedInventory && !parsedSnapshot && (
                  <Badge tone="attention">Estimated Inventory</Badge>
                )}
                {parsedSnapshot && (
                  <Badge tone="success">Snapshot Inventory</Badge>
                )}
              </InlineStack>
              <Button onClick={exportToCSV}>
                Export CSV
              </Button>
            </InlineStack>
            <Text as="p" variant="bodySm" tone="subdued">
              Detailed performance metrics for each product variant including sales, inventory, and revenue
            </Text>
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
                      sortable={[false, false, true, true, true, true, true, true, true, true, true]}
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
                          <IndexTable.Cell>{product.productType}</IndexTable.Cell>
                          <IndexTable.Cell>{product.category}</IndexTable.Cell>
                          <IndexTable.Cell>{product.vendor}</IndexTable.Cell>
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
                    {colorSummary.length} colors from {sortedOrders.length} orders
                  </Text>
                  <div style={{ maxHeight: '70vh', overflow: 'auto' }}>
                    <IndexTable
                      resourceName={{ singular: 'color', plural: 'colors' }}
                      itemCount={sortedColorSummary.length}
                      headings={colorHeadings}
                      selectable={false}
                      sortable={[false, true, true, true, true, true]}
                      defaultSortDirection="descending"
                      sortDirection={colorSortDirection}
                      sortColumnIndex={colorSortColumn}
                      onSort={handleColorSort}
                    >
                      {sortedColorSummary.map((color, index) => (
                        <IndexTable.Row
                          id={color.color}
                          key={color.color}
                          position={index}
                        >
                          <IndexTable.Cell>{index + 1}</IndexTable.Cell>
                          <IndexTable.Cell>
                            <Text as="span" fontWeight="semibold">{color.color}</Text>
                          </IndexTable.Cell>
                          <IndexTable.Cell>{color.variantCount}</IndexTable.Cell>
                          <IndexTable.Cell>{color.unitsSold}</IndexTable.Cell>
                          <IndexTable.Cell>
                            {formatCurrency(color.totalRevenue)}
                          </IndexTable.Cell>
                          <IndexTable.Cell>{color.revenuePercentage.toFixed(1)}%</IndexTable.Cell>
                        </IndexTable.Row>
                      ))}
                    </IndexTable>
                  </div>
                </>
              ) : selectedProductTab === 3 ? (
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
              ) : selectedProductTab === 4 ? (
                <>
                  <Text as="p" variant="bodyMd" fontWeight="semibold">
                    {productTypeSummary.length} product types from {sortedOrders.length} orders
                  </Text>
                  <div style={{ maxHeight: '70vh', overflow: 'auto' }}>
                    <IndexTable
                      resourceName={{ singular: 'product type', plural: 'product types' }}
                      itemCount={sortedProductTypeSummary.length}
                      headings={productTypeHeadings}
                      selectable={false}
                      sortable={[false, true, true, true, true, true]}
                      defaultSortDirection="descending"
                      sortDirection={productTypeSortDirection}
                      sortColumnIndex={productTypeSortColumn}
                      onSort={handleProductTypeSort}
                    >
                      {sortedProductTypeSummary.map((productType, index) => (
                        <IndexTable.Row
                          id={productType.productType}
                          key={productType.productType}
                          position={index}
                        >
                          <IndexTable.Cell>{index + 1}</IndexTable.Cell>
                          <IndexTable.Cell>
                            <Text as="span" fontWeight="semibold">{productType.productType}</Text>
                          </IndexTable.Cell>
                          <IndexTable.Cell>{productType.productCount}</IndexTable.Cell>
                          <IndexTable.Cell>{productType.unitsSold}</IndexTable.Cell>
                          <IndexTable.Cell>
                            {formatCurrency(productType.totalRevenue)}
                          </IndexTable.Cell>
                          <IndexTable.Cell>{productType.revenuePercentage.toFixed(1)}%</IndexTable.Cell>
                        </IndexTable.Row>
                      ))}
                    </IndexTable>
                  </div>
                </>
              ) : selectedProductTab === 5 ? (
                <>
                  <Text as="p" variant="bodyMd" fontWeight="semibold">
                    {categorySummary.length} categories from {sortedOrders.length} orders
                  </Text>
                  <div style={{ maxHeight: '70vh', overflow: 'auto' }}>
                    <IndexTable
                      resourceName={{ singular: 'category', plural: 'categories' }}
                      itemCount={sortedCategorySummary.length}
                      headings={categoryHeadings}
                      selectable={false}
                      sortable={[false, true, true, true, true, true]}
                      defaultSortDirection="descending"
                      sortDirection={categorySortDirection}
                      sortColumnIndex={categorySortColumn}
                      onSort={handleCategorySort}
                    >
                      {sortedCategorySummary.map((category, index) => (
                        <IndexTable.Row
                          id={category.category}
                          key={category.category}
                          position={index}
                        >
                          <IndexTable.Cell>{index + 1}</IndexTable.Cell>
                          <IndexTable.Cell>
                            <Text as="span" fontWeight="semibold">{category.category}</Text>
                          </IndexTable.Cell>
                          <IndexTable.Cell>{category.productCount}</IndexTable.Cell>
                          <IndexTable.Cell>{category.unitsSold}</IndexTable.Cell>
                          <IndexTable.Cell>
                            {formatCurrency(category.totalRevenue)}
                          </IndexTable.Cell>
                          <IndexTable.Cell>{category.revenuePercentage.toFixed(1)}%</IndexTable.Cell>
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
      {!hideSections.ordersTable && (
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingLg">
              Orders
            </Text>
          <Text as="p" variant="bodySm" tone="subdued">
            Complete list of all orders placed during the selected time period
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
      )}
    </BlockStack>
  );
};

export default OrdersListWithFilters;
