import React, { useState, useCallback } from 'react';
import {
  Modal,
  BlockStack,
  InlineStack,
  Text,
  Banner,
  Button,
  DropZone,
  IndexTable,
  Badge,
  Select,
} from '@shopify/polaris';
import type { VariantMetadata, CSVPreviewResult } from './InventoryTypes';

interface CSVImportModalProps {
  open: boolean;
  onClose: () => void;
  onImport: (inventory: { [variantId: string]: number }) => void;
  variantMetadata: Map<string, VariantMetadata>;
  existingVariantIds: string[];
}

type Step = 'upload' | 'preview';

function CSVImportModal({
  open,
  onClose,
  onImport,
  variantMetadata,
  existingVariantIds,
}: CSVImportModalProps) {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [previewResult, setPreviewResult] = useState<CSVPreviewResult | null>(null);
  const [matchType, setMatchType] = useState<'sku' | 'variant_id'>('sku');

  const resetState = useCallback(() => {
    setStep('upload');
    setFile(null);
    setParseError(null);
    setPreviewResult(null);
    setMatchType('sku');
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [onClose, resetState]);

  const parseCSV = (text: string): Array<{ [key: string]: string }> => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) {
      throw new Error('CSV must have a header row and at least one data row');
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
    const rows: Array<{ [key: string]: string }> = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/['"]/g, ''));
      if (values.length !== headers.length) continue;

      const row: { [key: string]: string } = {};
      headers.forEach((header, index) => {
        row[header] = values[index];
      });
      rows.push(row);
    }

    return rows;
  };

  const matchRows = useCallback(
    (rows: Array<{ [key: string]: string }>, type: 'sku' | 'variant_id'): CSVPreviewResult => {
      const matched: CSVPreviewResult['matched'] = [];
      const unmatched: string[] = [];

      // Build lookup maps
      const skuToVariantId = new Map<string, string>();
      const variantIdSet = new Set(existingVariantIds);

      variantMetadata.forEach((meta, variantId) => {
        if (meta.sku) {
          skuToVariantId.set(meta.sku.toLowerCase(), variantId);
        }
      });

      for (const row of rows) {
        const identifier = type === 'sku' ? row.sku : row.variant_id;
        const quantityStr = row.quantity || row.inventory || row.qty;
        const quantity = parseInt(quantityStr, 10);

        if (!identifier || isNaN(quantity) || quantity < 0) {
          if (identifier) {
            unmatched.push(identifier);
          }
          continue;
        }

        let variantId: string | undefined;

        if (type === 'sku') {
          variantId = skuToVariantId.get(identifier.toLowerCase());
        } else {
          variantId = variantIdSet.has(identifier) ? identifier : undefined;
        }

        if (variantId) {
          const meta = variantMetadata.get(variantId);
          matched.push({
            identifier,
            variantId,
            productName: meta?.productName || 'Unknown',
            variantName: meta?.variantName || 'Unknown',
            sku: meta?.sku || '',
            quantity,
          });
        } else {
          unmatched.push(identifier);
        }
      }

      return { matched, unmatched, matchType: type };
    },
    [variantMetadata, existingVariantIds]
  );

  const handleDrop = useCallback(
    (_droppedFiles: File[], acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        const f = acceptedFiles[0];
        setFile(f);
        setParseError(null);

        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const text = e.target?.result as string;
            const rows = parseCSV(text);

            // Detect match type from headers
            const hasSkuColumn = rows.length > 0 && ('sku' in rows[0]);
            const hasVariantIdColumn = rows.length > 0 && ('variant_id' in rows[0]);

            let detectedType: 'sku' | 'variant_id' = 'sku';
            if (hasVariantIdColumn && !hasSkuColumn) {
              detectedType = 'variant_id';
            }
            setMatchType(detectedType);

            const result = matchRows(rows, detectedType);
            setPreviewResult(result);
            setStep('preview');
          } catch (err) {
            setParseError(err instanceof Error ? err.message : 'Failed to parse CSV');
          }
        };
        reader.onerror = () => {
          setParseError('Failed to read file');
        };
        reader.readAsText(f);
      }
    },
    [matchRows]
  );

  const handleMatchTypeChange = useCallback(
    (value: string) => {
      const newType = value as 'sku' | 'variant_id';
      setMatchType(newType);

      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const text = e.target?.result as string;
            const rows = parseCSV(text);
            const result = matchRows(rows, newType);
            setPreviewResult(result);
          } catch (err) {
            setParseError(err instanceof Error ? err.message : 'Failed to parse CSV');
          }
        };
        reader.readAsText(file);
      }
    },
    [file, matchRows]
  );

  const handleImport = useCallback(() => {
    if (!previewResult) return;

    const inventory: { [variantId: string]: number } = {};
    for (const item of previewResult.matched) {
      inventory[item.variantId] = item.quantity;
    }
    onImport(inventory);
  }, [previewResult, onImport]);

  const downloadTemplate = useCallback(() => {
    const csvContent = 'sku,quantity\nEXAMPLE-SKU-001,50\nEXAMPLE-SKU-002,100\n';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.setAttribute('href', URL.createObjectURL(blob));
    link.setAttribute('download', 'inventory_template.csv');
    link.click();
  }, []);

  const renderUploadStep = () => (
    <BlockStack gap="400">
      <Text as="p" variant="bodyMd">
        Upload a CSV file with inventory quantities. The file should have columns for either SKU or Variant ID, plus a quantity column.
      </Text>

      <DropZone onDrop={handleDrop} accept=".csv" type="file" allowMultiple={false}>
        <DropZone.FileUpload actionTitle="Add file" actionHint="or drop file to upload" />
      </DropZone>

      {parseError && (
        <Banner tone="critical">
          {parseError}
        </Banner>
      )}

      <InlineStack gap="200" align="end">
        <Button onClick={downloadTemplate}>Download Template</Button>
      </InlineStack>

      <Banner tone="info">
        <Text as="p" variant="bodySm">
          Expected CSV format:
        </Text>
        <Text as="p" variant="bodySm" fontWeight="semibold">
          sku,quantity
        </Text>
        <Text as="p" variant="bodySm">
          or
        </Text>
        <Text as="p" variant="bodySm" fontWeight="semibold">
          variant_id,quantity
        </Text>
      </Banner>
    </BlockStack>
  );

  const renderPreviewStep = () => {
    if (!previewResult) return null;

    return (
      <BlockStack gap="400">
        <InlineStack gap="400" blockAlign="center">
          <Select
            label="Match by"
            options={[
              { label: 'SKU', value: 'sku' },
              { label: 'Variant ID', value: 'variant_id' },
            ]}
            value={matchType}
            onChange={handleMatchTypeChange}
          />
          <Text as="span" variant="bodySm" tone="subdued">
            {previewResult.matched.length} matched, {previewResult.unmatched.length} unmatched
          </Text>
        </InlineStack>

        {previewResult.unmatched.length > 0 && (
          <Banner tone="warning">
            <Text as="p" variant="bodySm" fontWeight="semibold">
              {previewResult.unmatched.length} items could not be matched:
            </Text>
            <Text as="p" variant="bodySm">
              {previewResult.unmatched.slice(0, 10).join(', ')}
              {previewResult.unmatched.length > 10 && ` and ${previewResult.unmatched.length - 10} more...`}
            </Text>
          </Banner>
        )}

        {previewResult.matched.length > 0 ? (
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            <IndexTable
              resourceName={{ singular: 'item', plural: 'items' }}
              itemCount={previewResult.matched.length}
              headings={[
                { title: matchType === 'sku' ? 'SKU' : 'Variant ID' },
                { title: 'Product' },
                { title: 'Variant' },
                { title: 'Quantity' },
              ]}
              selectable={false}
            >
              {previewResult.matched.map((item, index) => (
                <IndexTable.Row id={item.variantId} key={item.variantId} position={index}>
                  <IndexTable.Cell>
                    <Text as="span" variant="bodyMd">{item.identifier}</Text>
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <Text as="span" variant="bodyMd">{item.productName}</Text>
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <Text as="span" variant="bodyMd">{item.variantName}</Text>
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <Badge tone="success">{item.quantity}</Badge>
                  </IndexTable.Cell>
                </IndexTable.Row>
              ))}
            </IndexTable>
          </div>
        ) : (
          <Banner tone="critical">
            No items could be matched. Please check your CSV file and try again.
          </Banner>
        )}

        <InlineStack gap="200">
          <Button onClick={() => setStep('upload')}>Back</Button>
        </InlineStack>
      </BlockStack>
    );
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={step === 'upload' ? 'Import Inventory from CSV' : 'Preview Import'}
      primaryAction={
        step === 'preview' && previewResult && previewResult.matched.length > 0
          ? {
              content: `Import ${previewResult.matched.length} items`,
              onAction: handleImport,
            }
          : undefined
      }
      secondaryActions={[
        {
          content: 'Cancel',
          onAction: handleClose,
        },
      ]}
      size="large"
    >
      <Modal.Section>
        {step === 'upload' ? renderUploadStep() : renderPreviewStep()}
      </Modal.Section>
    </Modal>
  );
}

export default CSVImportModal;
