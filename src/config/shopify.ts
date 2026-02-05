import { config } from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load .env.local first (for local development), then .env
const envLocalPath = path.join(process.cwd(), '.env.local');
const envPath = path.join(process.cwd(), '.env');

if (fs.existsSync(envLocalPath)) {
  config({ path: envLocalPath });
  console.log('📝 Loaded environment from .env.local');
} else if (fs.existsSync(envPath)) {
  config({ path: envPath });
  console.log('📝 Loaded environment from .env');
}

export interface ShopifyConfig {
  apiKey: string;
  apiSecret: string;
  appUrl: string;
  scopes: string[];
  storeUrl: string;
  port: number;
}

/**
 * Validate and return Shopify configuration
 * Exits process if required variables are missing
 */
export function getShopifyConfig(): ShopifyConfig {
  const errors: string[] = [];

  // Validate required environment variables
  const apiKey = process.env.SHOPIFY_API_KEY;
  const apiSecret = process.env.SHOPIFY_API_SECRET;
  const appUrl = process.env.SHOPIFY_APP_URL;
  const storeUrl = process.env.SHOPIFY_STORE_URL;

  if (!apiKey || apiKey === 'your_api_key_here') {
    errors.push('SHOPIFY_API_KEY is not set or using placeholder value');
  }
  if (!apiSecret || apiSecret === 'your_api_secret_here') {
    errors.push('SHOPIFY_API_SECRET is not set or using placeholder value');
  }
  if (!appUrl || appUrl === 'https://your-app-url-here') {
    errors.push('SHOPIFY_APP_URL is not set or using placeholder value');
  }
  if (!storeUrl || storeUrl === 'your-store.myshopify.com') {
    errors.push('SHOPIFY_STORE_URL is not set or using placeholder value');
  }

  if (errors.length > 0) {
    console.error('\n❌ Environment Configuration Errors:\n');
    errors.forEach(error => console.error(`   • ${error}`));
    console.error('\n💡 Please update your .env.local file with valid credentials.');
    console.error('   Get your credentials from: https://partners.shopify.com\n');
    process.exit(1);
  }

  return {
    apiKey: apiKey!,
    apiSecret: apiSecret!,
    appUrl: appUrl!,
    scopes: process.env.SHOPIFY_SCOPES?.split(',') || ['read_orders'],
    storeUrl: storeUrl!,
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
