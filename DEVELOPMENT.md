# Development Status & Documentation

## Current Status: Production-Ready Application ✅

Drop Analyzer is a **fully-featured, real-time Shopify app** for analyzing product drop sales with comprehensive analytics, inventory management, webhook integration, and intelligent product ranking.

---

## What We've Built

### Core Features - COMPLETE ✅

The app is a complete, real-time sales analytics platform with:

- **Drop Management** - Full CRUD operations for time-based sales periods
- **Real-Time Webhooks** - Automatic order sync via Shopify webhooks (orders/create, orders/updated)
- **GraphQL API Integration** - Fast, efficient data fetching from Shopify
- **Server-Side Caching** - Pre-calculated drop metrics with automatic updates
- **Advanced Analytics** - Multi-tab analytics with sales, product, color, and size breakdowns
- **Product Ranking** - Intelligent algorithms to identify top performers
- **Performance Scoring** - Multi-factor scoring system (0-100) for products
- **Inventory Management** - Auto-capture, manual editing, and CSV import
- **Order Filtering** - Advanced date range and product filtering
- **Data Visualization** - Charts and graphs using Shopify Polaris Viz
- **Sell-Through Tracking** - Accurate calculations with hybrid inventory data
- **Background Processing** - Worker threads for non-blocking database operations
- **Session Storage** - Persistent SQLite session management

---

## Technical Architecture

### Backend (Node.js + Express + TypeScript + GraphQL)

**Location**: [src/server/](src/server/)

#### Core Files:

1. **[src/server/index.ts](src/server/index.ts)** - Main Express Server
   - Serves React frontend in production
   - Routes all API requests (Shopify, Orders, Drops, Webhooks, Config)
   - Raw body parser for webhook HMAC verification
   - Health check endpoint at `/api/health` with database connectivity check
   - Static file serving from `dist/client/`
   - Runs on port 3000 (configurable via `.env`)

2. **[src/config/shopify.ts](src/config/shopify.ts)** - Centralized Configuration
   - Environment variable validation
   - Loads `.env.local` (dev) or `.env` (production)
   - Exports typed ShopifyConfig interface
   - Required variables: API key, secret, app URL, **store URL**
   - Helper functions: `getStoreUrl()`, `extractShopName()`, `buildAdminUrl()`

3. **[src/server/shopify.ts](src/server/shopify.ts)** - Shopify OAuth
   - Shopify API client initialization
   - OAuth authentication flow
   - Routes:
     - `GET /api/shopify/auth` - Initiates OAuth
     - `GET /api/shopify/callback` - OAuth callback handler
   - Session storage integration

4. **[src/server/sessionStorage.ts](src/server/sessionStorage.ts)** - Session & Data Storage
   - SQLite database at `data/sessions.db` with WAL mode
   - **4 Tables**:
     - `sessions` - OAuth sessions with access tokens
     - `orders` - Cached order data from webhooks
     - `product_cache` - Product metadata (images, types, vendors)
     - `order_sync_status` - Background sync progress tracking
   - Functions for session CRUD, order storage, product caching
   - GDPR compliance: `clearOrdersForShop()`, `deleteSessionsByShop()`

5. **[src/server/database.ts](src/server/database.ts)** - Database Worker Pool
   - Worker thread pool using **Piscina** (async database operations)
   - Non-blocking queries for drops table
   - Exports `runDatabaseOperation()` for async DB access

6. **[src/server/databaseWorker.ts](src/server/databaseWorker.ts)** - Worker Thread
   - Runs in separate thread via Piscina
   - SQLite database at `data/drops.db` with WAL mode
   - **Drops Table Schema**:
     - Drop info (title, times, collection)
     - Inventory snapshot
     - **Cached metrics**: net_sales, order_count, gross_sales, discounts, refunds
     - `metrics_cached_at` timestamp
   - Operations: getDrop, getDropsByShop, createDrop, updateDrop, deleteDrop, updateDropMetrics

