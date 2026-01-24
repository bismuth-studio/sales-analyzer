import React, { useState, useEffect } from 'react';
import { AppProvider, Page, Card, Layout, Text } from '@shopify/polaris';
import '@shopify/polaris/build/esm/styles.css';
import './styles.css';
import OrdersListWithFilters from '../components/OrdersListWithFilters';

function App() {
  const [shop, setShop] = useState<string>('');

  useEffect(() => {
    // Get shop from URL parameters
    const params = new URLSearchParams(window.location.search);
    const shopParam = params.get('shop');
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
                <Text as="h2" variant="headingMd">Welcome to Sales Analyzer</Text>
                <Text as="p">
                  Track your sales data with precision. View your last 50 orders below.
                </Text>
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
