require('dotenv/config');
const { shopifyApi } = require('@shopify/shopify-api');
require('@shopify/shopify-api/adapters/node');

const { SHOPIFY_ACCESS_TOKEN, SHOPIFY_API_KEY, SHOPIFY_API_SECRET } = process.env;
const SHOP = 'bismuth-dev.myshopify.com';

// Initialize Shopify
const shopify = shopifyApi({
  apiKey: SHOPIFY_API_KEY,
  apiSecretKey: SHOPIFY_API_SECRET,
  scopes: ['read_products', 'write_orders'],
  hostName: SHOP,
  apiVersion: '2025-01',
  isEmbeddedApp: false,
});

const session = {
  id: `offline_${SHOP}`,
  shop: SHOP,
  state: 'online',
  isOnline: false,
  accessToken: SHOPIFY_ACCESS_TOKEN,
};

const client = new shopify.clients.Rest({ session });

// Sample customer data
const customers = [
  { first_name: 'Sarah', last_name: 'Johnson', email: 'sarah.johnson@example.com' },
  { first_name: 'Michael', last_name: 'Chen', email: 'michael.chen@example.com' },
  { first_name: 'Emma', last_name: 'Rodriguez', email: 'emma.rodriguez@example.com' },
  { first_name: 'James', last_name: 'Williams', email: 'james.williams@example.com' },
  { first_name: 'Olivia', last_name: 'Brown', email: 'olivia.brown@example.com' },
  { first_name: 'David', last_name: 'Miller', email: 'david.miller@example.com' },
  { first_name: 'Sophia', last_name: 'Davis', email: 'sophia.davis@example.com' },
  { first_name: 'Daniel', last_name: 'Garcia', email: 'daniel.garcia@example.com' },
  { first_name: 'Ava', last_name: 'Martinez', email: 'ava.martinez@example.com' },
  { first_name: 'Christopher', last_name: 'Wilson', email: 'christopher.wilson@example.com' },
];

// Financial statuses to vary orders
const statuses = ['paid', 'paid', 'paid', 'paid', 'pending', 'authorized'];

// First, let's fetch all products to get their variant IDs
async function fetchProducts() {
  try {
    const response = await client.get({
      path: 'products',
      query: { limit: '250' },
    });

    const allProducts = response.body.products;

    // Filter to only fashion products we created (vendor: Bismuth Fashion)
    const fashionProducts = allProducts.filter(p => p.vendor === 'Bismuth Fashion');

    console.log(`✓ Fetched ${fashionProducts.length} fashion products with variants (filtered from ${allProducts.length} total products)\n`);

    return fashionProducts;
  } catch (error) {
    console.error('Error fetching products:', error.message);
    return [];
  }
}

// Helper to get random item from array
function randomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

// Helper to get random number between min and max
function randomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Helper to get a random date within the last 30 days
function randomDate() {
  const now = new Date();
  const daysAgo = randomNumber(0, 30);
  const hoursAgo = randomNumber(0, 23);
  const minutesAgo = randomNumber(0, 59);

  const date = new Date(now);
  date.setDate(date.getDate() - daysAgo);
  date.setHours(date.getHours() - hoursAgo);
  date.setMinutes(date.getMinutes() - minutesAgo);

  return date.toISOString();
}

// Create an order with random products
async function createOrder(products, orderNumber, shouldEnsureVariety = false) {
  try {
    const customer = randomItem(customers);
    let lineItems = [];

    if (shouldEnsureVariety) {
      // For variety orders, pick 1-2 random variants from a random product
      const product = randomItem(products);
      const numVariants = randomNumber(1, 2);

      for (let i = 0; i < numVariants; i++) {
        const variant = randomItem(product.variants);
        const quantity = randomNumber(1, 2);

        lineItems.push({
          variant_id: variant.id,
          quantity: quantity,
        });
      }
    } else {
      // Regular random orders
      const numItems = randomNumber(1, 4); // 1-4 different products per order
      const usedProducts = new Set();

      for (let i = 0; i < numItems; i++) {
        let product;
        let attempts = 0;

        // Try to get a unique product (avoid duplicates in same order)
        do {
          product = randomItem(products);
          attempts++;
        } while (usedProducts.has(product.id) && attempts < 10);

        usedProducts.add(product.id);

        const variant = randomItem(product.variants);
        const quantity = randomNumber(1, 3);

        lineItems.push({
          variant_id: variant.id,
          quantity: quantity,
        });
      }
    }

    const orderData = {
      email: customer.email,
      financial_status: randomItem(statuses),
      line_items: lineItems,
      customer: {
        first_name: customer.first_name,
        last_name: customer.last_name,
        email: customer.email,
      },
      created_at: randomDate(),
      processed_at: randomDate(),
      billing_address: {
        first_name: customer.first_name,
        last_name: customer.last_name,
        address1: `${randomNumber(100, 9999)} Main St`,
        city: 'Los Angeles',
        province: 'CA',
        country: 'United States',
        zip: '90001',
      },
      shipping_address: {
        first_name: customer.first_name,
        last_name: customer.last_name,
        address1: `${randomNumber(100, 9999)} Main St`,
        city: 'Los Angeles',
        province: 'CA',
        country: 'United States',
        zip: '90001',
      },
    };

    const response = await client.post({
      path: 'orders',
      data: { order: orderData },
      type: 'application/json',
    });

    const order = response.body.order;
    console.log(`✓ Order ${orderNumber}: #${order.name} - ${order.line_items.length} items, $${order.total_price} (${order.financial_status})`);

    return order;
  } catch (error) {
    console.error(`✗ Error creating order ${orderNumber}:`, error.message);
    if (error.response?.body?.errors) {
      console.error('  Details:', JSON.stringify(error.response.body.errors, null, 2));
    }
    return null;
  }
}