7. **[src/server/databaseAsync.ts](src/server/databaseAsync.ts)** - Async DB Helpers
   - Wrapper functions for common database operations
   - Type-safe async/await interface

8. **[src/server/drops.ts](src/server/drops.ts)** - Drops CRUD API
   - `GET /api/drops?shop=X` - List drops with **cached metrics**
   - `GET /api/drops/:dropId` - Get single drop
   - `POST /api/drops` - Create drop (auto-captures inventory, calculates initial metrics)
   - `PUT /api/drops/:dropId` - Update drop
   - `DELETE /api/drops/:dropId` - Delete drop
   - `PUT /api/drops/:dropId/inventory` - Update inventory
   - `POST /api/drops/:dropId/inventory/snapshot` - Take fresh snapshot
   - `POST /api/drops/:dropId/inventory/reset` - Reset to original
   - All endpoints require `shop` parameter for authorization

9. **[src/server/dropMetricsService.ts](src/server/dropMetricsService.ts)** - Metrics Calculation
   - Calculates drop metrics from cached orders
   - Functions:
     - `calculateDropMetrics()` - Calculate metrics for one drop
     - `updateDropMetricsCache()` - Update cache for one drop
     - `updateShopDropMetrics()` - Update all drops for a shop
     - `updateDropMetricsForOrder()` - Update drops affected by a specific order
   - Metrics: net sales, order count, gross sales, discounts, refunds
   - Called automatically when webhooks arrive

10. **[src/server/orders.ts](src/server/orders.ts)** - Orders API
    - `GET /api/orders/recent?shop=X` - Fetch **cached orders** with pagination
    - `POST /api/orders/sync?shop=X` - Trigger manual GraphQL sync
    - `GET /api/orders/sync-status?shop=X` - Get sync progress
    - `POST /api/orders/product-images` - Batch fetch product images (with caching)
    - `GET /api/orders/collections?shop=X` - List all collections
    - `GET /api/orders/inventory?shop=X` - Current inventory levels
    - `GET /api/orders/variants?shop=X` - Variant metadata (SKU, names)
    - Advanced filtering by date, product, collection

11. **[src/server/orderSyncService.ts](src/server/orderSyncService.ts)** - GraphQL Order Sync
    - Background order sync using **Shopify GraphQL Admin API**
    - Fetches orders in batches with pagination
    - Stores in `orders` table in `sessions.db`
    - Updates sync status in real-time
    - Supports date range filtering
    - **GraphQL Query**: Optimized to fetch only needed fields

12. **[src/server/webhooks.ts](src/server/webhooks.ts)** - Webhook Handlers
    - **GDPR Webhooks** (mandatory):
      - `POST /api/webhooks/customers/data_request` - Log customer data requests
      - `POST /api/webhooks/customers/redact` - Delete customer data
      - `POST /api/webhooks/shop/redact` - Delete all shop data
    - **Order Webhooks** (real-time sync):
      - `POST /api/webhooks/orders/create` - New order created
      - `POST /api/webhooks/orders/updated` - Order updated/cancelled
    - All webhooks HMAC verified before processing
    - Automatic drop metrics updates when orders arrive

13. **[src/server/webhookVerification.ts](src/server/webhookVerification.ts)** - Security
    - HMAC signature verification for Shopify webhooks
    - Extracts shop domain and topic from headers
    - Prevents webhook spoofing

14. **[src/server/shopifyRateLimiter.ts](src/server/shopifyRateLimiter.ts)** - Rate Limiting
    - GraphQL API rate limit handling
    - Tracks API quota usage
    - Auto-retry with exponential backoff
    - Prevents 429 errors

15. **[src/server/routes/config.ts](src/server/routes/config.ts)** - Client Config API
    - `GET /api/config` - Returns client-safe configuration
    - Exposes API key and store URL (no secrets)
    - Used by frontend for Shopify App Bridge initialization

### Frontend (React + TypeScript + Shopify Polaris)

**Location**: [src/client/](src/client/) and [src/components/](src/components/)

#### Core Files:

