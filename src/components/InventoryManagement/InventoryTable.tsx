import React, { useState } from 'react';
import {
  IndexTable,
  TextField,
  Badge,
  Text,
  useIndexResourceState,
} from '@shopify/polaris';
import type { InventoryItem } from './InventoryTypes';

interface InventoryTableProps {
  items: InventoryItem[];
  onQuantityChange: (variantId: string, newQuantity: number) => void;
  disabled: boolean;
}

function InventoryTable({ items, onQuantityChange, disabled }: InventoryTableProps) {
  const [editingValues, setEditingValues] = useState<{ [key: string]: string }>({});

  const resourceName = {
    singular: 'variant',
    plural: 'variants',
  };

  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(items.map(item => ({ id: item.variantId })));

  const handleQuantityBlur = (variantId: string, value: string) => {
    const num = parseInt(value, 10);
    if (!isNaN(num) && num >= 0) {
      onQuantityChange(variantId, num);
    }
    // Clear the editing state
    setEditingValues(prev => {
      const next = { ...prev };
      delete next[variantId];
      return next;
    });
  };

  const handleQuantityKeyDown = (variantId: string, value: string, event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleQuantityBlur(variantId, value);
    }
  };

  const getSourceBadge = (source: InventoryItem['source']) => {
    switch (source) {
      case 'snapshot':
        return <Badge tone="success">Snapshot</Badge>;
      case 'manual':
        return <Badge tone="attention">Manual</Badge>;
      case 'csv':
        return <Badge tone="info">CSV Import</Badge>;
      case 'estimated':
        return <Badge tone="warning">Estimated</Badge>;
      default:
        return <Badge>Unknown</Badge>;
    }
  };

  const rowMarkup = items.map((item, index) => {
    const currentValue = editingValues[item.variantId] ?? String(item.initialInventory);

    return (
      <IndexTable.Row
        id={item.variantId}
        key={item.variantId}
        position={index}
        selected={selectedResources.includes(item.variantId)}
      >
        <IndexTable.Cell>
          <Text as="span" variant="bodyMd" fontWeight={item.isModified ? 'semibold' : 'regular'}>
            {index + 1}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text as="span" variant="bodyMd">
            {item.sku || '-'}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text as="span" variant="bodyMd">
            {item.productName}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text as="span" variant="bodyMd">
            {item.variantName}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <div style={{ maxWidth: '100px' }}>
            <TextField
              label=""
              labelHidden
              type="number"
              value={currentValue}
              onChange={(value) => {
                setEditingValues(prev => ({ ...prev, [item.variantId]: value }));
              }}
              onBlur={() => handleQuantityBlur(item.variantId, currentValue)}
              onKeyDown={(event) => handleQuantityKeyDown(item.variantId, currentValue, event)}
              disabled={disabled}
              min={0}
              autoComplete="off"
            />
          </div>
        </IndexTable.Cell>
        <IndexTable.Cell>
          {getSourceBadge(item.source)}
          {item.isModified && (
            <span style={{ marginLeft: '8px' }}>
              <Badge tone="attention">Modified</Badge>
            </span>
          )}
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  return (
    <IndexTable
      resourceName={resourceName}
      itemCount={items.length}
      selectedItemsCount={allResourcesSelected ? 'All' : selectedResources.length}
      onSelectionChange={handleSelectionChange}
      headings={[
        { title: '#' },
        { title: 'SKU' },
        { title: 'Product' },
        { title: 'Variant' },
        { title: 'Initial Inventory' },
        { title: 'Source' },
      ]}
      selectable={false}
    >
      {rowMarkup}
    </IndexTable>
  );
}

export default InventoryTable;
