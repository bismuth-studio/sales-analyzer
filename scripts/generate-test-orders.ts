import { config } from 'dotenv';
import '@shopify/shopify-api/adapters/node';
import { shopifyApi, ApiVersion, Session } from '@shopify/shopify-api';

// Load environment variables
config();

const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY!,
  apiSecretKey: process.env.SHOPIFY_API_SECRET!,
  scopes: process.env.SHOPIFY_SCOPES?.split(',') || ['read_orders', 'write_orders'],
  hostName: process.env.SHOPIFY_APP_URL?.replace(/https?:\/\//, '') || 'localhost:3000',
  hostScheme: 'https',
  apiVersion: ApiVersion.January26,
  isEmbeddedApp: false,
});

// You'll need to provide your shop name and access token
const SHOP = 'bismuth-dev.myshopify.com';
const ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN || '';

async function generateTestOrders() {
  if (!ACCESS_TOKEN) {
    console.error('❌ SHOPIFY_ACCESS_TOKEN not found in environment variables');
    console.log('\n📝 To generate test orders, you need to:');
    console.log('1. Get your access token from the Shopify admin');
    console.log('2. Add it to your .env file as SHOPIFY_ACCESS_TOKEN');
    return;
  }

  const session: Session = {
    id: `offline_${SHOP}`,
    shop: SHOP,
    state: 'test',
    isOnline: false,
    accessToken: ACCESS_TOKEN,
  };

  const client = new shopify.clients.Rest({ session });

  const testOrders = [
    {
      customer: { email: 'morning-customer@example.com', first_name: 'Morning', last_name: 'Shopper' },
      line_items: [{ title: 'Morning Coffee Mug', quantity: 2, price: '15.00' }],
      financial_status: 'paid',
      note: 'Test order - Morning rush (8 AM)',
    },
    {
      customer: { email: 'midday-customer@example.com', first_name: 'Midday', last_name: 'Buyer' },
      line_items: [
        { title: 'Lunch Special', quantity: 1, price: '25.50' },
        { title: 'Drink', quantity: 2, price: '5.00' },
      ],
      financial_status: 'paid',
      note: 'Test order - Lunch time (12 PM)',
    },
    {
      customer: { email: 'afternoon-customer@example.com', first_name: 'Afternoon', last_name: 'Client' },
      line_items: [{ title: 'Afternoon Snack Pack', quantity: 3, price: '12.99' }],
      financial_status: 'pending',
      note: 'Test order - Afternoon (3 PM)',
    },
    {
      customer: { email: 'evening-customer@example.com', first_name: 'Evening', last_name: 'Purchaser' },
      line_items: [
        { title: 'Dinner Set', quantity: 1, price: '89.99' },
        { title: 'Dessert', quantity: 1, price: '15.00' },
      ],
      financial_status: 'paid',
      note: 'Test order - Evening (7 PM)',
    },
    {
      customer: { email: 'night-customer@example.com', first_name: 'Night', last_name: 'Owl' },
      line_items: [{ title: 'Late Night Snack', quantity: 5, price: '8.50' }],
      financial_status: 'paid',
      note: 'Test order - Night time (10 PM)',
    },
  ];

  console.log('🚀 Generating test orders...\n');

  for (let i = 0; i < testOrders.length; i++) {
    const orderData = testOrders[i];

    try {
      const response = await client.post({
        path: 'orders',
        data: {
          order: {
            ...orderData,
            send_receipt: false,
            send_fulfillment_receipt: false,
          },
        },
      });

      const order = (response.body as any).order;
      console.log(`✅ Created order #${order.order_number || order.name} - $${order.total_price}`);
      console.log(`   Note: ${orderData.note}`);
      console.log(`   Items: ${orderData.line_items.length}\n`);

      // Small delay between orders
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error: any) {
      console.error(`❌ Failed to create order: ${error.message}`);
      if (error.response?.body?.errors) {
        console.error('   Errors:', JSON.stringify(error.response.body.errors, null, 2));
      }
    }
  }

  console.log('✨ Done! Check your Shopify admin to see the test orders.');
}

generateTestOrders().catch(console.error);
