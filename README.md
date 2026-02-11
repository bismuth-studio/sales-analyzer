# Drop Analyzer - Shopify App

A comprehensive Shopify app for analyzing product drops with detailed sales tracking, inventory management, and advanced analytics.

## Features

### Drop Management
- **Create & Track Drops** - Define time-based sales periods for product drops
- **Collection Support** - Associate drops with specific Shopify collections or track all products
- **Drop Status Tracking** - Automatic status badges (Scheduled, Active, Completed)
- **Edit & Delete** - Full CRUD operations for managing your drops

### Analytics & Reporting
- **Real-Time Metrics** - Server-side cached metrics with automatic updates via webhooks
- **Sales Summary** - View total revenue, units sold, and average order value
- **Product Performance** - Detailed breakdown by product and variant with intelligent ranking
- **Performance Scoring** - Advanced algorithms to identify top-performing products
- **Color-Based Analysis** - Track sales by product color with visual charts
- **Size-Based Analysis** - Track sales patterns by product size
- **Time-Based Trends** - Minute-by-minute sales data visualization
- **Sell-Through Rates** - Calculate sell-through percentages with inventory tracking
- **Sold-Out Tracking** - Monitor which variants have sold out
- **Top Sellers Cards** - Highlighted display of best-performing products

### Inventory Management
- **Automatic Snapshots** - Capture inventory at drop creation time
- **Manual Editing** - Adjust inventory quantities manually for accurate calculations
- **CSV Import** - Bulk import inventory data from CSV files
- **Hybrid Tracking** - Combine auto-captured data with manual overrides

### Real-Time Order Sync
- **Webhook Integration** - Automatic order sync via Shopify webhooks
- **GraphQL API** - Fast, efficient data fetching using Shopify's GraphQL Admin API
- **Background Processing** - Non-blocking order sync with worker threads
- **Local Database** - SQLite cache for instant analytics without API calls
- **Automatic Updates** - Drop metrics recalculate automatically when orders arrive

### Order Exploration
- **Advanced Filtering** - Filter orders by date range, product, and collection
- **Quick Drop Creation** - Create drops directly from filtered order views
- **Live Dashboard** - Real-time order data synced automatically via webhooks
- **Summary Cards** - At-a-glance metrics for filtered order sets

### Built With
- **Frontend**: React 18 + TypeScript, Shopify Polaris UI, Shopify Polaris Viz charts
- **Backend**: Express 5 + TypeScript, Shopify GraphQL Admin API
- **Database**: SQLite (better-sqlite3) with WAL mode and worker threads (Piscina)
- **Real-Time**: Shopify webhooks with HMAC verification
- **Performance**: Server-side caching, rate limiting, background sync
- **Session Management**: Persistent SQLite session storage

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Shopify App

