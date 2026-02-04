import { Router, Request, Response } from 'express';
import {
  getDropsByShop,
  getDropById,
  createDrop,
  updateDrop,
  deleteDrop,
  updateDropInventory,
  updateDropOriginalSnapshot,
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
router.get('/', async (req: Request, res: Response) => {
  const shop = req.query.shop as string;

  if (!shop) {
    res.status(400).json({ error: 'Missing shop parameter' });
    return;
  }

  try {
    const drops = await getDropsByShop(shop);
    res.json({ drops });
  } catch (error) {
    console.error('Error fetching drops:', error);
    res.status(500).json({ error: 'Failed to fetch drops' });
  }
});

// GET /api/drops/:id - Get a single drop
router.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const drop = await getDropById(id);
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

    const drop = await createDrop({
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
router.put('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { title, start_time, end_time, collection_id, collection_title } = req.body;

  try {
    const drop = await updateDrop(id, {
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
router.delete('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const deleted = await deleteDrop(id);
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

// PUT /api/drops/:id/inventory - Update inventory snapshot (manual edit or CSV import)
router.put('/:id/inventory', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { inventory, source } = req.body;
  // inventory: { [variantId: string]: number }
  // source: 'manual' | 'csv'

  if (!inventory || typeof inventory !== 'object') {
    res.status(400).json({ error: 'Invalid inventory data' });
    return;
  }

  const validSources = ['manual', 'csv'];
  const inventorySource = validSources.includes(source) ? source : 'manual';

  try {
    const drop = await getDropById(id);
    if (!drop) {
      res.status(404).json({ error: 'Drop not found' });
      return;
    }

    // Preserve original snapshot if this is first manual edit
    if (!drop.original_inventory_snapshot && drop.inventory_snapshot) {
      await updateDropOriginalSnapshot(id, drop.inventory_snapshot);
    }

    const updatedDrop = await updateDropInventory(id, {
      inventory_snapshot: JSON.stringify(inventory),
      inventory_source: inventorySource,
    });

    res.json({ drop: updatedDrop });
  } catch (error) {
    console.error('Error updating inventory:', error);
    res.status(500).json({ error: 'Failed to update inventory' });
  }
});

// POST /api/drops/:id/inventory/snapshot - Take fresh snapshot from Shopify
router.post('/:id/inventory/snapshot', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { shop } = req.body;

  if (!shop) {
    res.status(400).json({ error: 'Missing shop parameter' });
    return;
  }

  try {
    const drop = await getDropById(id);
    if (!drop) {
      res.status(404).json({ error: 'Drop not found' });
      return;
    }

    // Fetch fresh inventory from Shopify
    const inventorySnapshot = await fetchInventorySnapshot(shop);

    if (!inventorySnapshot) {
      res.status(500).json({ error: 'Failed to fetch inventory from Shopify' });
      return;
    }

    const snapshotJson = JSON.stringify(inventorySnapshot);

    // Update both snapshot and original
    const updatedDrop = await updateDropInventory(id, {
      inventory_snapshot: snapshotJson,
      inventory_source: 'auto',
    });

    // Also update original_inventory_snapshot
    await updateDropOriginalSnapshot(id, snapshotJson);

    res.json({
      drop: updatedDrop,
      snapshotTime: new Date().toISOString(),
      variantCount: Object.keys(inventorySnapshot).length,
    });
  } catch (error) {
    console.error('Error taking inventory snapshot:', error);
    res.status(500).json({ error: 'Failed to take inventory snapshot' });
  }
});

// POST /api/drops/:id/inventory/reset - Reset to original snapshot
router.post('/:id/inventory/reset', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const drop = await getDropById(id);
    if (!drop) {
      res.status(404).json({ error: 'Drop not found' });
      return;
    }

    if (!drop.original_inventory_snapshot) {
      res.status(400).json({ error: 'No original snapshot to reset to' });
      return;
    }

    const updatedDrop = await updateDropInventory(id, {
      inventory_snapshot: drop.original_inventory_snapshot,
      inventory_source: 'auto',
    });

    res.json({ drop: updatedDrop });
  } catch (error) {
    console.error('Error resetting inventory:', error);
    res.status(500).json({ error: 'Failed to reset inventory' });
  }
});

export default router;