1. **[src/client/App.tsx](src/client/App.tsx)** - Main Application
   - React Router setup with two main routes:
     - `/` - Dashboard (drops list)
     - `/drop/:dropId` - Drop analysis page
   - Shopify Polaris AppProvider wrapper
   - Shop parameter extraction from URL

2. **[src/components/Dashboard.tsx](src/components/Dashboard.tsx)** - Main Dashboard
   - Sortable table of all drops
   - Status badges (Scheduled, Active, Completed)
   - Edit/Delete operations
   - "New Drop" modal
   - Order Explorer section for creating drops from filtered data

3. **[src/components/DropAnalysis.tsx](src/components/DropAnalysis.tsx)** - Drop Detail Page
   - Drop information card
   - Edit drop functionality
   - Tabbed analytics interface:
     - Sales Summary Tab
     - Product Sales Summary Tab
     - By Color Tab
   - Inventory Management section (expandable)
   - Order Explorer with drop-specific filtering

4. **[src/components/DropModal.tsx](src/components/DropModal.tsx)** - Create/Edit Drop
   - Form for title, start/end times, collection selection
   - Collection picker with Shopify data
   - Validation and error handling
   - Auto-captures inventory on creation

5. **[src/components/OrdersListWithFilters.tsx](src/components/OrdersListWithFilters.tsx)** - Advanced Order Explorer
   - Date range filtering with presets (Today, Last 7 Days, etc.)
   - Product and collection filtering
   - Analytics summary cards
   - Quick drop creation from filtered results
   - Sortable data table

6. **[src/components/PerformanceScoreCard.tsx](src/components/PerformanceScoreCard.tsx)** - Performance Metrics
   - Displays product performance scores
   - Visual indicators for top performers
   - Integrated with product ranking system

7. **[src/components/orders/](src/components/orders/)** - Order Analysis Components
   - **FilterSection.tsx** - Advanced filtering UI (date range, product, collection)
   - **SummaryMetricsCard.tsx** - Summary metrics display with key stats
   - **TopSellersCard.tsx** - Highlighted top-selling products
   - **PerformingProductsCard.tsx** - Product performance rankings with scores
   - **SoldOutVariantsSection.tsx** - Sold-out variant tracking and display
   - **OrderDataCard.tsx** - Order data display component
   - **types.ts** - Shared TypeScript interfaces for order components
   - **index.ts** - Component exports

8. **[src/components/InventoryManagement/](src/components/InventoryManagement/)** - Inventory System
   - **InventoryManagement.tsx** - Main inventory UI with tabs
   - **InventoryTable.tsx** - Editable table with inline editing
   - **CSVImportModal.tsx** - CSV bulk import interface
   - **InventoryTypes.ts** - TypeScript interfaces
   - Features:
     - Manual quantity editing
     - CSV import (variant_id, quantity)
     - Take fresh snapshot
     - Reset to original
     - Metadata display (SKU, product, variant names)

9. **[src/utils/](src/utils/)** - Utility Functions
   - **productRanking.ts** - Product ranking algorithms
     - Multi-factor ranking (revenue, units, sell-through, frequency)
     - Configurable weights for different metrics
     - Identifies top performers
   - **dropScore.ts** - Performance scoring system
     - Calculates 0-100 scores for products
     - Considers sales velocity, consistency, profitability

### Database (SQLite + better-sqlite3 + Piscina Worker Threads)

**Location**: Two separate databases for different concerns

#### Database 1: sessions.db (Session & Order Data)

**Location**: [data/sessions.db](data/sessions.db) (auto-created)
**Purpose**: OAuth sessions, cached orders, product metadata

