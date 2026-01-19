import { config } from 'dotenv';
import '@shopify/shopify-api/adapters/node';
import { shopifyApi, ApiVersion } from '@shopify/shopify-api';
import fs from 'fs';
import path from 'path';

config();

const SHOP = 'bismuth-dev.myshopify.com';

// Read the session from the server's session storage
// We'll need to get the access token from the OAuth session
function getAccessToken(): string {
  // For now, we'll use environment variable
  // You can set this temporarily in .env as SHOPIFY_ACCESS_TOKEN
  const token = process.env.SHOPIFY_ACCESS_TOKEN;
  if (!token) {
    console.error('\n❌ SHOPIFY_ACCESS_TOKEN not found!');
    console.log('\n📝 To use this script:');
    console.log('1. After installing the app, the access token is stored in memory');
    console.log('2. Add SHOPIFY_ACCESS_TOKEN to your .env file');
    console.log('3. You can find it by checking the session after OAuth\n');
    process.exit(1);
  }
  return token;
}

const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY!,
  apiSecretKey: process.env.SHOPIFY_API_SECRET!,
  scopes: ['read_orders', 'write_orders'],
  hostName: process.env.SHOPIFY_APP_URL?.replace(/https?:\/\//, '') || 'localhost:3000',
  hostScheme: 'https',
  apiVersion: ApiVersion.January26,
  isEmbeddedApp: false,
});

// Product catalog with varied prices
const products = [
  { name: 'Premium Coffee Beans', price: 24.99 },
  { name: 'Organic Tea Collection', price: 18.50 },
  { name: 'Artisan Chocolate Box', price: 32.00 },
  { name: 'Gourmet Cookie Set', price: 15.99 },
  { name: 'Fresh Bakery Bundle', price: 28.75 },
  { name: 'Specialty Spice Kit', price: 22.50 },
  { name: 'Deluxe Snack Pack', price: 45.00 },
  { name: 'Health Food Sampler', price: 38.99 },
  { name: 'International Treats Box', price: 52.00 },
  { name: 'Breakfast Essentials', price: 29.99 },
  { name: 'Lunch Special Bundle', price: 35.50 },
  { name: 'Dinner Starter Kit', price: 48.75 },
  { name: 'Dessert Delights', price: 21.99 },
  { name: 'Party Platter Set', price: 89.99 },
  { name: 'Quick Meal Solution', price: 16.50 },
  { name: 'Family Pack Deal', price: 67.00 },
  { name: 'Single Serving Special', price: 8.99 },
  { name: 'Bulk Buy Discount', price: 125.00 },
  { name: 'Trial Size Sample', price: 5.50 },
  { name: 'Mega Value Pack', price: 99.99 },
];

// Customer name variations
const firstNames = ['Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Drew', 'Sam', 'Avery', 'Quinn'];
const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Martinez', 'Lopez'];

// Financial status options
const statuses = ['paid', 'pending', 'authorized'] as const;

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function generateOrders(count: number = 100) {
  const accessToken = getAccessToken();

  const session = {
    id: `offline_${SHOP}`,
    shop: SHOP,
    state: 'test',
    isOnline: false,
    accessToken: accessToken,
  };

  const client = new shopify.clients.Rest({ session });

  console.log(`🚀 Generating ${count} test orders...\n`);
  console.log('━'.repeat(60));

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < count; i++) {
    // Random number of items (1-5)
    const itemCount = randomInt(1, 5);
    const lineItems = [];

    for (let j = 0; j < itemCount; j++) {
      const product = randomElement(products);
      const quantity = randomInt(1, 3);
      lineItems.push({
        title: product.name,
        quantity: quantity,
        price: product.price.toFixed(2),
      });
    }

    // Generate random customer
    const firstName = randomElement(firstNames);
    const lastName = randomElement(lastNames);
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@example.com`;

    // Random status
    const status = randomElement(statuses);

    const orderData = {
      email: email,
      line_items: lineItems,
      financial_status: status,
      send_receipt: false,
      send_fulfillment_receipt: false,
      note: `Test order ${i + 1}/${count}`,
      customer: {
        first_name: firstName,
        last_name: lastName,
        email: email,
      },
    };

    try {
      const response = await client.post({
        path: 'orders',
        data: { order: orderData },
      });

      const order = (response.body as any).order;
      const total = parseFloat(order.total_price).toFixed(2);

      successCount++;

      if ((i + 1) % 10 === 0 || i === 0) {
        console.log(`✅ Created ${successCount}/${count} orders... Latest: #${order.name} - $${total}`);
      }

      // Small delay to avoid rate limiting (Shopify allows 2 requests/second)
      await new Promise(resolve => setTimeout(resolve, 550));

    } catch (error: any) {
      failCount++;
      console.error(`❌ Failed to create order ${i + 1}: ${error.message}`);

      if (error.response?.code === 429) {
        console.log('⏳ Rate limited, waiting 2 seconds...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  console.log('\n' + '━'.repeat(60));
  console.log(`\n✨ Done!`);
  console.log(`   ✅ Success: ${successCount} orders`);
  console.log(`   ❌ Failed: ${failCount} orders`);
  console.log(`\n📊 Refresh your app to see the new orders!`);
  console.log(`🔗 https://admin.shopify.com/store/bismuth-dev/apps/drop-leak-v2\n`);
}

// Parse command line args
const args = process.argv.slice(2);
const count = args[0] ? parseInt(args[0]) : 100;

if (isNaN(count) || count < 1 || count > 250) {
  console.error('❌ Please provide a valid count between 1 and 250');
  console.log('Usage: npx tsx scripts/bulk-generate-orders.ts [count]');
  console.log('Example: npx tsx scripts/bulk-generate-orders.ts 100');
  process.exit(1);
}

generateOrders(count).catch(console.error);
