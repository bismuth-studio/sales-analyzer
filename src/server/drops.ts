import { Router, Request, Response, NextFunction } from 'express';
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

// Extend Request type to include validatedShop
interface AuthenticatedRequest extends Request {
  validatedShop?: string;
}

/**
 * Middleware to verify shop authentication
 * Validates shop format and checks for active session
 */
function requireShopAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const shop = (req.query.shop || req.body?.shop) as string;

  if (!shop) {
    res.status(400).json({ error: 'Missing shop parameter' });
    return;
  }

  // Validate shop format (must be *.myshopify.com)
  if (!shop.match(/^[\w-]+\.myshopify\.com$/)) {
    res.status(400).json({ error: 'Invalid shop domain format' });
    return;
  }

  const session = getSession(shop);
  if (!session) {
    res.status(401).json({ error: 'Not authenticated for this shop' });
    return;
  }

  // Attach validated shop to request for use in handlers
  req.validatedShop = shop;
  next();
}

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
router.get('/', requireShopAuth, async (req: AuthenticatedRequest, res: Response) => {
  const shop = req.validatedShop!;

  try {
    const drops = await getDropsByShop(shop);
    res.json({ drops });
  } catch (error) {
    console.error('Error fetching drops:', error);
    res.status(500).json({ error: 'Failed to fetch drops' });
  }
});

// GET /api/drops/:id - Get a single drop
router.get('/:id', requireShopAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const shop = req.validatedShop!;

  try {
    const drop = await getDropById(id);
    if (!drop) {
      res.status(404).json({ error: 'Drop not found' });
      return;
    }
    // Verify drop belongs to the authenticated shop
    if (drop.shop !== shop) {
      res.status(403).json({ error: 'Access denied to this drop' });
      return;
    }
    res.json({ drop });
  } catch (error) {
    console.error('Error fetching drop:', error);
    res.status(500).json({ error: 'Failed to fetch drop' });
  }
});

// POST /api/drops - Create a new drop
router.post('/', requireShopAuth, async (req: AuthenticatedRequest, res: Response) => {
  const shop = req.validatedShop!;
  const { title, start_time, end_time, collection_id, collection_title } = req.body;

  if (!title || !start_time || !end_time) {
    res.status(400).json({ error: 'Missing required fields: title, start_time, end_time' });
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
router.put('/:id', requireShopAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const shop = req.validatedShop!;
  const { title, start_time, end_time, collection_id, collection_title } = req.body;

  try {
    // First verify the drop belongs to this shop
    const existingDrop = await getDropById(id);
    if (!existingDrop) {
      res.status(404).json({ error: 'Drop not found' });
      return;
    }
    if (existingDrop.shop !== shop) {
      res.status(403).json({ error: 'Access denied to this drop' });
      return;
    }

    const drop = await updateDrop(id, {
      title,
      start_time,
      end_time,
      collection_id,
      collection_title,
    });

    res.json({ drop });
  } catch (error) {
    console.error('Error updating drop:', error);
    res.status(500).json({ error: 'Failed to update drop' });
  }
});

// DELETE /api/drops/:id - Delete a drop
router.delete('/:id', requireShopAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const shop = req.validatedShop!;

  try {
    // First verify the drop belongs to this shop
    const existingDrop = await getDropById(id);
    if (!existingDrop) {
      res.status(404).json({ error: 'Drop not found' });
      return;
    }
    if (existingDrop.shop !== shop) {
      res.status(403).json({ error: 'Access denied to this drop' });
      return;
    }

    await deleteDrop(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting drop:', error);
    res.status(500).json({ error: 'Failed to delete drop' });
  }
});

// PUT /api/drops/:id/inventory - Update inventory snapshot (manual edit or CSV import)
router.put('/:id/inventory', requireShopAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const shop = req.validatedShop!;
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
    if (drop.shop !== shop) {
      res.status(403).json({ error: 'Access denied to this drop' });
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
router.post('/:id/inventory/snapshot', requireShopAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const shop = req.validatedShop!;

  try {
    const drop = await getDropById(id);
    if (!drop) {
      res.status(404).json({ error: 'Drop not found' });
      return;
    }
    if (drop.shop !== shop) {
      res.status(403).json({ error: 'Access denied to this drop' });
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
router.post('/:id/inventory/reset', requireShopAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const shop = req.validatedShop!;

  try {
    const drop = await getDropById(id);
    if (!drop) {
      res.status(404).json({ error: 'Drop not found' });
      return;
    }
    if (drop.shop !== shop) {
      res.status(403).json({ error: 'Access denied to this drop' });
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