```sql
-- OAuth sessions with access tokens
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
CREATE INDEX idx_sessions_shop ON sessions(shop);

-- Cached order data (synced via webhooks and GraphQL)
CREATE TABLE orders (
  id INTEGER NOT NULL,
  shop TEXT NOT NULL,
  name TEXT,                         -- Order number (e.g., "#1001")
  email TEXT,
  created_at TEXT NOT NULL,
  total_price TEXT,
  subtotal_price TEXT,
  total_discounts TEXT,
  total_line_items_price TEXT,       -- Gross sales before discounts
  currency TEXT,
  financial_status TEXT,
  tags TEXT,
  customer_json TEXT,                -- JSON customer data
  refunds_json TEXT,                 -- JSON refunds data
  line_items_json TEXT NOT NULL,     -- JSON line items
  synced_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (shop, id)
);
CREATE INDEX idx_orders_shop ON orders(shop);
CREATE INDEX idx_orders_shop_created ON orders(shop, created_at);

-- Product metadata cache (images, types, vendors)
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
CREATE INDEX idx_product_cache_shop ON product_cache(shop);
CREATE INDEX idx_product_cache_lookup ON product_cache(shop, product_id);

-- Order sync progress tracking
CREATE TABLE order_sync_status (
  shop TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'idle',  -- 'idle', 'syncing', 'complete', 'error'
  total_orders INTEGER,
  synced_orders INTEGER DEFAULT 0,
  last_order_id TEXT,
  started_at TEXT,
  completed_at TEXT,
  error_message TEXT
);
```

#### Database 2: drops.db (Drop Analytics)

**Location**: [data/drops.db](data/drops.db) (auto-created)
**Purpose**: Drop configuration and cached metrics
**Accessed via**: Worker thread pool (Piscina) for non-blocking queries

```sql
CREATE TABLE drops (
  id TEXT PRIMARY KEY,
  shop TEXT NOT NULL,
  title TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  collection_id TEXT,
  collection_title TEXT,
  inventory_snapshot TEXT,           -- JSON: {variantId: quantity}
  snapshot_taken_at TEXT,
  inventory_source TEXT,             -- 'auto', 'manual', 'csv'
  original_inventory_snapshot TEXT,  -- Preserved for reset
  -- CACHED METRICS (calculated from orders table)
  net_sales REAL,                    -- Total revenue minus discounts and refunds
  order_count INTEGER,               -- Number of orders in drop period
  gross_sales REAL,                  -- Revenue before discounts/refunds
  discounts REAL,                    -- Total discount amount
  refunds REAL,                      -- Total refund amount
  metrics_cached_at TEXT,            -- When metrics were last calculated
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_drops_shop ON drops(shop);
CREATE INDEX idx_drops_start_time ON drops(start_time);
```

**Architecture Benefits:**
- **Separation of Concerns**: Sessions/orders separate from analytics
- **WAL Mode**: Write-Ahead Logging for concurrent reads during writes
- **Worker Threads**: Drops database accessed via Piscina pool (non-blocking)
- **Caching**: Drop metrics pre-calculated and stored
- **Automatic Updates**: Webhooks trigger metrics recalculation
- **GDPR Compliance**: Easy to delete all shop data from sessions.db
- **Performance**: No API calls needed for dashboard (all data cached locally)

---

## What's Implemented ✅

### Drop Management
- ✅ Create, Read, Update, Delete drops
- ✅ Time-based drop periods (start/end times)
- ✅ Collection-specific or store-wide tracking
- ✅ Automatic status calculation (Scheduled/Active/Completed)
- ✅ Edit drop details after creation
- ✅ **Server-side cached metrics** (net sales, order count, gross sales, discounts, refunds)
- ✅ **Automatic metrics updates** when webhooks arrive

### Real-Time Features
- ✅ **Shopify webhook integration** (orders/create, orders/updated)
- ✅ **HMAC webhook verification** for security
- ✅ **GraphQL Admin API** for order fetching
- ✅ **Background order sync** with progress tracking
- ✅ **Automatic cache invalidation** when orders change
- ✅ **GDPR compliance** (customer data request, redact, shop redact webhooks)