1. Go to your [Shopify Partner Dashboard](https://partners.shopify.com/)
2. Create a new app or use an existing one
3. Note down your:
   - API Key
   - API Secret Key

### 3. Set Up ngrok (for local development)

```bash
# Install ngrok if you haven't already
# Then run:
ngrok http 3000
```

Copy the HTTPS URL (e.g., `https://abc123.ngrok-free.dev`)

### 4. Configure Environment Variables

Create a `.env.local` file in the project root (using the ngrok URL from step 3):

```env
# Shopify App Configuration
SHOPIFY_API_KEY=your_api_key_from_partner_dashboard
SHOPIFY_API_SECRET=your_api_secret_from_partner_dashboard
SHOPIFY_APP_URL=https://your-ngrok-url.ngrok-free.dev
SHOPIFY_SCOPES=read_orders,read_products
PORT=3000

# Store Configuration (REQUIRED)
SHOPIFY_STORE_URL=your-store.myshopify.com

# Optional - For order generator script
SHOPIFY_ACCESS_TOKEN=shpat_xxxxx
DISCOUNT_CODE=10%off
```

### 5. Update App URLs in Shopify Partner Dashboard

In your app settings, configure:
- **App URL**: `https://your-ngrok-url.ngrok-free.dev`
- **Allowed redirection URL(s)**: `https://your-ngrok-url.ngrok-free.dev/api/shopify/callback`

### 5b. Configure Webhooks (Optional but Recommended)

For real-time order syncing, configure these webhooks in your app settings:

**GDPR Webhooks (Mandatory)**:
- `customers/data_request`: `https://your-ngrok-url.ngrok-free.dev/api/webhooks/customers/data_request`
- `customers/redact`: `https://your-ngrok-url.ngrok-free.dev/api/webhooks/customers/redact`
- `shop/redact`: `https://your-ngrok-url.ngrok-free.dev/api/webhooks/shop/redact`

**Optional Webhooks** (for real-time sync):
- `orders/create`: `https://your-ngrok-url.ngrok-free.dev/api/webhooks/orders/create`
- `orders/updated`: `https://your-ngrok-url.ngrok-free.dev/api/webhooks/orders/updated`

> **Note**: Webhooks enable automatic order sync and drop metrics updates. Without them, you'll need to manually refresh order data.

### 6. Run the App

```bash
# Development mode (runs both frontend and backend concurrently)
npm run dev

# Or run them separately:
npm run dev:server  # Backend API on port 3000
npm run dev:client  # Frontend dev server on port 3001
```

### 7. Install the App on Your Store

1. Visit: `https://your-ngrok-url.ngrok-free.dev/api/shopify/auth?shop=your-store.myshopify.com`
2. Follow the OAuth flow to install the app
3. You'll be redirected to the Drop Analyzer dashboard

### 8. Create Your First Drop

1. Click "New Drop" button on the dashboard
2. Set a title, start time, and end time
3. Optionally select a collection to track specific products
4. Save and view detailed analytics

## Available Scripts

### Development
- `npm run dev` - Run both frontend and backend concurrently in development mode
- `npm run dev:server` - Run only the backend server with hot reload (port 3000)
- `npm run dev:client` - Run only the frontend dev server with Vite (port 3001)

### Production
- `npm run build` - Build both frontend and backend for production
- `npm run build:client` - Build only the React frontend with Vite
- `npm run build:server` - Compile TypeScript server code
- `npm start` - Run the production server

### Testing & Utilities
- `npx tsx scripts/ultimate-order-generator.ts [count]` - Generate realistic test orders
- `npx tsx scripts/get-access-token.ts` - Get Shopify access token for scripts
- `npx tsx scripts/create-products.js` - Create sample products in your store

## Project Structure

```
drop-analyzer/
├── src/
│   ├── server/                           # Express backend
│   │   ├── index.ts                      # Main server entry point
│   │   ├── shopify.ts                    # Shopify OAuth & API configuration
│   │   ├── orders.ts                     # Orders API endpoints
│   │   ├── drops.ts                      # Drops CRUD API endpoints
│   │   ├── webhooks.ts                   # Webhook handlers (GDPR, orders)
│   │   ├── webhookVerification.ts        # HMAC webhook verification
│   │   ├── sessionStorage.ts             # SQLite session & data storage
│   │   ├── database.ts                   # Database worker pool
│   │   ├── databaseAsync.ts              # Async database operations
│   │   ├── databaseWorker.ts             # Worker thread for database
│   │   ├── orderSyncService.ts           # GraphQL order sync service
│   │   ├── dropMetricsService.ts         # Drop metrics calculation & caching
│   │   ├── shopifyRateLimiter.ts         # API rate limiting
│   │   ├── migrateDropMetrics.ts         # Database migration utilities
│   │   └── routes/
│   │       └── config.ts                 # Client configuration API
│   ├── config/
│   │   └── shopify.ts                    # Centralized Shopify configuration
│   ├── utils/
│   │   ├── productRanking.ts             # Product ranking algorithms
│   │   └── dropScore.ts                  # Performance scoring system
│   ├── client/                           # React frontend
│   │   ├── index.tsx                     # React entry point
│   │   ├── App.tsx                       # Main App component with routing
│   │   └── styles.css                    # Global styles
│   └── components/                       # React UI components
│       ├── Dashboard.tsx                 # Main dashboard with drops list
│       ├── DropAnalysis.tsx              # Individual drop analysis page
│       ├── DropModal.tsx                 # Create/edit drop modal
│       ├── OrdersList.tsx                # Basic orders list
│       ├── OrdersListWithFilters.tsx     # Advanced order filtering
│       ├── PerformanceScoreCard.tsx      # Performance metrics display
│       ├── orders/                       # Order analysis components
│       │   ├── FilterSection.tsx         # Order filtering UI
│       │   ├── SummaryMetricsCard.tsx    # Summary metrics display
│       │   ├── TopSellersCard.tsx        # Top selling products
│       │   ├── PerformingProductsCard.tsx # Product performance rankings
│       │   ├── SoldOutVariantsSection.tsx # Sold-out tracking
│       │   ├── OrderDataCard.tsx         # Order data display
│       │   └── types.ts                  # TypeScript interfaces
│       └── InventoryManagement/
│           ├── InventoryManagement.tsx   # Inventory tracking UI
│           ├── InventoryTable.tsx        # Editable inventory table
│           ├── CSVImportModal.tsx        # CSV import functionality
│           └── InventoryTypes.ts         # TypeScript interfaces
├── scripts/                              # Utility scripts
│   ├── ultimate-order-generator.ts       # Generate realistic test orders
│   ├── get-access-token.ts               # Get Shopify access token
│   ├── create-products.js                # Create sample products
│   ├── README-ORDER-GENERATOR.md         # Order generator documentation
│   └── QUICK-START.md                    # Quick start guide
├── data/                                 # Database storage
│   ├── sessions.db                       # Sessions, orders, cache (auto-created)
│   └── drops.db                          # Drops database (auto-created)
├── public/                               # Static assets
│   └── index.html                        # HTML template
├── dist/                                 # Built files (generated)
│   ├── client/                           # Built React app
│   └── server/                           # Built Node.js server
├── .env                                  # Environment variables (create this)
├── .env.example                          # Example environment configuration
├── package.json                          # Dependencies and scripts
├── tsconfig.json                         # TypeScript config for client
├── tsconfig.server.json                  # TypeScript config for server
└── vite.config.ts                        # Vite bundler configuration
```

## Testing with Sample Data

### Generate Realistic Test Orders

The app includes an advanced order generator script that creates realistic test data:

```bash
# Generate 100 orders (default)
npx tsx scripts/ultimate-order-generator.ts

# Generate custom number of orders (1-500)
npx tsx scripts/ultimate-order-generator.ts 250
```

**Features of the order generator:**
- **Drop Pattern Simulation** - 65% of orders in first 20 minutes, 35% over next 100 minutes
- **30 Diverse Customers** - Realistic profiles across 10 US cities
- **Hype Buyers** - ~15% of orders with 5-10 items (simulates resellers)
- **Discount Codes** - ~12% of orders apply discount codes
- **Cancellations** - ~5% of orders get cancelled
- **Complete Coverage** - All product variants get orders

See [scripts/README-ORDER-GENERATOR.md](scripts/README-ORDER-GENERATOR.md) for full documentation.

### Create Sample Products

```bash
npx tsx scripts/create-products.js
```

This creates a set of sample products in your Shopify store for testing.

## Key Features Explained

### Real-Time Webhook Sync

The app uses Shopify webhooks for automatic, real-time order synchronization:

1. **Automatic Sync**: When a new order is created in your store, Shopify sends a webhook to the app
2. **HMAC Verification**: Webhooks are cryptographically verified to ensure authenticity
3. **Background Processing**: Orders are processed in background worker threads without blocking the UI
4. **Metrics Updates**: Drop metrics automatically recalculate when relevant orders arrive
5. **GraphQL API**: Fast, efficient data fetching using Shopify's GraphQL Admin API

**Benefits:**
- No manual refresh needed - data updates automatically
- Instant analytics as orders come in
- Reduced API calls (data cached locally)
- Works even when app is not open in browser

**Manual Sync Available**: You can also trigger manual order sync from the dashboard if needed.

### Server-Side Caching & Performance

To provide instant analytics without hitting Shopify API limits:

1. **Drop Metrics Cache**: Revenue, order count, discounts, and refunds are pre-calculated and stored
2. **Product Metadata Cache**: Product images, types, vendors cached to avoid repeated API calls
3. **Worker Threads**: Database operations run in separate threads (Piscina) for non-blocking performance
4. **WAL Mode**: SQLite Write-Ahead Logging allows concurrent reads while writing
5. **Smart Invalidation**: Caches automatically update when webhooks arrive

**Result**: Dashboard loads instantly, even with thousands of orders.

### Product Ranking & Intelligence

Advanced algorithms identify your best-performing products:

1. **Multi-Factor Ranking**: Considers revenue, units sold, sell-through rate, and order frequency
2. **Performance Scoring**: Each product gets a score from 0-100 based on multiple metrics
3. **Size Analysis**: Track which sizes sell best (S, M, L, XL, etc.)
4. **Sold-Out Tracking**: Automatically identifies and highlights sold-out variants
5. **Top Sellers Cards**: Visual cards highlighting your best performers

**Use Cases:**
- Identify products to restock
- Spot trending colors or sizes
- Find underperformers
- Plan future drops based on data

### Drop Creation & Management

1. **Create a Drop**: Click "New Drop" and specify:
   - Title (e.g., "Summer 2026 Drop")
   - Start and end time for the sales period
   - Optional: Select a Shopify collection to track specific products

2. **Automatic Status**: Drops automatically show their status:
   - **Scheduled**: Start time is in the future
   - **Active**: Currently within the drop window
   - **Completed**: End time has passed

3. **Edit & Delete**: Update drop details or remove drops you no longer need

### Analytics Dashboard

For each drop, view:

- **Sales Summary Tab**
  - Total revenue and units sold
  - Average order value
  - Number of orders during the drop period
  - Timeline charts showing sales over time

- **Product Sales Summary Tab**
  - Breakdown by product and variant
  - Inventory tracking and sell-through rates
  - Sortable columns for revenue, units sold, etc.

- **By Color Tab** (if products have color variants)
  - Sales grouped by product color
  - Visual charts for quick insights

### Inventory Management

The inventory management feature helps calculate accurate sell-through rates:

1. **Automatic Snapshot**: When you create a drop, inventory is captured automatically
2. **Manual Editing**: Adjust quantities if you know the actual starting inventory
3. **CSV Import**: Bulk import inventory data from a CSV file
4. **Reset to Original**: Restore the auto-captured snapshot if needed

**Why is this useful?**
Sell-through rate = (Units Sold / Starting Inventory) × 100%

Accurate starting inventory data gives you precise sell-through metrics.

### Order Explorer

At the bottom of the dashboard, use the Order Explorer to:
- Filter orders by date range
- Search by product or collection
- Quickly create drops based on filtered results
- View order details before creating a drop

## Troubleshooting

### Authentication Issues

**Problem**: "Shop not detected" or authentication errors

**Solution**:
1. Make sure your `.env` file has correct `SHOPIFY_API_KEY` and `SHOPIFY_API_SECRET`
2. Verify your ngrok URL is set in `SHOPIFY_APP_URL`
3. Check that redirect URLs match in Shopify Partner Dashboard
4. Try re-authenticating: Visit `https://your-ngrok-url.ngrok-free.dev/api/shopify/auth?shop=your-store.myshopify.com`

### No Data Showing

**Problem**: Drops show but no sales data appears

**Solution**:
1. Verify the app has `read_orders` and `read_products` scopes
2. Check that your store has orders within the drop's time range
3. If testing, use the order generator script to create test data
4. Make sure the drop's collection exists and has products (if collection-specific)

### Database Errors

**Problem**: SQLite errors or database corruption

**Solution**:
1. The app uses two databases:
   - `data/sessions.db` - Sessions, orders, product cache
   - `data/drops.db` - Drop configuration and metrics
2. Restart the server - migrations run automatically
3. If corrupted, you can delete either database file:
   - Delete `data/sessions.db` - Lose OAuth sessions and cached orders (will re-sync)
   - Delete `data/drops.db` - Lose all drop data (cannot be recovered)
4. The server will recreate databases on next start

### Port Already in Use

**Problem**: Error: "Port 3000 is already in use"

**Solution**:
```bash
# Find and kill the process using port 3000
lsof -ti:3000 | xargs kill

# Or change the port in .env
PORT=3001
```

### Order Generator Issues

**Problem**: Order generator fails with "Access token required"

**Solution**:
1. Add `SHOPIFY_ACCESS_TOKEN` to your `.env` file
2. Run `npx tsx scripts/get-access-token.ts` to get your token
3. See [scripts/README-ORDER-GENERATOR.md](scripts/README-ORDER-GENERATOR.md) for details

### CSV Import Not Working

**Problem**: Inventory CSV import fails

**Solution**:
1. CSV must have two columns: `variant_id` and `quantity`
2. Variant IDs must match Shopify variant IDs (numeric)
3. Quantities must be valid numbers
4. Check the browser console for specific error messages

### Webhooks Not Working

**Problem**: Orders aren't syncing automatically

**Solution**:
1. Check that webhooks are configured in Shopify Partner Dashboard
2. Verify webhook URLs match your current ngrok/production URL
3. Check server logs for webhook verification errors
4. Ensure your server is accessible from the internet (ngrok running)
5. Manually trigger sync from dashboard: "Sync Orders" button

### Order Sync Fails

**Problem**: "Order sync failed" or "GraphQL error"

**Solution**:
1. Check that your access token has `read_orders` and `read_products` scopes
2. Verify `SHOPIFY_STORE_URL` is set correctly in `.env`
3. Check server logs for specific GraphQL errors
4. Try manual sync with smaller date ranges
5. Rate limiting may be active - wait 1-2 minutes and retry

### Metrics Not Updating

**Problem**: Drop metrics show old data

**Solution**:
1. Check that webhooks are configured and working
2. Manually trigger metrics refresh from drop detail page
3. Check server logs for cache update errors
4. Verify orders table has data: Check `data/sessions.db`
5. Restart server to force metrics recalculation

## Technology Stack

### Frontend
- **React 18** - UI library
- **TypeScript** - Type-safe JavaScript
- **Shopify Polaris 13.9** - Official Shopify design system
- **Shopify Polaris Viz 16.16** - Data visualization components
- **Shopify App Bridge React** - Embedded app integration
- **React Router DOM 7** - Client-side routing
- **Vite 7** - Fast build tool and dev server

### Backend
- **Express 5** - Web server framework
- **TypeScript** - Type-safe server code
- **better-sqlite3** - Fast, synchronous SQLite database
- **Piscina** - Worker thread pool for database operations
- **@shopify/shopify-api 12.2** - Official Shopify API library (GraphQL)
- **p-queue** - Promise queue for rate limiting
- **CORS** - Cross-origin resource sharing
- **dotenv** - Environment variable management

### Real-Time & Performance
- **Shopify Webhooks** - HMAC-verified webhook handlers
- **GraphQL Admin API** - Efficient data fetching
- **Server-Side Caching** - Drop metrics calculation and storage
- **Worker Threads** - Non-blocking database operations
- **WAL Mode SQLite** - Better concurrency for reads/writes
- **Rate Limiting** - Shopify API quota management

### Development Tools
- **Nodemon** - Auto-restart server on changes
- **tsx** - TypeScript execution for scripts
- **Concurrently** - Run multiple npm scripts in parallel

## Production Deployment

### Build for Production

```bash
# Build both client and server
npm run build
```

This creates optimized production builds in the `dist/` directory.

### Run in Production

```bash
# Start the production server
npm start
```

The server will:
1. Serve the built React app from `dist/client`
2. Handle API requests on the same port
3. Use SQLite databases: `data/sessions.db` (orders, cache) and `data/drops.db` (analytics)

### Deployment Considerations

1. **Environment Variables**: Set all required environment variables on your hosting platform
2. **Databases**: Both SQLite database files (`data/sessions.db` and `data/drops.db`) need persistent storage
3. **HTTPS Required**: Shopify apps must use HTTPS - use a reverse proxy or hosting platform with SSL
4. **App URL**: Update `SHOPIFY_APP_URL` to your production domain
5. **Shopify Partner Dashboard**: Update app URLs to production URLs

### Recommended Hosting Platforms
- **Railway** - Easy Node.js deployment with persistent storage
- **Render** - Free tier available, supports SQLite with persistent disks
- **Heroku** - Popular PaaS (note: ephemeral filesystem, consider database alternatives)
- **DigitalOcean App Platform** - Simple deployment with managed databases
- **Fly.io** - Global deployment with persistent volumes

## API Endpoints

### Shopify OAuth
- `GET /api/shopify/auth` - Initiate OAuth flow
- `GET /api/shopify/callback` - OAuth callback handler

### Configuration
- `GET /api/config` - Get client-safe configuration (API key, store URL)

### Drops
- `GET /api/drops?shop=SHOP_NAME` - List all drops for a shop (with cached metrics)
- `GET /api/drops/:dropId` - Get a specific drop
- `POST /api/drops` - Create a new drop (auto-captures inventory, calculates initial metrics)
- `PUT /api/drops/:dropId` - Update a drop
- `DELETE /api/drops/:dropId` - Delete a drop
- `PUT /api/drops/:dropId/inventory` - Update inventory snapshot
- `POST /api/drops/:dropId/inventory/snapshot` - Take fresh inventory snapshot
- `POST /api/drops/:dropId/inventory/reset` - Reset to original snapshot

### Orders
- `GET /api/orders/recent?shop=SHOP_NAME` - Fetch cached orders with pagination
- `POST /api/orders/sync?shop=SHOP_NAME` - Trigger manual order sync from Shopify
- `GET /api/orders/sync-status?shop=SHOP_NAME` - Get order sync status
- `POST /api/orders/product-images` - Batch fetch product images and metadata
- `GET /api/orders/collections?shop=SHOP_NAME` - List all collections
- `GET /api/orders/inventory?shop=SHOP_NAME&variantIds=...` - Get current inventory levels
- `GET /api/orders/variants?shop=SHOP_NAME&variantIds=...` - Get variant metadata (SKU, names)

### Webhooks (HMAC Verified)
- `POST /api/webhooks/customers/data_request` - GDPR: Customer data request
- `POST /api/webhooks/customers/redact` - GDPR: Customer data redaction
- `POST /api/webhooks/shop/redact` - GDPR: Shop data redaction
- `POST /api/webhooks/orders/create` - Real-time order creation sync
- `POST /api/webhooks/orders/updated` - Real-time order update sync

### Health Check
- `GET /api/health` - Check API and database health

## Database Schema

The app uses two SQLite databases with the following schemas:

### sessions.db (Session & Order Data)

```sql
-- Shopify OAuth sessions
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  shop TEXT NOT NULL,
  state TEXT,
  is_online INTEGER NOT NULL DEFAULT 0,
  scope TEXT,
  access_token TEXT,
  expires_at TEXT,
  online_access_info TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Cached order data (synced via webhooks)
CREATE TABLE orders (
  id INTEGER NOT NULL,
  shop TEXT NOT NULL,
  name TEXT,
  email TEXT,
  created_at TEXT NOT NULL,
  total_price TEXT,
  subtotal_price TEXT,
  total_discounts TEXT,
  total_line_items_price TEXT,
  currency TEXT,
  financial_status TEXT,
  tags TEXT,
  customer_json TEXT,
  refunds_json TEXT,
  line_items_json TEXT NOT NULL,
  synced_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (shop, id)
);

-- Product metadata cache
CREATE TABLE product_cache (
  id INTEGER PRIMARY KEY,
  shop TEXT NOT NULL,
  product_id TEXT NOT NULL,
  image_url TEXT,
  product_type TEXT,
  vendor TEXT,
  category TEXT,
  cached_at TEXT DEFAULT (datetime('now')),
  UNIQUE(shop, product_id)
);

-- Order sync status tracking
CREATE TABLE order_sync_status (
  shop TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'idle',
  total_orders INTEGER,
  synced_orders INTEGER DEFAULT 0,
  last_order_id TEXT,
  started_at TEXT,
  completed_at TEXT
);
```

### drops.db (Drop Analytics)

```sql
CREATE TABLE drops (
  id TEXT PRIMARY KEY,
  shop TEXT NOT NULL,
  title TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  collection_id TEXT,
  collection_title TEXT,
  inventory_snapshot TEXT,
  snapshot_taken_at TEXT,
  inventory_source TEXT DEFAULT 'auto',
  original_inventory_snapshot TEXT,
  net_sales REAL,
  order_count INTEGER,
  gross_sales REAL,
  discounts REAL,
  refunds REAL,
  metrics_cached_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
```

## Contributing

This is a custom Shopify app for internal use. If you'd like to contribute or suggest features:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

This project is licensed for internal use. All rights reserved.

## Additional Resources

- [Shopify App Development Documentation](https://shopify.dev/docs/apps)
- [Shopify Polaris Design System](https://polaris.shopify.com/)
- [Shopify Admin API Reference](https://shopify.dev/docs/api/admin)
- [Order Generator Documentation](scripts/README-ORDER-GENERATOR.md)

## Support

For issues or questions:
- Check the [Troubleshooting](#troubleshooting) section
- Review [scripts/README-ORDER-GENERATOR.md](scripts/README-ORDER-GENERATOR.md) for order generator help
- Consult Shopify API documentation for API-related issues

---

**Built for analyzing street fashion product drops with precision and style.**
