/**
 * Simple script to generate test orders in your Shopify store
 *
 * Since we can't set custom timestamps via API, this script creates
 * orders with the current time. You can manually adjust the timestamps
 * in Shopify admin if needed, or just use these for testing sorting.
 */

import { config } from 'dotenv';
import '@shopify/shopify-api/adapters/node';
import { shopifyApi, ApiVersion, Session } from '@shopify/shopify-api';

config();

const SHOP = 'bismuth-dev.myshopify.com';

// Note: You'll need to provide your access token
// You can find it by checking the session after OAuth
const ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN || '';

const testProducts = [
  { title: 'Early Bird Special', price: '29.99', quantity: 1 },
  { title: 'Morning Coffee Blend', price: '15.50', quantity: 2 },
  { title: 'Lunch Combo Deal', price: '45.00', quantity: 1 },
  { title: 'Afternoon Tea Set', price: '38.75', quantity: 1 },
  { title: 'Happy Hour Bundle', price: '52.99', quantity: 3 },
  { title: 'Dinner Package', price: '89.99', quantity: 1 },
  { title: 'Evening Special', price: '65.00', quantity: 2 },
  { title: 'Night Owl Deal', price: '42.50', quantity: 1 },
  { title: 'Late Night Snack Pack', price: '18.99', quantity: 4 },
  { title: 'Midnight Special', price: '75.00', quantity: 1 },
];

console.log('🛍️  Test Order Generator\n');
console.log('To generate test orders:');
console.log('1. Go to your Shopify admin: https://admin.shopify.com/store/bismuth-dev');
console.log('2. Go to Orders > Create order');
console.log('3. Use these test product ideas:\n');

testProducts.forEach((product, index) => {
  const total = (parseFloat(product.price) * product.quantity).toFixed(2);
  console.log(`   ${index + 1}. ${product.title}`);
  console.log(`      Price: $${product.price} x ${product.quantity} = $${total}\n`);
});

console.log('\n💡 Tips:');
console.log('   - Create orders at different times throughout the day');
console.log('   - Use different customers for each order');
console.log('   - Try different payment statuses (Paid, Pending, etc.)');
console.log('   - Vary the number of items per order');
console.log('\n📊 This will give you diverse data to test the sorting feature!');
