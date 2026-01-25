import React, { useState, useEffect } from 'react';
import { AppProvider, Page, Card, Layout, Text, Link, BlockStack } from '@shopify/polaris';
import '@shopify/polaris/build/esm/styles.css';
import './styles.css';
import OrdersListWithFilters from '../components/OrdersListWithFilters';

function App() {
  const [shop, setShop] = useState<string>('');

  useEffect(() => {
    // Get shop from URL parameters or from Shopify context
    const params = new URLSearchParams(window.location.search);
    let shopParam = params.get('shop');
    
    // If not in URL, try to extract from the pathname
    // In Shopify admin, the URL is like: /store/bismuth-dev/apps/drop-leak-v2
    if (!shopParam) {
      const pathMatch = window.location.pathname.match(/\/store\/([^\/]+)\//);
      if (pathMatch) {
        shopParam = pathMatch[1] + '.myshopify.com';
      }
    }
    
    if (shopParam) {
      setShop(shopParam);
    }
  }, []);

  return (
    <AppProvider i18n={{}}>
      <Page
        title="Sales Analyzer"
        subtitle="View and analyze your sales data by the minute"
        fullWidth
      >
        <div style={{ paddingLeft: '5%', paddingRight: '5%' }}>
          <Layout>
            <Layout.Section>
              <Card>
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">Welcome to Sales Analyzer</Text>
                  <Text as="p">
                    Track your sales data with precision. View your orders below.
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
            </Layout.Section>

            <Layout.Section>
              <OrdersListWithFilters shop={shop} />
            </Layout.Section>
          </Layout>
        </div>
      </Page>
    </AppProvider>
  );
}

export default App;
