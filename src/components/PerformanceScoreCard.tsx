import React, { useState } from 'react';
import { Card, BlockStack, InlineStack, Text, Badge, Button } from '@shopify/polaris';
import { ChevronUpIcon, ChevronDownIcon } from '@shopify/polaris-icons';
import type { DropPerformanceScore, ComponentScore, Insight } from '../utils/dropScore';

interface PerformanceScoreCardProps {
  score: DropPerformanceScore | null;
}

export default function PerformanceScoreCard({ score }: PerformanceScoreCardProps) {
  const [collapsed, setCollapsed] = useState(true);
  const [expanded, setExpanded] = useState(false);

  if (!score) return null;

  return (
    <Card>
      <BlockStack gap="400">
        {/* Header with collapse button */}
        <InlineStack align="space-between" blockAlign="center">
          <InlineStack gap="300" blockAlign="center">
            <Text as="h2" variant="headingLg">
              Drop Performance Score
            </Text>
            <InlineStack gap="200" blockAlign="center">
              <Badge tone={getGradeTone(score.grade)} size="medium">
                {score.grade}
              </Badge>
              <Text as="span" variant="bodySm" tone="subdued">
                {Math.round(score.overall)}/100
              </Text>
            </InlineStack>
          </InlineStack>
          <Button
            plain
            icon={collapsed ? ChevronDownIcon : ChevronUpIcon}
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? 'Expand' : 'Collapse'}
          </Button>
        </InlineStack>

        {/* Card content (collapsible) */}
        {!collapsed && (
          <>
            {/* Large score display */}
            <InlineStack align="center" gap="800" wrap>
              <div style={styles.scoreCircleContainer}>
                <div style={styles.scoreCircle}>
                  <Text as="p" variant="heading2xl" fontWeight="bold">
                    {Math.round(score.overall)}
                  </Text>
                </div>
              </div>

              <BlockStack gap="200">
                <Badge tone={getGradeTone(score.grade)} size="large">
                  {score.grade} Grade
                </Badge>
                <Text as="p" variant="headingMd">
                  {score.gradeDescription}
                </Text>
              </BlockStack>
            </InlineStack>

            {/* Show Details button */}
            <InlineStack align="center">
              <Button
                plain
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? 'Hide Details' : 'Show Details'}
              </Button>
            </InlineStack>

            {/* Component breakdown (expandable) */}
            {expanded && (
              <BlockStack gap="300">
                <Text as="h3" variant="headingSm" tone="subdued">
                  Score Breakdown
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  Individual performance metrics that contribute to your overall score
                </Text>
                <BlockStack gap="300">
                  <ComponentScoreBar component={score.components.salesVelocity} />
                  <ComponentScoreBar component={score.components.sellThroughRate} />
                  <ComponentScoreBar component={score.components.revenuePerformance} />
                  <ComponentScoreBar component={score.components.customerEngagement} />
                  <ComponentScoreBar component={score.components.productDiversity} />
                  <ComponentScoreBar component={score.components.timeEfficiency} />
                </BlockStack>
              </BlockStack>
            )}

            {/* Insights */}
            {score.insights.length > 0 && (
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm" tone="subdued">
                  Insights & Recommendations
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  Key takeaways and actionable suggestions to improve your drop performance
                </Text>
                <BlockStack gap="200">
                  {score.insights.map((insight, idx) => (
                    <InsightBanner key={idx} insight={insight} />
                  ))}
                </BlockStack>
              </BlockStack>
            )}
          </>
        )}
      </BlockStack>
    </Card>
  );
}

// ============================================================================
// Helper Components
// ============================================================================

function ComponentScoreBar({ component }: { component: ComponentScore }) {
  const percentage = (component.score / component.maxScore) * 100;

  return (
    <BlockStack gap="100">
      <InlineStack align="space-between" blockAlign="center">
        <Text as="span" variant="bodySm" fontWeight="medium">
          {component.label}
        </Text>
        <Text as="span" variant="bodySm" tone="subdued">
          {component.score.toFixed(1)}/{component.maxScore} pts
        </Text>
      </InlineStack>

      {/* Progress bar */}
      <div style={styles.progressBarContainer}>
        <div
          style={{
            ...styles.progressBarFill,
            width: `${percentage}%`,
            backgroundColor: getProgressBarColor(percentage),
          }}
        />
      </div>

      {component.description && (
        <Text as="p" variant="bodySm" tone="subdued">
          {component.description}
        </Text>
      )}
    </BlockStack>
  );
}

function InsightBanner({ insight }: { insight: Insight }) {
  const icon = getInsightIcon(insight.type);
  const style = getInsightStyle(insight.type);

  return (
    <div style={style}>
      <InlineStack gap="200" blockAlign="start">
        <div style={styles.insightIcon}>
          <Text as="span" variant="bodySm" fontWeight="bold">
            {icon}
          </Text>
        </div>
        <div style={{ flex: 1 }}>
          <Text as="span" variant="bodySm">
            {insight.message}
          </Text>
        </div>
      </InlineStack>
    </div>
  );
}

// ============================================================================
// Styling
// ============================================================================

const styles = {
  scoreCircleContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreCircle: {
    width: '120px',
    height: '120px',
    borderRadius: '50%',
    border: '4px solid #5C6BC0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f6f6f7',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  } as React.CSSProperties,
  progressBarContainer: {
    width: '100%',
    height: '8px',
    backgroundColor: '#e1e3e5',
    borderRadius: '4px',
    overflow: 'hidden',
  } as React.CSSProperties,
  progressBarFill: {
    height: '100%',
    transition: 'width 0.3s ease',
    borderRadius: '4px',
  } as React.CSSProperties,
  insightIcon: {
    minWidth: '24px',
    height: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  } as React.CSSProperties,
};

// ============================================================================
// Helper Functions
// ============================================================================

function getGradeTone(grade: string): 'success' | 'info' | 'warning' | 'critical' | 'attention' {
  if (grade === 'S' || grade === 'A+' || grade === 'A') return 'success';
  if (grade.startsWith('B')) return 'info';
  if (grade.startsWith('C')) return 'warning';
  if (grade === 'D') return 'attention';
  return 'critical';
}

function getProgressBarColor(percentage: number): string {
  if (percentage >= 90) return '#4caf50'; // Green
  if (percentage >= 75) return '#8bc34a'; // Light green
  if (percentage >= 60) return '#5C6BC0'; // Blue
  if (percentage >= 40) return '#ff9800'; // Orange
  return '#f44336'; // Red
}

function getInsightIcon(type: 'success' | 'warning' | 'critical'): string {
  if (type === 'success') return '✓';
  if (type === 'warning') return '⚠';
  return '✕';
}

function getInsightStyle(type: 'success' | 'warning' | 'critical'): React.CSSProperties {
  const baseStyle: React.CSSProperties = {
    padding: '12px',
    borderRadius: '8px',
    borderLeft: '4px solid',
    backgroundColor: '#f6f6f7',
  };

  if (type === 'success') {
    return {
      ...baseStyle,
      backgroundColor: '#e8f5e9',
      borderLeftColor: '#4caf50',
    };
  }

  if (type === 'warning') {
    return {
      ...baseStyle,
      backgroundColor: '#fff3e0',
      borderLeftColor: '#ff9800',
    };
  }

  return {
    ...baseStyle,
    backgroundColor: '#ffebee',
    borderLeftColor: '#f44336',
  };
}