async function main() {
  console.log('🛍️  Creating test orders with fashion products...\n');
  console.log(`Shop: ${SHOP}\n`);

  // Fetch products first
  console.log('Fetching products...');
  const products = await fetchProducts();

  if (products.length === 0) {
    console.error('No products found! Please run create-products.js first.');
    process.exit(1);
  }

  console.log(`Found ${products.length} fashion products:\n`);
  products.forEach(p => {
    console.log(`  - ${p.title} (${p.variants.length} variants)`);
  });

  // Create variety orders - ensure each product has orders for different variants
  const varietyOrdersPerProduct = 15; // 15 orders per product to cover all variants
  const totalVarietyOrders = products.length * varietyOrdersPerProduct;

  console.log(`\nCreating ${totalVarietyOrders} variety orders (${varietyOrdersPerProduct} per product)...\n`);

  const createdOrders = [];

  // Create variety orders for each product
  for (let productIndex = 0; productIndex < products.length; productIndex++) {
    const product = products[productIndex];
    console.log(`\nCreating orders for ${product.title}...`);

    for (let i = 0; i < varietyOrdersPerProduct; i++) {
      const orderNumber = productIndex * varietyOrdersPerProduct + i + 1;

      // Create order focusing on this specific product
      const customer = randomItem(customers);
      const variant = product.variants[i % product.variants.length]; // Cycle through all variants
      const quantity = randomNumber(1, 3);

      const orderData = {
        email: customer.email,
        financial_status: randomItem(statuses),
        line_items: [
          {
            variant_id: variant.id,
            quantity: quantity,
          },
        ],
        customer: {
          first_name: customer.first_name,
          last_name: customer.last_name,
          email: customer.email,
        },
        created_at: randomDate(),
        processed_at: randomDate(),
        billing_address: {
          first_name: customer.first_name,
          last_name: customer.last_name,
          address1: `${randomNumber(100, 9999)} Main St`,
          city: 'Los Angeles',
          province: 'CA',
          country: 'United States',
          zip: '90001',
        },
        shipping_address: {
          first_name: customer.first_name,
          last_name: customer.last_name,
          address1: `${randomNumber(100, 9999)} Main St`,
          city: 'Los Angeles',
          province: 'CA',
          country: 'United States',
          zip: '90001',
        },
      };

      try {
        const response = await client.post({
          path: 'orders',
          data: { order: orderData },
          type: 'application/json',
        });

        const order = response.body.order;
        console.log(`  ✓ Order ${orderNumber}: #${order.name} - ${variant.title || 'Default'} (${order.financial_status})`);
        createdOrders.push(order);
      } catch (error) {
        console.error(`  ✗ Error creating order ${orderNumber}:`, error.message);
      }

      // Wait a bit between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }

  // Create additional random mixed orders
  const numRandomOrders = 20;
  console.log(`\n\nCreating ${numRandomOrders} additional random orders...\n`);

  for (let i = 1; i <= numRandomOrders; i++) {
    const order = await createOrder(products, totalVarietyOrders + i, false);
    if (order) {
      createdOrders.push(order);
    }

    // Wait a bit between requests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  console.log('\n' + '='.repeat(60));
  console.log(`✓ Successfully created ${createdOrders.length} orders!`);
  console.log('='.repeat(60));

  // Calculate stats
  const totalRevenue = createdOrders.reduce((sum, order) => sum + parseFloat(order.total_price), 0);
  const totalItems = createdOrders.reduce((sum, order) => sum + order.line_items.length, 0);
  const paidOrders = createdOrders.filter(o => o.financial_status === 'paid').length;

  console.log('\nOrder Statistics:');
  console.log(`  Total Orders: ${createdOrders.length}`);
  console.log(`  Paid Orders: ${paidOrders}`);
  console.log(`  Pending/Other: ${createdOrders.length - paidOrders}`);
  console.log(`  Total Revenue: $${totalRevenue.toFixed(2)}`);
  console.log(`  Total Line Items: ${totalItems}`);
  console.log(`  Average Order Value: $${(totalRevenue / createdOrders.length).toFixed(2)}`);

  console.log('\n✓ All orders created successfully!');
  console.log('\n💡 Tip: Refresh your Sales Analyzer app to see the new orders!');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
