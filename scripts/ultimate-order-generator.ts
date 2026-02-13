import { config } from 'dotenv';
import '@shopify/shopify-api/adapters/node';
import { shopifyApi, ApiVersion, Session } from '@shopify/shopify-api';

// Load environment variables
config();

const SHOP = 'hackalot-will.myshopify.com';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface Product {
  id: number;
  title: string;
  vendor: string;
  variants: Variant[];
}

interface Variant {
  id: number;
  title: string | null;
  price: string;
  inventory_quantity: number;
}

interface Customer {
  first_name: string;
  last_name: string;
  email: string;
}

interface OrderStats {
  total: number;
  systematic: number;
  random: number;
  withDiscounts: number;
  cancelled: number;
  hypeBuyers: number;
  totalRevenue: number;
  firstOrderTime: string | null;
  lastOrderTime: string | null;
}

interface OrderQuantityConfig {
  itemCount: number;
  quantityPerItem: () => number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

// 30 customer profiles for diverse data
const firstNames = [
  'Sarah', 'Michael', 'Emma', 'James', 'Olivia',
  'David', 'Sophia', 'Daniel', 'Ava', 'Christopher',
  'Isabella', 'Matthew', 'Mia', 'Joseph', 'Charlotte',
  'Andrew', 'Amelia', 'Ryan', 'Harper', 'Joshua',
  'Evelyn', 'Nathan', 'Abigail', 'Tyler', 'Emily',
  'Brandon', 'Madison', 'Kevin', 'Ella', 'Lucas'
];

const lastNames = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones',
  'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
  'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
  'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
  'Lee', 'Perez', 'Thompson', 'White', 'Harris',
  'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson'
];

// Discount code - uses your actual Shopify discount code
// Set DISCOUNT_CODE in .env to customize, defaults to '10%off'
const DISCOUNT_CODE = process.env.DISCOUNT_CODE || '10%off';
const DISCOUNT_AMOUNT = '10.00'; // Fixed $10 discount

// Cities for address diversity
const cities = [
  { city: 'Los Angeles', state: 'CA', zip: '90001' },
  { city: 'New York', state: 'NY', zip: '10001' },
  { city: 'Chicago', state: 'IL', zip: '60601' },
  { city: 'Houston', state: 'TX', zip: '77001' },
  { city: 'Phoenix', state: 'AZ', zip: '85001' },
  { city: 'Miami', state: 'FL', zip: '33101' },
  { city: 'Seattle', state: 'WA', zip: '98101' },
  { city: 'Denver', state: 'CO', zip: '80201' },
  { city: 'Atlanta', state: 'GA', zip: '30301' },
  { city: 'Portland', state: 'OR', zip: '97201' },
];