### Analytics & Reporting
- ✅ Sales Summary with total revenue, units sold, AOV
- ✅ **Server-side cached metrics** for instant loading
- ✅ Product-level breakdown with variant details
- ✅ **Intelligent product ranking** (multi-factor algorithms)
- ✅ **Performance scoring system** (0-100 scores for products)
- ✅ Color-based sales analysis with charts
- ✅ **Size-based sales analysis** (track which sizes sell best)
- ✅ Minute-by-minute sales visualization
- ✅ Sell-through rate calculations
- ✅ Top sellers identification with **dedicated cards**
- ✅ **Sold-out variant tracking** with visual indicators
- ✅ Vendor sales analysis
- ✅ Timeline charts (Polaris Viz)
- ✅ **Summary metrics cards** for filtered order sets

### Inventory Management
- ✅ Automatic inventory snapshot on drop creation
- ✅ Manual editing of inventory quantities
- ✅ CSV bulk import (variant_id, quantity)
- ✅ Take fresh snapshots at any time
- ✅ Reset to original snapshot
- ✅ Hybrid tracking (auto + manual/CSV)
- ✅ Metadata display (SKU, product/variant names)

### Order Exploration
- ✅ **Real-time order sync** via webhooks
- ✅ **Manual sync trigger** with progress indicator
- ✅ **Local database cache** for instant loading
- ✅ Advanced filtering by date range
- ✅ Filter by product and collection
- ✅ Date presets (Today, Last 7 Days, etc.)
- ✅ Quick drop creation from filters
- ✅ Order details view
- ✅ Analytics summary cards

### Data Visualization
- ✅ Shopify Polaris Viz charts
- ✅ Sales over time graphs
- ✅ Color distribution charts
- ✅ Product performance visuals
- ✅ **Performance score visualizations**
- ✅ **Top sellers cards**
- ✅ **Sold-out indicators**

### Performance & Architecture
- ✅ **Worker thread pool** (Piscina) for database operations
- ✅ **SQLite WAL mode** for concurrent reads/writes
- ✅ **Server-side caching** (drop metrics, product metadata)
- ✅ **Rate limiting** for Shopify API
- ✅ **GraphQL API** (faster than REST)
- ✅ **Background sync** (non-blocking)
- ✅ **Persistent session storage**
- ✅ **Two-database architecture** (sessions.db, drops.db)

### Developer Experience
- ✅ TypeScript throughout (type-safe)
- ✅ Hot reload for frontend (Vite)
- ✅ Auto-restart for backend (Nodemon)
- ✅ Concurrent dev mode (frontend + backend)
- ✅ Production build pipeline
- ✅ **Centralized configuration** (src/config/shopify.ts)
- ✅ **Environment variable validation**
- ✅ **.env.local support** for local development

---

## What's NOT Implemented

### Optional/Future Enhancements
- ❌ Multi-store support (currently single-store focused via SHOPIFY_STORE_URL)
- ❌ Export to CSV/Excel (data is viewable but not exportable)
- ❌ Automated tests (no test suite yet)
- ❌ Database backups (manual SQLite file backup required)
- ❌ User authentication beyond Shopify OAuth
- ❌ Custom reporting templates
- ❌ Email notifications
- ❌ Scheduled reports
- ❌ Inventory webhook sync (currently manual snapshot only)
- ❌ Product webhook sync (product changes not automatically reflected)

---

## Development Workflow

### Starting Development

**Prerequisites:**
1. ✅ Node.js installed (v18+)
2. ✅ npm installed
3. ✅ ngrok installed (for local development)
4. ✅ Shopify Partner account
5. ✅ Shopify test store

**Setup Steps:**

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment (`.env.local` file for development):
   ```env
   # Shopify App Configuration
   SHOPIFY_API_KEY=your_api_key
   SHOPIFY_API_SECRET=your_api_secret
   SHOPIFY_APP_URL=https://your-ngrok-url.ngrok-free.dev
   SHOPIFY_SCOPES=read_orders,read_products
   PORT=3000

   # Store Configuration (REQUIRED)
   SHOPIFY_STORE_URL=your-store.myshopify.com

   # Optional - for scripts
   SHOPIFY_ACCESS_TOKEN=shpat_xxxxx
   DISCOUNT_CODE=10%off
   ```

   **Note**: Use `.env.local` for local development (not tracked by git). Production uses `.env`.

