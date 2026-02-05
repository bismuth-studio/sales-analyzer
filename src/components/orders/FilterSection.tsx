import React from 'react';
import {
  Card,
  Text,
  Button,
  TextField,
  FormLayout,
  BlockStack,
  InlineStack,
} from '@shopify/polaris';

export type DatePreset = 'today' | 'yesterday' | 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth' | 'all';

interface FilterSectionProps {
  filterStartDate: string;
  filterStartTime: string;
  filterEndDate: string;
  filterEndTime: string;
  onStartDateChange: (value: string) => void;
  onStartTimeChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onEndTimeChange: (value: string) => void;
  onPresetClick: (preset: DatePreset) => void;
  onCreateDrop?: (startDate: string, startTime: string, endDate: string, endTime: string) => void;
}

export const FilterSection: React.FC<FilterSectionProps> = ({
  filterStartDate,
  filterStartTime,
  filterEndDate,
  filterEndTime,
  onStartDateChange,
  onStartTimeChange,
  onEndDateChange,
  onEndTimeChange,
  onPresetClick,
  onCreateDrop,
}) => {
  const today = new Date().toISOString().split('T')[0];
  const isTodaySelected = filterStartDate === today && filterEndDate === today;

  return (
    <Card>
      <BlockStack gap="400">
        <InlineStack align="space-between">
          <Text as="h2" variant="headingLg">
            Explore Orders
          </Text>
          <InlineStack gap="200">
            <Button
              onClick={() => onPresetClick('today')}
              size="slim"
              variant={isTodaySelected ? 'primary' : 'secondary'}
            >
              Today
            </Button>
            <Button onClick={() => onPresetClick('yesterday')} size="slim">
              Yesterday
            </Button>
            <Button onClick={() => onPresetClick('thisWeek')} size="slim">
              This Week
            </Button>
            <Button onClick={() => onPresetClick('lastWeek')} size="slim">
              Last Week
            </Button>
            <Button onClick={() => onPresetClick('thisMonth')} size="slim">
              This Month
            </Button>
            <Button onClick={() => onPresetClick('lastMonth')} size="slim">
              Last Month
            </Button>
            <Button onClick={() => onPresetClick('all')} size="slim">
              All
            </Button>
          </InlineStack>
        </InlineStack>
        <Text as="p" variant="bodySm" tone="subdued">
          Analyze orders from any date range, including beyond your drop dates
        </Text>
        <FormLayout>
          <FormLayout.Group>
            <TextField
              label="Start Date"
              type="date"
              value={filterStartDate}
              onChange={onStartDateChange}
              autoComplete="off"
            />
            <TextField
              label="Start Time"
              type="time"
              value={filterStartTime}
              onChange={onStartTimeChange}
              autoComplete="off"
            />
            <TextField
              label="End Date"
              type="date"
              value={filterEndDate}
              onChange={onEndDateChange}
              autoComplete="off"
            />
            <TextField
              label="End Time"
              type="time"
              value={filterEndTime}
              onChange={onEndTimeChange}
              autoComplete="off"
            />
          </FormLayout.Group>
        </FormLayout>
        {onCreateDrop && filterStartDate && filterEndDate && (
          <InlineStack align="end">
            <Button
              variant="primary"
              onClick={() => onCreateDrop(filterStartDate, filterStartTime, filterEndDate, filterEndTime)}
            >
              Create Drop from Selection
            </Button>
          </InlineStack>
        )}
      </BlockStack>
    </Card>
  );
};

// Helper to calculate date presets
export const getDatePreset = (preset: DatePreset): { startDate: string; endDate: string; startTime: string; endTime: string } => {
  const today = new Date();
  const formatDate = (date: Date) => date.toISOString().split('T')[0];

  switch (preset) {
    case 'today':
      return {
        startDate: formatDate(today),
        endDate: formatDate(today),
        startTime: '00:00',
        endTime: '23:59',
      };
    case 'yesterday': {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return {
        startDate: formatDate(yesterday),
        endDate: formatDate(yesterday),
        startTime: '00:00',
        endTime: '23:59',
      };
    }
    case 'thisWeek': {
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());
      return {
        startDate: formatDate(startOfWeek),
        endDate: formatDate(today),
        startTime: '00:00',
        endTime: '23:59',
      };
    }
    case 'lastWeek': {
      const startOfLastWeek = new Date(today);
      startOfLastWeek.setDate(today.getDate() - today.getDay() - 7);
      const endOfLastWeek = new Date(startOfLastWeek);
      endOfLastWeek.setDate(startOfLastWeek.getDate() + 6);
      return {
        startDate: formatDate(startOfLastWeek),
        endDate: formatDate(endOfLastWeek),
        startTime: '00:00',
        endTime: '23:59',
      };
    }
    case 'thisMonth': {
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      return {
        startDate: formatDate(startOfMonth),
        endDate: formatDate(today),
        startTime: '00:00',
        endTime: '23:59',
      };
    }
    case 'lastMonth': {
      const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
      return {
        startDate: formatDate(startOfLastMonth),
        endDate: formatDate(endOfLastMonth),
        startTime: '00:00',
        endTime: '23:59',
      };
    }
    case 'all':
      return {
        startDate: '',
        endDate: '',
        startTime: '00:00',
        endTime: '23:59',
      };
    default:
      return {
        startDate: formatDate(today),
        endDate: formatDate(today),
        startTime: '00:00',
        endTime: '23:59',
      };
  }
};