// Rate limiting constants
const BASE_DELAY = 500; // ms between requests
const RATE_LIMIT_BACKOFF = 3000; // ms to wait after 429

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function randomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function randomNumber(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate a timestamp following drop pattern:
 * - 65% of orders in first 20 minutes (exponential concentration)
 * - 35% in remaining 100 minutes (gradual decay)
 */
function generateDropTimestamp(dropStartTime: Date): Date {
  const random = Math.random();

  if (random < 0.65) {
    // First 20 minutes - exponential distribution with high concentration at start
    const lambda = 0.15; // decay rate
    const minutesOffset = -Math.log(1 - Math.random()) / lambda;
    const clampedMinutes = Math.min(minutesOffset, 20);
    return new Date(dropStartTime.getTime() + clampedMinutes * 60 * 1000);
  } else {
    // Remaining 100 minutes - slower exponential decay
    const lambda = 0.02;
    const minutesOffset = 20 + (-Math.log(1 - Math.random()) / lambda);
    const clampedMinutes = Math.min(minutesOffset, 120);
    return new Date(dropStartTime.getTime() + clampedMinutes * 60 * 1000);
  }
}

/**
 * Generate order quantities based on buyer type
 */
function generateOrderQuantities(isHypeBuyer: boolean): OrderQuantityConfig {
  if (isHypeBuyer) {
    // Hype buyer: 5-10 items per order, 2-5 quantity each
    return {
      itemCount: randomNumber(5, 10),
      quantityPerItem: () => randomNumber(2, 5),
    };
  } else {
    // Regular buyer: 1-3 items per order, 1-2 quantity each
    return {
      itemCount: randomNumber(1, 3),
      quantityPerItem: () => randomNumber(1, 2),
    };
  }
}

/**
 * Generate 30 consistent customer profiles
 */
function generateCustomers(): Customer[] {
  const customers: Customer[] = [];
  for (let i = 0; i < 30; i++) {
    const firstName = firstNames[i];
    const lastName = lastNames[i];
    customers.push({
      first_name: firstName,
      last_name: lastName,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`,
    });
  }
  return customers;
}

/**
 * Transform GraphQL ID to REST ID
 * Example: "gid://shopify/Product/123456" -> 123456
 */
function graphqlIdToRestId(graphqlId: string): number {
  const match = graphqlId.match(/\/(\d+)$/);
  return match ? parseInt(match[1]) : 0;
}

// ============================================================================
// SHOPIFY API FUNCTIONS
// ============================================================================

/**
 * Fetch products that are published to the online store via REST API
 */
async function fetchPublishedProducts(client: any): Promise<Product[]> {
  try {
    const response = await client.get({
      path: 'products',
      query: {
        status: 'active',
        limit: '250'
      },
    });

    const allProducts = (response.body as any).products;

    // Filter for products that are published (published_at is not null)
    const publishedProducts = allProducts.filter((p: any) => p.published_at !== null);

    return publishedProducts.map((p: any) => ({
      id: p.id,
      title: p.title,
      vendor: p.vendor,
      variants: p.variants.map((v: any) => ({
        id: v.id,
        title: v.title,
        price: v.price,
        inventory_quantity: v.inventory_quantity,
      })),
    }));
  } catch (error: any) {
    console.error('❌ Failed to fetch products:', error.message);
    throw error;
  }
}

/**
 * Create an order via REST API with rate limiting
 */
async function createOrderWithRateLimit(
  client: any,
  orderData: any,
  retryCount = 0
): Promise<any> {
  try {
    const response = await client.post({
      path: 'orders',
      data: { order: orderData },
    });

    await sleep(BASE_DELAY);
    return response.body.order;
  } catch (error: any) {
    if (error.response?.code === 429 && retryCount < 2) {
      console.log('  ⏳ Rate limited, waiting 3 seconds...');
      await sleep(RATE_LIMIT_BACKOFF);
      return createOrderWithRateLimit(client, orderData, retryCount + 1);
    }
    throw error;
  }
}

/**
 * Cancel an order via REST API
 */
async function cancelOrder(client: any, orderId: number): Promise<boolean> {
  try {
    await client.post({
      path: `orders/${orderId}/cancel`,
      data: {
        reason: 'customer',
        email: false,
        refund: false,
      },
    });
    return true;
  } catch (error: any) {
    console.error(`  ✗ Failed to cancel order ${orderId}: ${error.message}`);
    return false;
  }
}

/**
 * Build order data structure
 */
function buildOrderData(
  customer: Customer,
  lineItems: any[],
  dropStartTime: Date,
  shouldApplyDiscount: boolean,
  financialStatus: string = 'paid'
): any {
  const location = randomItem(cities);
  const orderData: any = {
    email: customer.email,
    financial_status: financialStatus,
    line_items: lineItems,
    customer: {
      first_name: customer.first_name,
      last_name: customer.last_name,
      email: customer.email,
    },
    created_at: generateDropTimestamp(dropStartTime).toISOString(),
    billing_address: {
      first_name: customer.first_name,
      last_name: customer.last_name,
      address1: `${randomNumber(100, 9999)} Main St`,
      city: location.city,
      province: location.state,
      country: 'United States',
      zip: location.zip,
    },
    shipping_address: {
      first_name: customer.first_name,
      last_name: customer.last_name,
      address1: `${randomNumber(100, 9999)} Main St`,
      city: location.city,
      province: location.state,
      country: 'United States',
      zip: location.zip,
    },
  };

  // Apply discount if applicable
  if (shouldApplyDiscount) {
    // Use the actual discount code from your Shopify store
    orderData.discount_codes = [{
      code: DISCOUNT_CODE,
      amount: DISCOUNT_AMOUNT,
      type: 'fixed_amount'
    }];
  }

  return orderData;
}

// ============================================================================
// MAIN ORDER GENERATION LOGIC
// ============================================================================

async function generateUltimateOrders(orderCount: number) {
  const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;

  if (!accessToken) {
    console.error('\n❌ SHOPIFY_ACCESS_TOKEN not found in environment variables');
    console.log('\n📝 To use this script:');
    console.log('1. Add SHOPIFY_ACCESS_TOKEN to your .env file');
    console.log('2. Get your access token from the Shopify admin after OAuth\n');
    process.exit(1);
  }

  // Initialize Shopify clients
  const shopify = shopifyApi({
    apiKey: process.env.SHOPIFY_API_KEY!,
    apiSecretKey: process.env.SHOPIFY_API_SECRET!,
    scopes: ['read_products', 'write_orders'],
    hostName: process.env.SHOPIFY_APP_URL?.replace(/https?:\/\//, '') || 'localhost:3000',
    hostScheme: 'https',
    apiVersion: ApiVersion.January26,
    isEmbeddedApp: false,
  });

  const session: Session = {
    id: `offline_${SHOP}`,
    shop: SHOP,
    state: 'test',
    isOnline: false,
    accessToken: accessToken,
  };

  const restClient = new shopify.clients.Rest({ session });

  // Print header
  console.log('\n🚀 Ultimate Order Generator');
  console.log('━'.repeat(60));
  console.log();

  // Fetch published products
  console.log('📦 Fetching published products...');
  let products: Product[];

  try {
    products = await fetchPublishedProducts(restClient);

    if (products.length === 0) {
      console.log('⚠️  No products published to online store, fetching all active products...');
      // Fallback to all active products via REST
      const response = await restClient.get({
        path: 'products',
        query: { status: 'active', limit: '250' },
      });
      products = (response.body as any).products;
    }

    const totalVariants = products.reduce((sum, p) => sum + p.variants.length, 0);
    console.log(`✓ Found ${products.length} published products (${totalVariants} total variants)`);

    products.forEach(p => {
      console.log(`  - ${p.title} (${p.variants.length} variants)`);
    });
    console.log();
  } catch (error: any) {
    console.error('❌ Failed to fetch products:', error.message);
    process.exit(1);
  }

  if (products.length === 0) {
    console.error('❌ No products available. Please create products first.');
    process.exit(1);
  }

  // Generate customer profiles
  const customers = generateCustomers();
  console.log(`👥 Loaded ${customers.length} customer profiles`);

  // Calculate drop start time (2 hours ago)
  const dropStartTime = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const dropEndTime = new Date(dropStartTime.getTime() + 2 * 60 * 60 * 1000);
  console.log(`⏰ Drop window: ${dropStartTime.toISOString()} → ${dropEndTime.toISOString()}`);
  console.log();

  // Calculate systematic vs random distribution
  const systematicCount = Math.floor(orderCount * 0.6);
  const randomCount = orderCount - systematicCount;

  console.log(`🛍️  Creating ${orderCount} orders (${systematicCount} systematic + ${randomCount} random)...`);
  console.log('━'.repeat(60));
  console.log();

  // Initialize stats
  const stats: OrderStats = {
    total: 0,
    systematic: 0,
    random: 0,
    withDiscounts: 0,
    cancelled: 0,
    hypeBuyers: 0,
    totalRevenue: 0,
    firstOrderTime: null,
    lastOrderTime: null,
  };

  const financialStatuses = ['paid', 'paid', 'paid', 'paid', 'pending', 'authorized'];
  let variantIndex = 0;
  const allVariants: Array<{ product: Product; variant: Variant }> = [];

  // Build flat list of all variants for systematic coverage
  products.forEach(product => {
    product.variants.forEach(variant => {
      allVariants.push({ product, variant });
    });
  });

  // ========================================
  // Phase 1: Systematic Orders (60%)
  // ========================================
  console.log(`Systematic Orders (${systematicCount}):`);

  for (let i = 0; i < systematicCount; i++) {
    const customer = randomItem(customers);
    const isHypeBuyer = Math.random() < 0.15; // 15% hype buyers
    const shouldApplyDiscount = Math.random() < 0.12; // 12% with discounts
    const shouldCancel = Math.random() < 0.05; // 5% cancelled

    const { itemCount, quantityPerItem } = generateOrderQuantities(isHypeBuyer);
    const lineItems = [];

    // Cycle through variants systematically
    for (let j = 0; j < itemCount; j++) {
      const { product, variant } = allVariants[variantIndex % allVariants.length];
      variantIndex++;

      lineItems.push({
        variant_id: variant.id,
        quantity: quantityPerItem(),
      });
    }

    const orderData = buildOrderData(
      customer,
      lineItems,
      dropStartTime,
      shouldApplyDiscount,
      randomItem(financialStatuses)
    );

    try {
      const order = await createOrderWithRateLimit(restClient, orderData);

      // Update stats
      stats.total++;
      stats.systematic++;
      stats.totalRevenue += parseFloat(order.total_price);
      if (isHypeBuyer) stats.hypeBuyers++;
      if (shouldApplyDiscount) stats.withDiscounts++;

      if (!stats.firstOrderTime) stats.firstOrderTime = order.created_at;
      stats.lastOrderTime = order.created_at;

      // Log progress
      const hypeBuyerFlag = isHypeBuyer ? ' 🔥' : '';
      const discountFlag = shouldApplyDiscount ? ` (${DISCOUNT_CODE})` : '';

      if ((i + 1) % 10 === 0 || i === 0) {
        console.log(`✓ Created ${stats.total}/${orderCount}... Latest: #${order.name} - $${order.total_price}${discountFlag}${hypeBuyerFlag}`);
      }

      // Cancel order if applicable
      if (shouldCancel) {
        console.log(`  🔄 Attempting to cancel order #${order.name}...`);
        const cancelled = await cancelOrder(restClient, order.id);
        if (cancelled) {
          stats.cancelled++;
          console.log(`  ⚠️  Successfully cancelled order #${order.name}`);
        }
      }
    } catch (error: any) {
      console.error(`✗ Failed to create order ${i + 1}: ${error.message}`);
    }
  }

  console.log();

  // ========================================
  // Phase 2: Random Orders (40%)
  // ========================================
  console.log(`Random Orders (${randomCount}):`);

  for (let i = 0; i < randomCount; i++) {
    const customer = randomItem(customers);
    const isHypeBuyer = Math.random() < 0.15;
    const shouldApplyDiscount = Math.random() < 0.12;
    const shouldCancel = Math.random() < 0.05;

    const { itemCount, quantityPerItem } = generateOrderQuantities(isHypeBuyer);
    const lineItems = [];
    const usedProducts = new Set<number>();

    // Random product selection
    for (let j = 0; j < itemCount; j++) {
      let product: Product;
      let attempts = 0;

      // Try to get unique products
      do {
        product = randomItem(products);
        attempts++;
      } while (usedProducts.has(product.id) && attempts < 10);

      usedProducts.add(product.id);

      const variant = randomItem(product.variants);
      lineItems.push({
        variant_id: variant.id,
        quantity: quantityPerItem(),
      });
    }

    const orderData = buildOrderData(
      customer,
      lineItems,
      dropStartTime,
      shouldApplyDiscount,
      randomItem(financialStatuses)
    );

    try {
      const order = await createOrderWithRateLimit(restClient, orderData);

      // Update stats
      stats.total++;
      stats.random++;
      stats.totalRevenue += parseFloat(order.total_price);
      if (isHypeBuyer) stats.hypeBuyers++;
      if (shouldApplyDiscount) stats.withDiscounts++;

      stats.lastOrderTime = order.created_at;

      // Log progress
      const hypeBuyerFlag = isHypeBuyer ? ' 🔥' : '';
      const discountFlag = shouldApplyDiscount ? ` (${DISCOUNT_CODE})` : '';

      if ((systematicCount + i + 1) % 10 === 0) {
        console.log(`✓ Created ${stats.total}/${orderCount}... Latest: #${order.name} - $${order.total_price}${discountFlag}${hypeBuyerFlag}`);
      }

      // Cancel order if applicable
      if (shouldCancel) {
        console.log(`  🔄 Attempting to cancel order #${order.name}...`);
        const cancelled = await cancelOrder(restClient, order.id);
        if (cancelled) {
          stats.cancelled++;
          console.log(`  ⚠️  Successfully cancelled order #${order.name}`);
        }
      }
    } catch (error: any) {
      console.error(`✗ Failed to create order ${systematicCount + i + 1}: ${error.message}`);
    }
  }

  // ========================================
  // Print Summary
  // ========================================
  console.log();
  console.log('━'.repeat(60));
  console.log('✨ Order Generation Complete!');
  console.log('━'.repeat(60));
  console.log();
  console.log('📊 Summary:');
  console.log(`  Total Orders Created: ${stats.total}`);
  console.log(`  ├─ Systematic: ${stats.systematic}`);
  console.log(`  └─ Random: ${stats.random}`);
  console.log();
  console.log(`  💰 Total Revenue: $${stats.totalRevenue.toFixed(2)}`);
  console.log(`  📈 Average Order Value: $${(stats.totalRevenue / stats.total).toFixed(2)}`);
  console.log();
  console.log('  Special Orders:');
  console.log(`  ├─ With Discounts: ${stats.withDiscounts} (${((stats.withDiscounts / stats.total) * 100).toFixed(0)}%)`);
  console.log(`  ├─ Cancelled: ${stats.cancelled} (${((stats.cancelled / stats.total) * 100).toFixed(0)}%)`);
  console.log(`  └─ Hype Buyers: ${stats.hypeBuyers} (${((stats.hypeBuyers / stats.total) * 100).toFixed(0)}%) 🔥`);
  console.log();

  if (stats.firstOrderTime && stats.lastOrderTime) {
    console.log('  ⏰ Time Range:');
    console.log(`     First Order: ${stats.firstOrderTime}`);
    console.log(`     Last Order: ${stats.lastOrderTime}`);
    console.log();
  }

  console.log(`🔗 View orders: https://admin.shopify.com/store/${SHOP.replace('.myshopify.com', '')}/orders`);
  console.log();
}

// ============================================================================
// CLI ENTRY POINT
// ============================================================================

const args = process.argv.slice(2);
const orderCount = args[0] ? parseInt(args[0]) : 100;

if (isNaN(orderCount) || orderCount < 1 || orderCount > 500) {
  console.error('\n❌ Please provide a valid count between 1 and 500');
  console.log('\nUsage: npx tsx scripts/ultimate-order-generator.ts [count]');
  console.log('Example: npx tsx scripts/ultimate-order-generator.ts 100\n');
  process.exit(1);
}

const startTime = Date.now();
generateUltimateOrders(orderCount)
  .then(() => {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`⏱️  Execution Time: ${duration} seconds\n`);
  })
  .catch(error => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