3. Start ngrok:
   ```bash
   ngrok http 3000
   ```

4. Update `.env` with ngrok URL

5. Start development servers:
   ```bash
   npm run dev
   ```
   This runs:
   - Backend at `http://localhost:3000`
   - Frontend at `http://localhost:3001` (with hot reload)

6. Authenticate:
   Visit: `https://your-ngrok-url.ngrok-free.dev/api/shopify/auth?shop=your-store.myshopify.com`

**See [DEV_WORKFLOW.md](DEV_WORKFLOW.md) for detailed dev session management.**

### Making Changes

**Frontend Development:**
1. Edit files in `src/client/` or `src/components/`
2. Changes hot-reload automatically at `http://localhost:3001`
3. Use Shopify Polaris components for UI consistency

**Backend Development:**
1. Edit files in `src/server/`
2. Server auto-restarts on save (via Nodemon)
3. Test endpoints at `http://localhost:3000/api/...`

**Database Changes:**
1. Update schema in `src/server/database.ts`
2. Add migration logic in `initDatabase()` function
3. Restart server - migrations run automatically

### Testing

**Manual Testing:**
1. Use the order generator script:
   ```bash
   npx tsx scripts/ultimate-order-generator.ts 100
   ```
   This creates realistic test orders with drop patterns.

2. Create products:
   ```bash
   npx tsx scripts/create-products.js
   ```

3. Test features in browser at `http://localhost:3001`

**Production Testing:**
1. Build the app:
   ```bash
   npm run build
   ```

2. Run production server:
   ```bash
   npm start
   ```

3. Test at `http://localhost:3000`

---

## File Structure

```
drop-analyzer/
├── README.md                      # User-facing documentation
├── DEVELOPMENT.md                 # This file - developer guide
├── DEV_WORKFLOW.md               # Dev session workflow
│
├── src/
│   ├── client/                   # React Frontend
│   │   ├── App.tsx              # Main app with routing
│   │   ├── index.tsx            # React entry point
│   │   ├── index.html           # HTML template
│   │   └── styles.css           # Global styles
│   │
│   ├── components/              # React Components
│   │   ├── Dashboard.tsx        # Main dashboard
│   │   ├── DropAnalysis.tsx     # Drop detail page
│   │   ├── DropModal.tsx        # Create/edit modal
│   │   ├── OrdersList.tsx       # Basic orders list
│   │   ├── OrdersListWithFilters.tsx  # Advanced filtering
│   │   └── InventoryManagement/
│   │       ├── InventoryManagement.tsx
│   │       ├── InventoryTable.tsx
│   │       ├── CSVImportModal.tsx
│   │       └── InventoryTypes.ts
│   │
│   └── server/                  # Express Backend
│       ├── index.ts            # Server + routes
│       ├── shopify.ts          # OAuth & API
│       ├── database.ts         # SQLite setup
│       ├── drops.ts            # Drops CRUD
│       └── orders.ts           # Orders API
│
├── scripts/                     # Utility Scripts
│   ├── ultimate-order-generator.ts  # Generate test orders
│   ├── get-access-token.ts          # Get Shopify token
│   ├── create-products.js           # Create products
│   ├── README-ORDER-GENERATOR.md    # Generator docs
│   └── QUICK-START.md               # Quick guide
│
├── data/                        # Database
│   └── drops.db                # SQLite database (auto-created)
│
├── dist/                       # Built Files (generated)
│   ├── client/                # Built React app
│   └── server/                # Built Node server
│
├── public/                     # Static Assets
│
├── package.json               # Dependencies & scripts
├── tsconfig.json              # TypeScript (client)
├── tsconfig.server.json       # TypeScript (server)
├── vite.config.ts             # Vite config
└── .env                       # Environment vars (SECRET)
```

