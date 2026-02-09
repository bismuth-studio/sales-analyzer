import { useState, useCallback } from 'react';
import type { OrderAnalysisData } from '../components/orders';

/**
 * Custom hook to manage order analysis data
 * Provides state and handlers for receiving data from OrdersListWithFilters
 */
export const useOrderAnalysis = () => {
  const [orderData, setOrderData] = useState<OrderAnalysisData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const handleDataCalculated = useCallback((data: OrderAnalysisData) => {
    setOrderData(data);
    setIsLoading(false);
  }, []);

  const resetData = useCallback(() => {
    setOrderData(null);
    setIsLoading(true);
  }, []);

  return {
    orderData,
    isLoading,
    handleDataCalculated,
    resetData,
  };
};
