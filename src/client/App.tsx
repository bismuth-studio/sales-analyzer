import React, { useState, useEffect } from 'react';
import { AppProvider, Page, Card, Layout, TextContainer, Heading } from '@shopify/polaris';
import '@shopify/polaris/build/esm/styles.css';
import OrdersList from '../components/OrdersList';

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
      >
        <Layout>
          <Layout.Section>
            <Card>
              <TextContainer>
                <Heading>Welcome to Sales Analyzer</Heading>
                <p>
                  Track your sales data with precision. View your last 10 orders below.
                </p>
              </TextContainer>
            </Card>
          </Layout.Section>

          <Layout.Section>
            <OrdersList shop={shop} />
          </Layout.Section>
        </Layout>
      </Page>
    </AppProvider>
  );
}

export default App;
