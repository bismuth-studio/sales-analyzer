import { Router, Request, Response } from 'express';
import {
  getDropsByShop,
  getDropById,
  createDrop,
  updateDrop,
  deleteDrop,
} from './database';
import { getSession, shopify } from './shopify';

const router = Router();

// Helper function to fetch inventory snapshot from Shopify
async function fetchInventorySnapshot(shop: string): Promise<{ [variantId: string]: number } | null> {
  try {
    const session = getSession(shop);
    if (!session) {
      console.log('No session found for inventory snapshot');
      return null;
    }

    const client = new shopify.clients.Graphql({ session });
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
            const variantId = variant.id.split('/').pop();
            const quantity = variant.inventoryQuantity ?? 0;
            allInventory[variantId] = quantity;
          }
        }
      }

      hasNextPage = products?.pageInfo?.hasNextPage || false;
      cursor = products?.pageInfo?.endCursor || null;
    }

    console.log(`Captured inventory snapshot: ${Object.keys(allInventory).length} variants`);
    return allInventory;
  } catch (error: any) {
    console.error('Error fetching inventory snapshot:', error?.message || error);
    return null;
  }
}

// GET /api/drops - List all drops for a shop
router.get('/', (req: Request, res: Response) => {
  const shop = req.query.shop as string;

  if (!shop) {
    res.status(400).json({ error: 'Missing shop parameter' });
    return;
  }

  try {
    const drops = getDropsByShop(shop);
    res.json({ drops });
  } catch (error) {
    console.error('Error fetching drops:', error);
    res.status(500).json({ error: 'Failed to fetch drops' });
  }
});

// GET /api/drops/:id - Get a single drop
router.get('/:id', (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const drop = getDropById(id);
    if (!drop) {
      res.status(404).json({ error: 'Drop not found' });
      return;
    }
    res.json({ drop });
  } catch (error) {
    console.error('Error fetching drop:', error);
    res.status(500).json({ error: 'Failed to fetch drop' });
  }
});

// POST /api/drops - Create a new drop
router.post('/', async (req: Request, res: Response) => {
  const { shop, title, start_time, end_time, collection_id, collection_title } = req.body;

  if (!shop || !title || !start_time || !end_time) {
    res.status(400).json({ error: 'Missing required fields: shop, title, start_time, end_time' });
    return;
  }

  try {
    // Fetch inventory snapshot from Shopify
    console.log('Capturing inventory snapshot for new drop...');
    const inventorySnapshot = await fetchInventorySnapshot(shop);
    const snapshotTakenAt = inventorySnapshot ? new Date().toISOString() : null;

    const drop = createDrop({
      shop,
      title,
      start_time,
      end_time,
      collection_id,
      collection_title,
      inventory_snapshot: inventorySnapshot ? JSON.stringify(inventorySnapshot) : null,
      snapshot_taken_at: snapshotTakenAt,
    });

    console.log(`Drop created with inventory snapshot: ${inventorySnapshot ? 'yes' : 'no'}`);
    res.status(201).json({ drop });
  } catch (error) {
    console.error('Error creating drop:', error);
    res.status(500).json({ error: 'Failed to create drop' });
  }
});

// PUT /api/drops/:id - Update a drop
router.put('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const { title, start_time, end_time, collection_id, collection_title } = req.body;

  try {
    const drop = updateDrop(id, {
      title,
      start_time,
      end_time,
      collection_id,
      collection_title,
    });

    if (!drop) {
      res.status(404).json({ error: 'Drop not found' });
      return;
    }

    res.json({ drop });
  } catch (error) {
    console.error('Error updating drop:', error);
    res.status(500).json({ error: 'Failed to update drop' });
  }
});

// DELETE /api/drops/:id - Delete a drop
router.delete('/:id', (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const deleted = deleteDrop(id);
    if (!deleted) {
      res.status(404).json({ error: 'Drop not found' });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting drop:', error);
    res.status(500).json({ error: 'Failed to delete drop' });
  }
});

export default router;
