import { config } from 'dotenv';

config();

export interface ShopifyConfig {
  apiKey: string;
  apiSecret: string;
  appUrl: string;
  scopes: string[];
  storeUrl: string;
  port: number;
}

export function getShopifyConfig(): ShopifyConfig {
  const storeUrl = process.env.SHOPIFY_STORE_URL;

  if (!storeUrl) {
    console.error('❌ SHOPIFY_STORE_URL is not set in .env');
    console.error('   Add: SHOPIFY_STORE_URL=your-store.myshopify.com');
    process.exit(1);
  }

  return {
    apiKey: process.env.SHOPIFY_API_KEY!,
    apiSecret: process.env.SHOPIFY_API_SECRET!,
    appUrl: process.env.SHOPIFY_APP_URL || '',
    scopes: process.env.SHOPIFY_SCOPES?.split(',') || ['read_orders'],
    storeUrl,
    port: parseInt(process.env.PORT || '3000', 10),
  };
}

export function getStoreUrl(): string {
  const config = getShopifyConfig();
  return config.storeUrl;
}

export function extractShopName(storeUrl: string): string {
  return storeUrl.replace(/\.myshopify\.com$/, '');
}

export function buildAdminUrl(storeUrl: string, path: string): string {
  const shopName = extractShopName(storeUrl);
  return `https://admin.shopify.com/store/${shopName}${path}`;
}
