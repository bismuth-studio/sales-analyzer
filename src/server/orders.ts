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
    title: string;
    quantity: number;
    price: string;
  }>;
}

// Get last 10 orders
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

    // Fetch last 10 orders
    const response = await client.get({
      path: 'orders',
      query: {
        limit: '10',
        status: 'any',
        fields: 'id,name,email,created_at,total_price,currency,financial_status,line_items',
      },
    });

    const orders = (response.body as any).orders as Order[];

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

export default router;
