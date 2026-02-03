export interface InventoryItem {
  variantId: string;
  sku: string;
  productName: string;
  variantName: string;
  initialInventory: number;
  source: 'snapshot' | 'manual' | 'csv' | 'estimated';
  isModified: boolean;
}

export interface VariantMetadata {
  variantId: string;
  sku: string;
  variantName: string;
  productName: string;
}

export interface CSVRow {
  sku?: string;
  variant_id?: string;
  quantity: number;
}

export interface CSVPreviewResult {
  matched: Array<{
    identifier: string;
    variantId: string;
    productName: string;
    variantName: string;
    sku: string;
    quantity: number;
  }>;
  unmatched: string[];
  matchType: 'sku' | 'variant_id';
}

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
