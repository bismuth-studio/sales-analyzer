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

// Get last 50 orders
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

    // Fetch last 50 orders with detailed line items
    const response = await client.get({
      path: 'orders',
      query: {
        limit: '50',
        status: 'any',
      },
    });

    const orders = (response.body as any).orders as Order[];

    // Debug: Log first order's line items to see what Shopify returns
    if (orders.length > 0 && orders[0].line_items && orders[0].line_items.length > 0) {
      console.log('Sample line item from Shopify API:', JSON.stringify(orders[0].line_items[0], null, 2));
    }

    res.json({
      success: true,
      count: orders.length,
      orders: orders,
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
  try {
    const shop = req.query.shop as string;
    const { productIds } = req.body;

    if (!shop) {
      return res.status(400).json({ error: 'Missing shop parameter' });
    }

    if (!productIds || !Array.isArray(productIds)) {
      return res.status(400).json({ error: 'Missing or invalid productIds' });
    }

    const session = getSession(shop);

    if (!session) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const client = new shopify.clients.Rest({ session });
    const productImages: { [key: number]: string } = {};

    const uniqueProductIds = [...new Set(productIds)];

    for (const productId of uniqueProductIds) {
      try {
        const response = await client.get({
          path: `products/${productId}`,
        });

        const product = (response.body as any).product;
        const imageUrl = product?.image?.src || product?.images?.[0]?.src;
        if (imageUrl) {
          productImages[productId] = imageUrl;
        }
      } catch (error: any) {
        console.error(`Error fetching product ${productId}:`, error?.message);
      }
    }

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

export default router;
