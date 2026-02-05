"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getShopifyConfig = getShopifyConfig;
exports.getStoreUrl = getStoreUrl;
exports.extractShopName = extractShopName;
exports.buildAdminUrl = buildAdminUrl;
const dotenv_1 = require("dotenv");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
// Load .env.local first (for local development), then .env
const envLocalPath = path_1.default.join(process.cwd(), '.env.local');
const envPath = path_1.default.join(process.cwd(), '.env');
if (fs_1.default.existsSync(envLocalPath)) {
    (0, dotenv_1.config)({ path: envLocalPath });
    console.log('📝 Loaded environment from .env.local');
}
else if (fs_1.default.existsSync(envPath)) {
    (0, dotenv_1.config)({ path: envPath });
    console.log('📝 Loaded environment from .env');
}
/**
 * Validate and return Shopify configuration
 * Exits process if required variables are missing
 */
function getShopifyConfig() {
    const errors = [];
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
        apiKey: apiKey,
        apiSecret: apiSecret,
        appUrl: appUrl,
        scopes: process.env.SHOPIFY_SCOPES?.split(',') || ['read_orders'],
        storeUrl: storeUrl,
        port: parseInt(process.env.PORT || '3000', 10),
    };
}
function getStoreUrl() {
    const config = getShopifyConfig();
    return config.storeUrl;
}
function extractShopName(storeUrl) {
    return storeUrl.replace(/\.myshopify\.com$/, '');
}
function buildAdminUrl(storeUrl, path) {
    const shopName = extractShopName(storeUrl);
    return `https://admin.shopify.com/store/${shopName}${path}`;
}