---

## API Documentation

### Shopify OAuth
- `GET /api/shopify/auth?shop=SHOP` - Initiate OAuth flow
- `GET /api/shopify/callback` - OAuth callback handler

### Configuration
- `GET /api/config` - Get client-safe configuration (API key, store URL)

### Drops CRUD (with Cached Metrics)
- `GET /api/drops?shop=SHOP` - List all drops **with cached metrics** (net_sales, order_count, etc.)
- `GET /api/drops/:dropId` - Get single drop with metrics
- `POST /api/drops` - Create drop (auto-captures inventory, calculates initial metrics)
- `PUT /api/drops/:dropId` - Update drop details
- `DELETE /api/drops/:dropId` - Delete drop

### Inventory Management
- `PUT /api/drops/:dropId/inventory` - Update inventory (manual/CSV)
- `POST /api/drops/:dropId/inventory/snapshot` - Capture fresh snapshot
- `POST /api/drops/:dropId/inventory/reset` - Reset to original

### Orders & Analytics (Cached Data)
- `GET /api/orders/recent?shop=SHOP` - Fetch **cached orders** from local database
  - Query params: `startDate`, `endDate`, `limit`, `offset`
- `POST /api/orders/sync?shop=SHOP` - Trigger manual GraphQL order sync
  - Body: `{ startDate?, endDate? }`
- `GET /api/orders/sync-status?shop=SHOP` - Get sync progress
  - Returns: `{ status, total_orders, synced_orders, started_at, completed_at }`
- `POST /api/orders/product-images` - Batch fetch product images **with caching**
  - Body: `{ shop, productIds: string[] }`
- `GET /api/orders/collections?shop=SHOP` - List all collections
- `GET /api/orders/inventory?shop=SHOP&variantIds=...` - Current inventory levels
- `GET /api/orders/variants?shop=SHOP&variantIds=...` - Variant metadata (SKU, names)

### Webhooks (HMAC Verified)
- `POST /api/webhooks/customers/data_request` - GDPR: Customer data request (logs request)
- `POST /api/webhooks/customers/redact` - GDPR: Customer data redaction (deletes orders)
- `POST /api/webhooks/shop/redact` - GDPR: Shop data redaction (deletes all shop data)
- `POST /api/webhooks/orders/create` - **Real-time order sync** (new order created)
  - Auto-updates drop metrics for affected drops
- `POST /api/webhooks/orders/updated` - **Real-time order sync** (order updated/cancelled)
  - Auto-updates drop metrics for affected drops

### Health Check
- `GET /api/health` - API and database health check
  - Returns: `{ status, checks: { database, config } }`

---

## Recent Development History

**Last 15 Commits (Most Recent First):**

1. `b63e844` - refactor: improve product ranking criteria and enhance empty state UX
2. `8120081` - refactor: extract TopSellersCard and improve sold-out variants UI
3. `8c07d89` - feat: add advanced performance metrics and improve summary UI layout
4. `e01e208` - **refactor: move drop metrics calculation to server-side with caching**
5. `6324279` - **feat: add sales metrics and order tracking to drops dashboard**
6. `b3cf1a5` - **feat: add intelligent product ranking system and size-based analysis**
7. `56de9bd` - refactor: add useOrderAnalysis hook and improve loading states
8. `752b8f7` - **refactor: extract order analysis cards and enhance component composition**
9. `476814e` - **feat: add shop authentication and authorization to all API endpoints**
10. `6b06dfe` - **feat: enable real-time webhook order sync and improve UI controls**
11. `06d837e` - **fix: add total_line_items_price field to orders with backfill migration**
12. `46e17fc` - **feat: migrate order sync to GraphQL API and configure production settings**
13. `db0a7d9` - **refactor: simplify client app and restructure server configuration**
14. `8152dc8` - **feat: add Shopify App Bridge and webhook handling for production**
15. `0d0d38e` - **refactor: centralize store configuration with environment variable**

