/**
 * Database Worker Thread
 *
 * This worker handles all SQLite operations in a separate thread to prevent
 * blocking the main event loop. Operations are executed synchronously within
 * the worker but don't block the main Node.js thread.
 */

import Database from 'better-sqlite3';
import path from 'path';
import { randomUUID } from 'crypto';

// Database paths
const dropsDbPath = path.join(__dirname, '../../data/drops.db');

// Initialize database
const db = new Database(dropsDbPath);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// Create tables and run migrations
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

// Migrations
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
try {
  db.exec(`ALTER TABLE drops ADD COLUMN inventory_source TEXT DEFAULT 'auto'`);
} catch {
  // Column already exists
}
try {
  db.exec(`ALTER TABLE drops ADD COLUMN original_inventory_snapshot TEXT`);
} catch {
  // Column already exists
}

// Operation types
export type DatabaseOperation =
  | { type: 'getDropsByShop'; shop: string }
  | { type: 'getDropById'; id: string }
  | { type: 'createDrop'; input: CreateDropInput }
  | { type: 'updateDrop'; id: string; input: UpdateDropInput }
  | { type: 'deleteDrop'; id: string }
  | { type: 'updateDropInventory'; id: string; input: UpdateInventoryInput }
  | { type: 'updateDropOriginalSnapshot'; id: string; snapshot: string };

export interface Drop {
  id: string;
  shop: string;
  title: string;
  start_time: string;
  end_time: string;
  collection_id?: string | null;
  collection_title?: string | null;
  inventory_snapshot?: string | null;
  snapshot_taken_at?: string | null;
  inventory_source?: 'auto' | 'manual' | 'csv' | null;
  original_inventory_snapshot?: string | null;
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

export interface UpdateInventoryInput {
  inventory_snapshot: string;
  inventory_source: 'auto' | 'manual' | 'csv';
}

// Database operation implementations
function getDropsByShop(shop: string): Drop[] {
  const stmt = db.prepare('SELECT * FROM drops WHERE shop = ? ORDER BY start_time DESC');
  return stmt.all(shop) as Drop[];
}

function getDropById(id: string): Drop | undefined {
  const stmt = db.prepare('SELECT * FROM drops WHERE id = ?');
  return stmt.get(id) as Drop | undefined;
}

function createDrop(input: CreateDropInput): Drop {
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

function updateDrop(id: string, input: UpdateDropInput): Drop | undefined {
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

function deleteDrop(id: string): boolean {
  const stmt = db.prepare('DELETE FROM drops WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

function updateDropInventory(id: string, input: UpdateInventoryInput): Drop | undefined {
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

function updateDropOriginalSnapshot(id: string, snapshot: string): void {
  const stmt = db.prepare(`
    UPDATE drops SET original_inventory_snapshot = ? WHERE id = ?
  `);
  stmt.run(snapshot, id);
}

// Worker entry point - this function is called by piscina for each task
export default function handleOperation(operation: DatabaseOperation): unknown {
  switch (operation.type) {
    case 'getDropsByShop':
      return getDropsByShop(operation.shop);

    case 'getDropById':
      return getDropById(operation.id);

    case 'createDrop':
      return createDrop(operation.input);

    case 'updateDrop':
      return updateDrop(operation.id, operation.input);

    case 'deleteDrop':
      return deleteDrop(operation.id);

    case 'updateDropInventory':
      return updateDropInventory(operation.id, operation.input);

    case 'updateDropOriginalSnapshot':
      updateDropOriginalSnapshot(operation.id, operation.snapshot);
      return undefined;

    default:
      throw new Error(`Unknown operation type: ${(operation as any).type}`);
  }
}
