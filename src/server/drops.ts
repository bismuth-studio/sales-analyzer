import { Router, Request, Response } from 'express';
import {
  getDropsByShop,
  getDropById,
  createDrop,
  updateDrop,
  deleteDrop,
} from './database';

const router = Router();

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
router.post('/', (req: Request, res: Response) => {
  const { shop, title, start_time, end_time, collection_id, collection_title } = req.body;

  if (!shop || !title || !start_time || !end_time) {
    res.status(400).json({ error: 'Missing required fields: shop, title, start_time, end_time' });
    return;
  }

  try {
    const drop = createDrop({
      shop,
      title,
      start_time,
      end_time,
      collection_id,
      collection_title,
    });
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
