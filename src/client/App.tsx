import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, Page, Card, Text, Link, BlockStack } from '@shopify/polaris';
import '@shopify/polaris/build/esm/styles.css';
import './styles.css';
import Dashboard from '../components/Dashboard';
import DropAnalysis from '../components/DropAnalysis';
import { getClientConfig } from './services/config';

function App() {
  const [shop, setShop] = useState<string>('');
  const [storeDomain, setStoreDomain] = useState<string>('myshopify.com');

  useEffect(() => {
    // Load client config
    getClientConfig().then(config => {
      setStoreDomain(config.storeDomain);
    }).catch(err => {
      console.error('Failed to load config:', err);
      // Keep default domain if config fails to load
    });

    // Get shop from URL parameters or from Shopify context
    const params = new URLSearchParams(window.location.search);
    let shopParam = params.get('shop');

    // If not in URL, try to extract from the pathname
    // In Shopify admin, the URL is like: /store/bismuth-dev/apps/drop-leak-v2
    if (!shopParam) {
      const pathMatch = window.location.pathname.match(/\/store\/([^\/]+)\//);
      if (pathMatch) {
        shopParam = pathMatch[1] + '.' + storeDomain;
      }
    }

    if (shopParam) {
      setShop(shopParam);
    }
  }, [storeDomain]);

  return (
    <AppProvider i18n={{}}>
      <BrowserRouter>
        <Routes>
          <Route
            path="/"
            element={
              <Page
                title="Drop Analyzer"
                subtitle="Create and analyze your product drops"
                fullWidth
              >
                <div style={{ paddingLeft: '5%', paddingRight: '5%' }}>
                  <BlockStack gap="400">
                    <Card>
                      <BlockStack gap="200">
                        <Text as="h2" variant="headingMd">Welcome to Drop Analyzer</Text>
                        <Text as="p">
                          Create drops to track sales data for specific time periods. Click on a drop to view detailed analytics.
                        </Text>
                        {shop && (
                          <Text as="p" variant="bodySm" tone="subdued">
                            Session expired?{' '}
                            <Link url={`${window.location.origin}/api/shopify/auth?shop=${encodeURIComponent(shop)}`} target="_blank">
                              Click here to re-authenticate
                            </Link>
                          </Text>
                        )}
                      </BlockStack>
                    </Card>
                    <Dashboard shop={shop} />
                  </BlockStack>
                </div>
              </Page>
            }
          />
          <Route
            path="/drop/:dropId"
            element={<DropAnalysis shop={shop} />}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}

export default App;
