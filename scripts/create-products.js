require('dotenv/config');
const { shopifyApi } = require('@shopify/shopify-api');
require('@shopify/shopify-api/adapters/node');

const { SHOPIFY_ACCESS_TOKEN, SHOPIFY_API_KEY, SHOPIFY_API_SECRET } = process.env;
const SHOP = 'bismuth-dev.myshopify.com';

// Initialize Shopify
const shopify = shopifyApi({
  apiKey: SHOPIFY_API_KEY,
  apiSecretKey: SHOPIFY_API_SECRET,
  scopes: ['read_products', 'write_products'],
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

// Product templates
const products = [
  {
    title: 'Classic Cotton T-Shirt',
    body_html: 'Comfortable 100% cotton t-shirt perfect for everyday wear.',
    vendor: 'Bismuth Fashion',
    product_type: 'T-Shirt',
    tags: ['casual', 'cotton', 'everyday'],
    variants: [
      // Black variants
      { option1: 'Black', option2: 'S', price: '19.99', sku: 'TSH-BLK-S', inventory_quantity: 50 },
      { option1: 'Black', option2: 'M', price: '19.99', sku: 'TSH-BLK-M', inventory_quantity: 75 },
      { option1: 'Black', option2: 'L', price: '19.99', sku: 'TSH-BLK-L', inventory_quantity: 60 },
      { option1: 'Black', option2: 'XL', price: '19.99', sku: 'TSH-BLK-XL', inventory_quantity: 40 },
      // White variants
      { option1: 'White', option2: 'S', price: '19.99', sku: 'TSH-WHT-S', inventory_quantity: 55 },
      { option1: 'White', option2: 'M', price: '19.99', sku: 'TSH-WHT-M', inventory_quantity: 80 },
      { option1: 'White', option2: 'L', price: '19.99', sku: 'TSH-WHT-L', inventory_quantity: 65 },
      { option1: 'White', option2: 'XL', price: '19.99', sku: 'TSH-WHT-XL', inventory_quantity: 45 },
      // Navy variants
      { option1: 'Navy', option2: 'S', price: '19.99', sku: 'TSH-NVY-S', inventory_quantity: 45 },
      { option1: 'Navy', option2: 'M', price: '19.99', sku: 'TSH-NVY-M', inventory_quantity: 70 },
      { option1: 'Navy', option2: 'L', price: '19.99', sku: 'TSH-NVY-L', inventory_quantity: 55 },
      { option1: 'Navy', option2: 'XL', price: '19.99', sku: 'TSH-NVY-XL', inventory_quantity: 35 },
    ],
    options: [
      { name: 'Color', values: ['Black', 'White', 'Navy'] },
      { name: 'Size', values: ['S', 'M', 'L', 'XL'] },
    ],
  },
  {
    title: 'Premium Hoodie',
    body_html: 'Soft fleece hoodie with adjustable drawstring hood and kangaroo pocket.',
    vendor: 'Bismuth Fashion',
    product_type: 'Hoodie',
    tags: ['casual', 'warm', 'comfortable'],
    variants: [
      // Gray variants
      { option1: 'Gray', option2: 'S', price: '49.99', sku: 'HOD-GRY-S', inventory_quantity: 30 },
      { option1: 'Gray', option2: 'M', price: '49.99', sku: 'HOD-GRY-M', inventory_quantity: 50 },
      { option1: 'Gray', option2: 'L', price: '49.99', sku: 'HOD-GRY-L', inventory_quantity: 45 },
      { option1: 'Gray', option2: 'XL', price: '49.99', sku: 'HOD-GRY-XL', inventory_quantity: 25 },
      // Black variants
      { option1: 'Black', option2: 'S', price: '49.99', sku: 'HOD-BLK-S', inventory_quantity: 35 },
      { option1: 'Black', option2: 'M', price: '49.99', sku: 'HOD-BLK-M', inventory_quantity: 55 },
      { option1: 'Black', option2: 'L', price: '49.99', sku: 'HOD-BLK-L', inventory_quantity: 50 },
      { option1: 'Black', option2: 'XL', price: '49.99', sku: 'HOD-BLK-XL', inventory_quantity: 30 },
      // Burgundy variants
      { option1: 'Burgundy', option2: 'S', price: '49.99', sku: 'HOD-BUR-S', inventory_quantity: 25 },
      { option1: 'Burgundy', option2: 'M', price: '49.99', sku: 'HOD-BUR-M', inventory_quantity: 40 },
      { option1: 'Burgundy', option2: 'L', price: '49.99', sku: 'HOD-BUR-L', inventory_quantity: 35 },
      { option1: 'Burgundy', option2: 'XL', price: '49.99', sku: 'HOD-BUR-XL', inventory_quantity: 20 },
    ],
    options: [
      { name: 'Color', values: ['Gray', 'Black', 'Burgundy'] },
      { name: 'Size', values: ['S', 'M', 'L', 'XL'] },
    ],
  },
  {
    title: 'V-Neck T-Shirt',
    body_html: 'Stylish v-neck t-shirt made from premium cotton blend.',
    vendor: 'Bismuth Fashion',
    product_type: 'T-Shirt',
    tags: ['casual', 'v-neck', 'premium'],
    variants: [
      // Charcoal variants
      { option1: 'Charcoal', option2: 'S', price: '24.99', sku: 'VNK-CHR-S', inventory_quantity: 40 },
      { option1: 'Charcoal', option2: 'M', price: '24.99', sku: 'VNK-CHR-M', inventory_quantity: 60 },
      { option1: 'Charcoal', option2: 'L', price: '24.99', sku: 'VNK-CHR-L', inventory_quantity: 50 },
      { option1: 'Charcoal', option2: 'XL', price: '24.99', sku: 'VNK-CHR-XL', inventory_quantity: 30 },
      // Olive variants
      { option1: 'Olive', option2: 'S', price: '24.99', sku: 'VNK-OLV-S', inventory_quantity: 35 },
      { option1: 'Olive', option2: 'M', price: '24.99', sku: 'VNK-OLV-M', inventory_quantity: 55 },
      { option1: 'Olive', option2: 'L', price: '24.99', sku: 'VNK-OLV-L', inventory_quantity: 45 },
      { option1: 'Olive', option2: 'XL', price: '24.99', sku: 'VNK-OLV-XL', inventory_quantity: 25 },
    ],
    options: [
      { name: 'Color', values: ['Charcoal', 'Olive'] },
      { name: 'Size', values: ['S', 'M', 'L', 'XL'] },
    ],
  },
  {
    title: 'Zip-Up Hoodie',
    body_html: 'Full-zip hoodie with side pockets and ribbed cuffs.',
    vendor: 'Bismuth Fashion',
    product_type: 'Hoodie',
    tags: ['athletic', 'zip-up', 'comfortable'],
    variants: [
      // Navy variants
      { option1: 'Navy', option2: 'S', price: '54.99', sku: 'ZIP-NVY-S', inventory_quantity: 28 },
      { option1: 'Navy', option2: 'M', price: '54.99', sku: 'ZIP-NVY-M', inventory_quantity: 45 },
      { option1: 'Navy', option2: 'L', price: '54.99', sku: 'ZIP-NVY-L', inventory_quantity: 40 },
      { option1: 'Navy', option2: 'XL', price: '54.99', sku: 'ZIP-NVY-XL', inventory_quantity: 22 },
      // Forest Green variants
      { option1: 'Forest Green', option2: 'S', price: '54.99', sku: 'ZIP-FGR-S', inventory_quantity: 25 },
      { option1: 'Forest Green', option2: 'M', price: '54.99', sku: 'ZIP-FGR-M', inventory_quantity: 42 },
      { option1: 'Forest Green', option2: 'L', price: '54.99', sku: 'ZIP-FGR-L', inventory_quantity: 38 },
      { option1: 'Forest Green', option2: 'XL', price: '54.99', sku: 'ZIP-FGR-XL', inventory_quantity: 20 },
    ],
    options: [
      { name: 'Color', values: ['Navy', 'Forest Green'] },
      { name: 'Size', values: ['S', 'M', 'L', 'XL'] },
    ],
  },
  {
    title: 'Long Sleeve T-Shirt',
    body_html: 'Comfortable long sleeve tee perfect for layering or wearing solo.',
    vendor: 'Bismuth Fashion',
    product_type: 'T-Shirt',
    tags: ['casual', 'long-sleeve', 'layering'],
    variants: [
      // Heather Gray variants
      { option1: 'Heather Gray', option2: 'S', price: '27.99', sku: 'LSL-HGY-S', inventory_quantity: 38 },
      { option1: 'Heather Gray', option2: 'M', price: '27.99', sku: 'LSL-HGY-M', inventory_quantity: 58 },
      { option1: 'Heather Gray', option2: 'L', price: '27.99', sku: 'LSL-HGY-L', inventory_quantity: 48 },
      { option1: 'Heather Gray', option2: 'XL', price: '27.99', sku: 'LSL-HGY-XL', inventory_quantity: 28 },
      // Maroon variants
      { option1: 'Maroon', option2: 'S', price: '27.99', sku: 'LSL-MRN-S', inventory_quantity: 32 },
      { option1: 'Maroon', option2: 'M', price: '27.99', sku: 'LSL-MRN-M', inventory_quantity: 52 },
      { option1: 'Maroon', option2: 'L', price: '27.99', sku: 'LSL-MRN-L', inventory_quantity: 42 },
      { option1: 'Maroon', option2: 'XL', price: '27.99', sku: 'LSL-MRN-XL', inventory_quantity: 24 },
      // Navy variants
      { option1: 'Navy', option2: 'S', price: '27.99', sku: 'LSL-NVY-S', inventory_quantity: 35 },
      { option1: 'Navy', option2: 'M', price: '27.99', sku: 'LSL-NVY-M', inventory_quantity: 55 },
      { option1: 'Navy', option2: 'L', price: '27.99', sku: 'LSL-NVY-L', inventory_quantity: 45 },
      { option1: 'Navy', option2: 'XL', price: '27.99', sku: 'LSL-NVY-XL', inventory_quantity: 26 },
    ],
    options: [
      { name: 'Color', values: ['Heather Gray', 'Maroon', 'Navy'] },
      { name: 'Size', values: ['S', 'M', 'L', 'XL'] },
    ],
  },
];

async function createProduct(productData) {
  try {
    console.log(`\nCreating product: ${productData.title}...`);

    const response = await client.post({
      path: 'products',
      data: { product: productData },
      type: 'application/json',
    });

    const product = response.body.product;
    console.log(`✓ Created: ${product.title} (ID: ${product.id})`);
    console.log(`  - ${product.variants.length} variants created`);

    return product;
  } catch (error) {
    console.error(`✗ Error creating ${productData.title}:`, error.message);
    if (error.response?.body?.errors) {
      console.error('  Details:', JSON.stringify(error.response.body.errors, null, 2));
    }
    return null;
  }
}

async function main() {
  console.log('🏪 Creating fashion products in Shopify store...\n');
  console.log(`Shop: ${SHOP}`);
  console.log(`Products to create: ${products.length}\n`);

  const createdProducts = [];

  for (const productData of products) {
    const product = await createProduct(productData);
    if (product) {
      createdProducts.push(product);
    }
    // Wait a bit between requests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n' + '='.repeat(50));
  console.log(`✓ Successfully created ${createdProducts.length} products!`);
  console.log('='.repeat(50));

  console.log('\nProduct Summary:');
  createdProducts.forEach(product => {
    console.log(`  - ${product.title}: ${product.variants.length} variants`);
  });

  console.log('\n✓ All products created successfully!');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
