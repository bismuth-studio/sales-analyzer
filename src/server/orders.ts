import { Router, Request, Response } from 'express';
import { getSession, shopify } from './shopify';

const router = Router();

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
      const linkHeader = headers?.link;
      const linkStr = Array.isArray(linkHeader) ? linkHeader[0] : linkHeader;

      if (linkStr && linkStr.includes('rel="next"')) {
        // Extract page_info from link header
        const nextMatch = linkStr.match(/<[^>]*page_info=([^&>]+)[^>]*>;\s*rel="next"/);
        if (nextMatch) {
          pageInfo = nextMatch[1];
        } else {
          hasNextPage = false;
        }
      } else {
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
    const uniqueProductIds = [...new Set(productIds)].filter(
      (id): id is number => id != null && typeof id === 'number' && id > 0
    );

    console.log('Fetching images for', uniqueProductIds.length, 'unique products');

    // Fetch all products in parallel for speed
    const fetchPromises = uniqueProductIds.map(async (productId) => {
      try {
        const response = await client.get({
          path: `products/${productId}`,
        });

        const product = (response.body as any).product;
        const imageUrl = product?.image?.src || product?.images?.[0]?.src;
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

export default router;
