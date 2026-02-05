import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, Page, Card, Text, Link, BlockStack } from '@shopify/polaris';
import { Provider as AppBridgeProvider } from '@shopify/app-bridge-react';
import '@shopify/polaris/build/esm/styles.css';
import './styles.css';
import Dashboard from '../components/Dashboard';
import DropAnalysis from '../components/DropAnalysis';
import { getClientConfig } from './services/config';

function App() {
  const [shop, setShop] = useState<string>('');
  const [host, setHost] = useState<string>('');
  const [apiKey, setApiKey] = useState<string>('');
  const [storeDomain, setStoreDomain] = useState<string>('myshopify.com');

  useEffect(() => {
    // Load client config (includes API key)
    getClientConfig().then(config => {
      setStoreDomain(config.storeDomain);
      setApiKey(config.apiKey);
    }).catch(err => {
      console.error('Failed to load config:', err);
    });

    // Get shop and host from URL parameters (required for embedded apps)
    const params = new URLSearchParams(window.location.search);
    const shopParam = params.get('shop');
    const hostParam = params.get('host');

    if (shopParam) {
      setShop(shopParam);
    }
    if (hostParam) {
      setHost(hostParam);
    }
  }, []);

  // Wait for config to load before rendering embedded app
  if (!apiKey || !shop) {
    return (
      <AppProvider i18n={{}}>
        <Page>
          <Card>
            <BlockStack gap="200">
              <Text as="p">Loading...</Text>
              {!shop && (
                <Text as="p" tone="critical">
                  Missing shop parameter. Please install the app from your Shopify admin.
                </Text>
              )}
            </BlockStack>
          </Card>
        </Page>
      </AppProvider>
    );
  }

  // App Bridge configuration
  const appBridgeConfig = {
    apiKey: apiKey,
    host: host,
    forceRedirect: true,
  };

  return (
    <AppBridgeProvider config={appBridgeConfig}>
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
    </AppBridgeProvider>
  );
}

export default App;
