import { Router, Request, Response } from 'express';
import { getSession, shopify } from './shopify';
import { rateLimitedBatch, getQueueStats } from './shopifyRateLimiter';
import { getCachedProducts, cacheProducts, getOrdersByShop } from './sessionStorage';
import {
  startOrderSync,
  cancelSync,
  subscribeSyncEvents,
  unsubscribeSyncEvents,
  getFullSyncStatus,
  SyncEvent,
} from './orderSyncService';

const router = Router();

// Get all orders - returns cached orders from SQLite (instant response)
router.get('/recent', async (req: Request, res: Response) => {
  try {
    const shop = req.query.shop as string;

    if (!shop) {
      return res.status(400).json({ error: 'Missing shop parameter' });
    }

    const session = getSession(shop);

    if (!session) {
      return res.status(401).json({ error: 'Not authenticated. Please install the app first.' });
    }

    // Get cached orders from SQLite (instant - no API calls)
    const cachedOrders = getOrdersByShop(shop);
    const syncStatus = getFullSyncStatus(shop);

    console.log(`Returning ${cachedOrders.length} cached orders for ${shop} (sync status: ${syncStatus.status})`);

    res.json({
      success: true,
      count: cachedOrders.length,
      orders: cachedOrders,
      syncStatus: {
        status: syncStatus.status,
        syncedOrders: syncStatus.syncedOrders,
        totalOrders: syncStatus.totalOrders,
        lastSyncAt: syncStatus.lastSyncAt,
        syncRequired: syncStatus.syncRequired,
      },
    });
  } catch (error: any) {
    console.error('Error fetching orders:', error);
    res.status(500).json({
      error: 'Failed to fetch orders',
      message: error.message,
    });
  }
});

// Start order sync (background job)
router.post('/sync/start', async (req: Request, res: Response) => {
  try {
    const shop = req.query.shop as string || req.body.shop;
    const force = req.body.force === true;

    if (!shop) {
      return res.status(400).json({ error: 'Missing shop parameter' });
    }

    const session = getSession(shop);
    if (!session) {
      return res.status(401).json({ error: 'Not authenticated. Please install the app first.' });
    }

    const result = await startOrderSync(shop, force);

    res.json({
      success: result.success,
      message: result.message,
    });
  } catch (error: any) {
    console.error('Error starting order sync:', error);
    res.status(500).json({
      error: 'Failed to start sync',
      message: error.message,
    });
  }
});

// Get sync status
router.get('/sync/status', async (req: Request, res: Response) => {
  try {
    const shop = req.query.shop as string;

    if (!shop) {
      return res.status(400).json({ error: 'Missing shop parameter' });
    }

    const syncStatus = getFullSyncStatus(shop);

    res.json({
      success: true,
      ...syncStatus,
    });
  } catch (error: any) {
    console.error('Error getting sync status:', error);
    res.status(500).json({
      error: 'Failed to get sync status',
      message: error.message,
    });
  }
});

// Cancel ongoing sync
router.post('/sync/cancel', async (req: Request, res: Response) => {
  try {
    const shop = req.query.shop as string || req.body.shop;

    if (!shop) {
      return res.status(400).json({ error: 'Missing shop parameter' });
    }

    const cancelled = cancelSync(shop);

    res.json({
      success: cancelled,
      message: cancelled ? 'Sync cancelled' : 'No sync in progress',
    });
  } catch (error: any) {
    console.error('Error cancelling sync:', error);
    res.status(500).json({
      error: 'Failed to cancel sync',
      message: error.message,
    });
  }
});

// SSE endpoint for real-time sync progress
router.get('/sync/progress', (req: Request, res: Response) => {
  const shop = req.query.shop as string;

  if (!shop) {
    return res.status(400).json({ error: 'Missing shop parameter' });
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

  // Send initial status
  const initialStatus = getFullSyncStatus(shop);
  res.write(`data: ${JSON.stringify({
    type: 'status',
    shop,
    synced: initialStatus.syncedOrders,
    total: initialStatus.totalOrders,
    status: initialStatus.status,
    syncRequired: initialStatus.syncRequired,
  })}\n\n`);

  // Subscribe to sync events
  const listener = (event: SyncEvent) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  subscribeSyncEvents(shop, listener);

  // Heartbeat every 30s to keep connection alive
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 30000);

  // Cleanup on disconnect
  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribeSyncEvents(shop, listener);
  });
});

