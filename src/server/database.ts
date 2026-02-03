import Database from 'better-sqlite3';
import path from 'path';
import { randomUUID } from 'crypto';

const dbPath = path.join(__dirname, '../../data/drops.db');
const db = new Database(dbPath);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// Create drops table
db.exec(`
  CREATE TABLE IF NOT EXISTS drops (
    id TEXT PRIMARY KEY,
    shop TEXT NOT NULL,
    title TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    collection_id TEXT,
    collection_title TEXT,
    inventory_snapshot TEXT,
    snapshot_taken_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_drops_shop ON drops(shop);
  CREATE INDEX IF NOT EXISTS idx_drops_start_time ON drops(start_time);
`);

// Migration: Add inventory_snapshot column if it doesn't exist
try {
  db.exec(`ALTER TABLE drops ADD COLUMN inventory_snapshot TEXT`);
} catch {
  // Column already exists
}
try {
  db.exec(`ALTER TABLE drops ADD COLUMN snapshot_taken_at TEXT`);
} catch {
  // Column already exists
}
// Migration: Add inventory_source column to track origin of inventory data
try {
  db.exec(`ALTER TABLE drops ADD COLUMN inventory_source TEXT DEFAULT 'auto'`);
} catch {
  // Column already exists
}
// Migration: Add original_inventory_snapshot to preserve auto-captured snapshot for reset
try {
  db.exec(`ALTER TABLE drops ADD COLUMN original_inventory_snapshot TEXT`);
} catch {
  // Column already exists
}

export interface Drop {
  id: string;
  shop: string;
  title: string;
  start_time: string;
  end_time: string;
  collection_id?: string | null;
  collection_title?: string | null;
  inventory_snapshot?: string | null; // JSON string: { [variantId: string]: number }
  snapshot_taken_at?: string | null;
  inventory_source?: 'auto' | 'manual' | 'csv' | null; // Origin of inventory data
  original_inventory_snapshot?: string | null; // Preserved auto-snapshot for reset
  created_at: string;
  updated_at: string;
}

export interface CreateDropInput {
  shop: string;
  title: string;
  start_time: string;
  end_time: string;
  collection_id?: string | null;
  collection_title?: string | null;
  inventory_snapshot?: string | null;
  snapshot_taken_at?: string | null;
}

export interface UpdateDropInput {
  title?: string;
  start_time?: string;
  end_time?: string;
  collection_id?: string | null;
  collection_title?: string | null;
}

// Get all drops for a shop
export function getDropsByShop(shop: string): Drop[] {
  const stmt = db.prepare('SELECT * FROM drops WHERE shop = ? ORDER BY start_time DESC');
  return stmt.all(shop) as Drop[];
}

// Get a single drop by ID
export function getDropById(id: string): Drop | undefined {
  const stmt = db.prepare('SELECT * FROM drops WHERE id = ?');
  return stmt.get(id) as Drop | undefined;
}

// Create a new drop
export function createDrop(input: CreateDropInput): Drop {
  const id = randomUUID();
  const stmt = db.prepare(`
    INSERT INTO drops (id, shop, title, start_time, end_time, collection_id, collection_title, inventory_snapshot, snapshot_taken_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    input.shop,
    input.title,
    input.start_time,
    input.end_time,
    input.collection_id || null,
    input.collection_title || null,
    input.inventory_snapshot || null,
    input.snapshot_taken_at || null
  );

  return getDropById(id)!;
}

// Update a drop
export function updateDrop(id: string, input: UpdateDropInput): Drop | undefined {
  const existing = getDropById(id);
  if (!existing) return undefined;

  const updates: string[] = [];
  const values: (string | null)[] = [];

  if (input.title !== undefined) {
    updates.push('title = ?');
    values.push(input.title);
  }
  if (input.start_time !== undefined) {
    updates.push('start_time = ?');
    values.push(input.start_time);
  }
  if (input.end_time !== undefined) {
    updates.push('end_time = ?');
    values.push(input.end_time);
  }
  if (input.collection_id !== undefined) {
    updates.push('collection_id = ?');
    values.push(input.collection_id);
  }
  if (input.collection_title !== undefined) {
    updates.push('collection_title = ?');
    values.push(input.collection_title);
  }

  if (updates.length > 0) {
    updates.push("updated_at = datetime('now')");
    values.push(id);

    const stmt = db.prepare(`UPDATE drops SET ${updates.join(', ')} WHERE id = ?`);
    stmt.run(...values);
  }

  return getDropById(id);
}

// Delete a drop
export function deleteDrop(id: string): boolean {
  const stmt = db.prepare('DELETE FROM drops WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

// Update drop inventory snapshot
export function updateDropInventory(
  id: string,
  input: {
    inventory_snapshot: string;
    inventory_source: 'auto' | 'manual' | 'csv';
  }
): Drop | undefined {
  const stmt = db.prepare(`
    UPDATE drops
    SET inventory_snapshot = ?,
        inventory_source = ?,
        snapshot_taken_at = datetime('now'),
        updated_at = datetime('now')
    WHERE id = ?
  `);
  stmt.run(input.inventory_snapshot, input.inventory_source, id);
  return getDropById(id);
}

// Update original inventory snapshot (for reset functionality)
export function updateDropOriginalSnapshot(id: string, snapshot: string): void {
  const stmt = db.prepare(`
    UPDATE drops SET original_inventory_snapshot = ? WHERE id = ?
  `);
  stmt.run(snapshot, id);
}

export default db;
