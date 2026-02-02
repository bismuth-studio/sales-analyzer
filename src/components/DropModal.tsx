import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  FormLayout,
  TextField,
  BlockStack,
  Text,
  Banner,
  Select,
} from '@shopify/polaris';

interface Drop {
  id: string;
  shop: string;
  title: string;
  start_time: string;
  end_time: string;
  collection_id?: string | null;
  collection_title?: string | null;
  created_at: string;
  updated_at: string;
}

interface DropModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (drop: Drop, isNew: boolean) => void;
  shop: string;
  editingDrop: Drop | null;
}

interface Collection {
  id: string;
  title: string;
}

function DropModal({ open, onClose, onSave, shop, editingDrop }: DropModalProps) {
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [collectionId, setCollectionId] = useState<string>('');
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when modal opens/closes or editingDrop changes
  useEffect(() => {
    if (open) {
      if (editingDrop) {
        setTitle(editingDrop.title);
        const start = new Date(editingDrop.start_time);
        const end = new Date(editingDrop.end_time);
        setStartDate(start.toISOString().split('T')[0]);
        setStartTime(start.toTimeString().slice(0, 5));
        setEndDate(end.toISOString().split('T')[0]);
        setEndTime(end.toTimeString().slice(0, 5));
        setCollectionId(editingDrop.collection_id || '');
      } else {
        // Default to today for new drops
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        setTitle('');
        setStartDate(today);
        setStartTime('00:00');
        setEndDate(today);
        setEndTime('23:59');
        setCollectionId('');
      }
      setError(null);
    }
  }, [open, editingDrop]);

  const handleSave = useCallback(async () => {
    if (!title.trim()) {
      setError('Please enter a title for the drop');
      return;
    }

    if (!startDate || !startTime || !endDate || !endTime) {
      setError('Please fill in all date and time fields');
      return;
    }

    const startDateTime = new Date(`${startDate}T${startTime}`);
    const endDateTime = new Date(`${endDate}T${endTime}`);

    if (endDateTime <= startDateTime) {
      setError('End time must be after start time');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const selectedCollection = collections.find(c => c.id === collectionId);
      const payload = {
        shop,
        title: title.trim(),
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        collection_id: collectionId || null,
        collection_title: selectedCollection?.title || null,
      };

      const url = editingDrop ? `/api/drops/${editingDrop.id}` : '/api/drops';
      const method = editingDrop ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save drop');
      }

      const data = await response.json();
      onSave(data.drop, !editingDrop);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save drop');
    } finally {
      setLoading(false);
    }
  }, [title, startDate, startTime, endDate, endTime, collectionId, collections, shop, editingDrop, onSave]);

  const collectionOptions = [
    { label: 'All products', value: '' },
    ...collections.map(c => ({ label: c.title, value: c.id })),
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editingDrop ? 'Edit Drop' : 'Create New Drop'}
      primaryAction={{
        content: editingDrop ? 'Save' : 'Create',
        onAction: handleSave,
        loading,
      }}
      secondaryActions={[
        {
          content: 'Cancel',
          onAction: onClose,
        },
      ]}
    >
      <Modal.Section>
        <BlockStack gap="400">
          {error && (
            <Banner tone="critical" onDismiss={() => setError(null)}>
              {error}
            </Banner>
          )}

          <FormLayout>
            <TextField
              label="Drop Title"
              value={title}
              onChange={setTitle}
              placeholder="e.g., Summer Collection Launch"
              autoComplete="off"
            />

            <FormLayout.Group>
              <TextField
                label="Start Date"
                type="date"
                value={startDate}
                onChange={setStartDate}
                autoComplete="off"
              />
              <TextField
                label="Start Time"
                type="time"
                value={startTime}
                onChange={setStartTime}
                autoComplete="off"
              />
            </FormLayout.Group>

            <FormLayout.Group>
              <TextField
                label="End Date"
                type="date"
                value={endDate}
                onChange={setEndDate}
                autoComplete="off"
              />
              <TextField
                label="End Time"
                type="time"
                value={endTime}
                onChange={setEndTime}
                autoComplete="off"
              />
            </FormLayout.Group>

            <Select
              label="Collection (optional)"
              options={collectionOptions}
              value={collectionId}
              onChange={setCollectionId}
              helpText="Filter analysis to a specific collection"
            />
          </FormLayout>

          <Text as="p" variant="bodySm" tone="subdued">
            The drop will track all orders placed between the start and end times.
          </Text>
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}

export default DropModal;
