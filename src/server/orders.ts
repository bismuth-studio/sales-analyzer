import { Router, Request, Response } from 'express';
import { getSession, shopify } from './shopify';

const router = Router();

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

// Get all orders with pagination
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

    // Create a REST client for this session
    const client = new shopify.clients.Rest({ session });

    // Fetch all orders using pagination (max 250 per request)
    const allOrders: Order[] = [];
    let pageInfo: string | undefined = undefined;
    let hasNextPage = true;

    console.log('Starting to fetch all orders...');

    while (hasNextPage) {
      // When using page_info, you can only include page_info and limit - no other params
      const query: Record<string, string> = pageInfo
        ? { limit: '250', page_info: pageInfo }
        : { limit: '250', status: 'any' };

      const response = await client.get({
        path: 'orders',
        query,
      });

      const orders = (response.body as any).orders as Order[];
      allOrders.push(...orders);

      console.log(`Fetched ${orders.length} orders, total so far: ${allOrders.length}`);

      // Check for next page using pageInfo from response
      const headers = response.headers as Record<string, string | string[] | undefined>;
      const linkHeader = headers?.link || headers?.Link;
      const linkStr = Array.isArray(linkHeader) ? linkHeader[0] : linkHeader;

      console.log('Link header:', linkStr ? linkStr.substring(0, 200) : 'none');

      if (linkStr && linkStr.includes('rel="next"')) {
        // Extract page_info from link header - try multiple patterns
        const nextMatch = linkStr.match(/<[^>]*page_info=([^&>]+)[^>]*>;\s*rel="next"/) ||
                          linkStr.match(/page_info=([^&>;]+).*rel="next"/);
        if (nextMatch) {
          pageInfo = nextMatch[1];
          console.log('Found next page_info:', pageInfo.substring(0, 50) + '...');
        } else {
          console.log('Could not extract page_info from Link header');
          hasNextPage = false;
        }
      } else {
        console.log('No next page in Link header');
        hasNextPage = false;
      }
    }

    console.log(`Finished fetching orders. Total: ${allOrders.length}`);

    // Debug: Log first order's line items to see what Shopify returns
    if (allOrders.length > 0 && allOrders[0].line_items && allOrders[0].line_items.length > 0) {
      console.log('Sample line item from Shopify API:', JSON.stringify(allOrders[0].line_items[0], null, 2));
    }

    res.json({
      success: true,
      count: allOrders.length,
      orders: allOrders,
    });
  } catch (error: any) {
    console.error('Error fetching orders:', error);
    res.status(500).json({
      error: 'Failed to fetch orders',
      message: error.message,
    });
  }
});

// Get product images for multiple product IDs
router.post('/product-images', async (req: Request, res: Response) => {
  console.log('Product images endpoint called');
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

    // Filter out null, undefined, and invalid product IDs
    // Product IDs can be numbers or numeric strings - normalize them
    const uniqueProductIds = [...new Set(productIds)]
      .map((id): number | null => {
        if (id == null) return null;
        const numId = typeof id === 'string' ? parseInt(id, 10) : id;
        return typeof numId === 'number' && !isNaN(numId) && numId > 0 ? numId : null;
      })
      .filter((id): id is number => id !== null);

    console.log('Fetching images for', uniqueProductIds.length, 'unique products:', uniqueProductIds.slice(0, 3));

    // Fetch all products in parallel for speed
    const fetchPromises = uniqueProductIds.map(async (productId) => {
      try {
        console.log(`Fetching product ${productId}...`);
        const response = await client.get({
          path: `products/${productId}`,
        });

        const product = (response.body as any).product;
        const imageUrl = product?.image?.src || product?.images?.[0]?.src;
        console.log(`Product ${productId}: image=${imageUrl ? 'found' : 'not found'}`);
        if (imageUrl) {
          return { productId: String(productId), imageUrl };
        }
        return null;
      } catch (error: any) {
        console.error(`Error fetching product ${productId}:`, error?.message);
        return null;
      }
    });

    const results = await Promise.all(fetchPromises);

    // Build the productImages object from results
    results.forEach(result => {
      if (result) {
        productImages[result.productId] = result.imageUrl;
      }
    });

    console.log('Successfully fetched', Object.keys(productImages).length, 'product images');

    res.json({
      success: true,
      productImages,
    });
  } catch (error: any) {
    console.error('Error fetching product images:', error);
    res.status(500).json({
      error: 'Failed to fetch product images',
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