**Key Milestones:**
- ✅ **Real-time webhook integration** (commits #10, #14)
- ✅ **GraphQL API migration** (commit #12)
- ✅ **Server-side caching** (commit #4)
- ✅ **Product ranking system** (commit #6)
- ✅ **Component refactoring** (commits #8, #7, #2, #1)
- ✅ **Shop authentication** (commit #9)

---

## Technology Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| **Frontend** | React | 18.3.1 |
| | TypeScript | 5.9.3 |
| | Vite | 7.3.0 |
| | Shopify Polaris | 13.9.5 |
| | Shopify Polaris Viz | 16.16.0 |
| | React Router | 7.11.0 |
| **Backend** | Express | 5.2.1 |
| | TypeScript | 5.9.3 |
| | better-sqlite3 | 12.6.2 |
| | Shopify API | 12.2.0 |
| | CORS | 2.8.5 |
| | dotenv | 17.2.3 |
| **Dev Tools** | Nodemon | 3.1.11 |
| | tsx | 4.21.0 |
| | Concurrently | 9.2.1 |

---

## Known Issues / TODOs

### High Priority
- [ ] Add automated tests (unit + integration)
- [ ] Implement database backup strategy
- [ ] Add error logging/monitoring for production

### Medium Priority
- [ ] Export functionality (CSV/Excel)
- [ ] Real-time updates via webhooks
- [ ] Multi-store support (if needed)

### Low Priority
- [ ] Custom report templates
- [ ] Email notifications
- [ ] Scheduled reports
- [ ] Mobile responsive improvements

---

## Production Deployment

### Build

```bash
npm run build
```

This creates:
- `dist/client/` - Optimized React bundle
- `dist/server/` - Compiled Node.js server

### Run

```bash
npm start
```

Server will:
1. Serve React app from `dist/client/`
2. Handle API requests
3. Use database at `data/drops.db`

### Hosting Recommendations

**Suitable Platforms:**
- Railway (persistent storage support)
- Render (free tier available)
- DigitalOcean App Platform
- Fly.io (persistent volumes)

**Requirements:**
- Node.js 18+ runtime
- Persistent storage for `data/drops.db`
- HTTPS support (required for Shopify apps)
- Environment variables configuration

**Deployment Checklist:**
1. ✅ Set environment variables on platform
2. ✅ Ensure persistent storage for database
3. ✅ Update `SHOPIFY_APP_URL` to production domain
4. ✅ Update Shopify Partner Dashboard with production URLs
5. ✅ Enable HTTPS/SSL
6. ✅ Test OAuth flow on production

---

## Support & Resources

**Documentation:**
- [README.md](README.md) - User setup guide
- [DEV_WORKFLOW.md](DEV_WORKFLOW.md) - Dev session workflow
- [scripts/README-ORDER-GENERATOR.md](scripts/README-ORDER-GENERATOR.md) - Order generator

**External Resources:**
- [Shopify App Development](https://shopify.dev/docs/apps)
- [Shopify Admin API](https://shopify.dev/docs/api/admin)
- [Shopify Polaris](https://polaris.shopify.com/)
- [React Documentation](https://react.dev)
- [TypeScript Docs](https://www.typescriptlang.org/docs)

---

## Contributing

When adding features:

1. **Plan**: Document requirements and approach
2. **Implement**: Write type-safe code (TypeScript)
3. **Test**: Manual testing with realistic data
4. **Document**: Update relevant .md files
5. **Commit**: Use conventional commits (feat/fix/docs/etc.)

**Code Style:**
- Use TypeScript throughout
- Follow existing patterns
- Use Shopify Polaris components
- Handle errors gracefully
- Add loading states for async operations

---

## Summary

**Current State**: Production-ready Shopify app with comprehensive drop analytics

**Key Strengths:**
- Full-featured drop management
- Advanced inventory tracking
- Rich analytics and visualization
- Type-safe development
- Good developer experience

**Next Steps**: Focus on testing, monitoring, and production deployment

---

**Built for analyzing street fashion product drops with precision and style.**