// Get product metadata (images, type, vendor, category) for multiple product IDs
router.post('/product-images', async (req: Request, res: Response) => {
  console.log('Product metadata endpoint called');
  try {
    const shop = req.query.shop as string;
    const { productIds } = req.body;

    console.log('Received productIds:', productIds?.length, 'items');
    console.log('First few productIds:', productIds?.slice(0, 3), 'types:', productIds?.slice(0, 3).map((id: any) => typeof id));

    if (!shop) {
      return res.status(400).json({ error: 'Missing shop parameter' });
    }

    if (!productIds || !Array.isArray(productIds)) {
      return res.status(400).json({ error: 'Missing or invalid productIds' });
    }

    const session = getSession(shop);

    if (!session) {
      console.log('No session found for shop:', shop);
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const client = new shopify.clients.Rest({ session });
    const productImages: { [key: string]: string } = {};
    const productMetadata: { [key: string]: { productType: string; vendor: string; category: string } } = {};

    // Filter out null, undefined, and invalid product IDs
    // Product IDs can be numbers or numeric strings - normalize them
    const uniqueProductIds = [...new Set(productIds)]
      .map((id): number | null => {
        if (id == null) return null;
        const numId = typeof id === 'string' ? parseInt(id, 10) : id;
        return typeof numId === 'number' && !isNaN(numId) && numId > 0 ? numId : null;
      })
      .filter((id): id is number => id !== null);

    console.log('Fetching metadata for', uniqueProductIds.length, 'unique products:', uniqueProductIds.slice(0, 3));

    // Step 1: Check cache for existing products
    const productIdStrings = uniqueProductIds.map(String);
    const cachedData = getCachedProducts(shop, productIdStrings);
    console.log(`Found ${cachedData.size} products in cache`);

    // Populate results from cache
    for (const [productId, cached] of cachedData) {
      if (cached.imageUrl) {
        productImages[productId] = cached.imageUrl;
      }
      productMetadata[productId] = {
        productType: cached.productType,
        vendor: cached.vendor,
        category: cached.category,
      };
    }

    // Step 2: Identify products that need to be fetched from API
    const uncachedProductIds = uniqueProductIds.filter(id => !cachedData.has(String(id)));
    console.log(`Need to fetch ${uncachedProductIds.length} products from Shopify API`);

    if (uncachedProductIds.length > 0) {
      const queueStats = getQueueStats();
      console.log(`Queue stats before batch: pending=${queueStats.pending}, size=${queueStats.size}`);

      // Step 3: Fetch uncached products with rate limiting (2 req/sec max)
      const fetchedProducts: Array<{
        productId: string;
        imageUrl: string | null;
        productType: string;
        vendor: string;
        category: string;
      }> = [];

      const results = await rateLimitedBatch(
        uncachedProductIds,
        async (productId) => {
          const response = await client.get({
            path: `products/${productId}`,
          });

          const product = (response.body as any).product;
          const imageUrl = product?.image?.src || product?.images?.[0]?.src || null;
          const productType = product?.product_type || '';
          const vendor = product?.vendor || '';
          // Use tags as category - take the first tag or use product_type as fallback
          const tags = product?.tags || '';
          const category = tags ? tags.split(',')[0].trim() : productType;

          return {
            productId: String(productId),
            imageUrl,
            productType,
            vendor,
            category,
          };
        },
        {
          maxRetries: 5,
          onProgress: (completed, total) => {
            if (completed % 10 === 0 || completed === total) {
              console.log(`Product fetch progress: ${completed}/${total}`);
            }
          },
          onError: (productId, error) => {
            console.error(`Failed to fetch product ${productId} after retries:`, error.message);
          },
        }
      );

      // Step 4: Process results and build response
      for (const result of results) {
        if (result) {
          fetchedProducts.push(result);
          if (result.imageUrl) {
            productImages[result.productId] = result.imageUrl;
          }
          productMetadata[result.productId] = {
            productType: result.productType,
            vendor: result.vendor,
            category: result.category,
          };
        }
      }

      // Step 5: Cache newly fetched products for future requests
      if (fetchedProducts.length > 0) {
        const cachedCount = cacheProducts(shop, fetchedProducts);
        console.log(`Cached ${cachedCount} products for future requests`);
      }
    }

    console.log('Successfully fetched metadata for', Object.keys(productMetadata).length, 'products');

    res.json({
      success: true,
      productImages,
      productMetadata,
    });
  } catch (error: any) {
    console.error('Error fetching product metadata:', error);
    res.status(500).json({
      error: 'Failed to fetch product metadata',
      message: error.message,
    });
  }
});

// Get all collections from the store
router.get('/collections', async (req: Request, res: Response) => {
  try {
    const shop = req.query.shop as string;

    if (!shop) {
      return res.status(400).json({ error: 'Missing shop parameter' });
    }

    const session = getSession(shop);

    if (!session) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const client = new shopify.clients.Rest({ session });

    // Fetch both smart collections and custom collections
    const [smartCollectionsResponse, customCollectionsResponse] = await Promise.all([
      client.get({ path: 'smart_collections', query: { limit: '250' } }).catch(() => ({ body: { smart_collections: [] } })),
      client.get({ path: 'custom_collections', query: { limit: '250' } }).catch(() => ({ body: { custom_collections: [] } })),
    ]);

    const smartCollections = ((smartCollectionsResponse.body as any).smart_collections || []).map((c: any) => ({
      id: String(c.id),
      title: c.title,
      type: 'smart',
    }));

    const customCollections = ((customCollectionsResponse.body as any).custom_collections || []).map((c: any) => ({
      id: String(c.id),
      title: c.title,
      type: 'custom',
    }));

    const allCollections = [...smartCollections, ...customCollections].sort((a, b) =>
      a.title.localeCompare(b.title)
    );

    res.json({
      success: true,
      collections: allCollections,
    });
  } catch (error: any) {
    console.error('Error fetching collections:', error);
    res.status(500).json({
      error: 'Failed to fetch collections',
      message: error.message,
    });
  }
});

// Get analytics data (sessions for conversion rate)
// Note: ShopifyQL analytics requires specific API access that may not be available for all stores
router.get('/analytics', async (req: Request, res: Response) => {
  console.log('Analytics endpoint called');
  try {
    const shop = req.query.shop as string;

    if (!shop) {
      return res.status(400).json({ error: 'Missing shop parameter' });
    }

    const session = getSession(shop);

    if (!session) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Create a GraphQL client for this session
    const client = new shopify.clients.Graphql({ session });

    // Query for session/visitor data using ShopifyQL
    const query = `
      query {
        shopifyqlQuery(query: """
          FROM sessions
          SHOW sum(sessions) AS total_sessions
          SINCE -30d
          UNTIL today
        """) {
          __typename
          ... on TableResponse {
            tableData {
              rowData
              columns {
                name
                dataType
              }
            }
          }
          parseErrors {
            code
            message
            range {
              start { line character }
              end { line character }
            }
          }
        }
      }
    `;

    const response = await client.request(query);
    console.log('Analytics response:', JSON.stringify(response, null, 2));

    // Check for errors in response
    if (response.errors) {
      console.error('GraphQL errors:', response.errors);
      return res.json({
        success: false,
        error: 'Analytics API returned errors',
        details: response.errors,
      });
    }

    res.json({
      success: true,
      analytics: response,
    });
  } catch (error: any) {
    console.error('Error fetching analytics:', error?.message || error);
    // Return success: false instead of 500 error so frontend handles gracefully
    res.json({
      success: false,
      error: 'Analytics not available',
      message: error.message,
    });
  }
});

// Get current inventory levels for all variants
router.get('/inventory', async (req: Request, res: Response) => {
  console.log('Inventory endpoint called');
  try {
    const shop = req.query.shop as string;

    if (!shop) {
      return res.status(400).json({ error: 'Missing shop parameter' });
    }

    const session = getSession(shop);

    if (!session) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Create a GraphQL client for this session
    const client = new shopify.clients.Graphql({ session });

    // Fetch all products with their variants and inventory
    const allInventory: { [variantId: string]: number } = {};
    let hasNextPage = true;
    let cursor: string | null = null;

    while (hasNextPage) {
      const query = `
        query GetInventory($cursor: String) {
          products(first: 100, after: $cursor) {
            pageInfo {
              hasNextPage
              endCursor
            }
            edges {
              node {
                id
                variants(first: 100) {
                  edges {
                    node {
                      id
                      inventoryQuantity
                    }
                  }
                }
              }
            }
          }
        }
      `;

      const response = await client.request(query, {
        variables: { cursor },
      });

      const data = response.data as any;
      const products = data?.products;

      if (products?.edges) {
        for (const productEdge of products.edges) {
          const variants = productEdge.node?.variants?.edges || [];
          for (const variantEdge of variants) {
            const variant = variantEdge.node;
            // Extract numeric ID from gid://shopify/ProductVariant/123456
            const variantId = variant.id.split('/').pop();
            const quantity = variant.inventoryQuantity ?? 0;
            allInventory[variantId] = quantity;
          }
        }
      }

      hasNextPage = products?.pageInfo?.hasNextPage || false;
      cursor = products?.pageInfo?.endCursor || null;

      console.log(`Fetched inventory for ${Object.keys(allInventory).length} variants so far...`);
    }

    console.log(`Finished fetching inventory. Total variants: ${Object.keys(allInventory).length}`);

    res.json({
      success: true,
      inventory: allInventory,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error fetching inventory:', error?.message || error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch inventory',
      message: error.message,
    });
  }
});

// Get variant metadata (SKU, product name, variant name) for inventory display
router.get('/variants', async (req: Request, res: Response) => {
  console.log('Variants metadata endpoint called');
  try {
    const shop = req.query.shop as string;
    const variantIds = req.query.variantIds as string; // comma-separated

    if (!shop) {
      return res.status(400).json({ error: 'Missing shop parameter' });
    }

    if (!variantIds) {
      return res.status(400).json({ error: 'Missing variantIds parameter' });
    }

    const session = getSession(shop);

    if (!session) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const client = new shopify.clients.Graphql({ session });
    const ids = variantIds.split(',').map(id => `gid://shopify/ProductVariant/${id.trim()}`);

    // Shopify has a limit on the number of IDs per query, so batch them
    const batchSize = 50;
    const allVariants: Array<{
      variantId: string;
      sku: string;
      variantName: string;
      productName: string;
    }> = [];

    for (let i = 0; i < ids.length; i += batchSize) {
      const batchIds = ids.slice(i, i + batchSize);

      const query = `
        query GetVariants($ids: [ID!]!) {
          nodes(ids: $ids) {
            ... on ProductVariant {
              id
              sku
              title
              product {
                title
              }
            }
          }
        }
      `;

      const response = await client.request(query, {
        variables: { ids: batchIds },
      });

      const nodes = (response.data as any)?.nodes || [];
      for (const v of nodes) {
        if (v && v.id) {
          allVariants.push({
            variantId: v.id.split('/').pop(),
            sku: v.sku || '',
            variantName: v.title || 'Default',
            productName: v.product?.title || 'Unknown',
          });
        }
      }
    }

    console.log(`Fetched metadata for ${allVariants.length} variants`);

    res.json({
      success: true,
      variants: allVariants,
    });
  } catch (error: any) {
    console.error('Error fetching variant metadata:', error?.message || error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch variant metadata',
      message: error.message,
    });
  }
});

export default router;
