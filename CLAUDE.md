# Drop Analyzer - Architecture Guide for Claude

This document provides a comprehensive overview of the Drop Analyzer architecture to enable fast onboarding and efficient development assistance.

## Quick Overview

**Purpose**: A Shopify embedded app that tracks and analyzes product drops (time-based sales periods) with real-time metrics, inventory management, and advanced analytics.

**Target Use Case**: Street fashion brands analyzing limited product releases ("drops") to understand sales performance, sell-through rates, and customer behavior.

## Tech Stack Summary

### Frontend
- **React 18** with **TypeScript** - Type-safe UI
- **Shopify Polaris 13.9** - Official Shopify design system
- **Shopify Polaris Viz 16.16** - Data visualization (charts/graphs)
- **React Router DOM 7** - Client-side routing
- **Vite 7** - Build tool and dev server

### Backend
- **Express 5** with **TypeScript** - Web server
- **@shopify/shopify-api 12.2** - Official Shopify GraphQL API client
- **better-sqlite3** - Fast, synchronous SQLite database
- **Piscina** - Worker thread pool for non-blocking database operations
- **p-queue** - Rate limiting for Shopify API calls

### Performance & Real-Time Features
- **Shopify Webhooks** - HMAC-verified automatic order syncing
- **GraphQL Admin API** - Efficient bulk data fetching
- **Server-Side Caching** - Pre-calculated metrics stored in database
- **Worker Threads** - Background database operations
- **WAL Mode SQLite** - Better concurrency for reads/writes

---

## Architecture Overview

### High-Level Flow

```
User → React SPA → Express API → Shopify GraphQL API
                      ↓                    ↓
                SQLite Databases    Webhook Events
                (sessions.db, drops.db)
```

### Key Architectural Patterns

1. **Embedded Shopify App** - Runs inside Shopify admin using OAuth
2. **Server-Side Rendering** - Express serves built React app from `dist/client`
3. **API-First Design** - All data operations go through REST API endpoints
4. **Event-Driven Updates** - Webhooks trigger automatic data syncing and cache invalidation
5. **Worker Thread Pattern** - Database operations run in background threads (Piscina)
6. **Local-First Data** - Orders cached in SQLite, reducing Shopify API calls

---

## Data Flow

### 1. Authentication Flow
```
User → /api/shopify/auth → Shopify OAuth → /api/shopify/callback → Dashboard (with shop param)
                                                ↓
                                        Access token stored in sessions.db
```

### 2. Drop Creation Flow
```
User Creates Drop → POST /api/drops → Fetch inventory via GraphQL → Save drop + inventory snapshot
                                            ↓
                                    Calculate initial metrics → Cache in drops.db
```

### 3. Real-Time Order Sync Flow
```
New Order in Shopify → Webhook: orders/create → HMAC Verification → Save to orders table
                                                        ↓
                                            Invalidate affected drop metrics cache
                                                        ↓
                                            Recalculate metrics in background worker
```

### 4. Analytics Retrieval Flow
```
User Views Drop → GET /api/drops/:dropId → Check cached metrics → Return pre-calculated data
                                                ↓
                                        If cache expired: recalculate
```

---

## Project Structure with Purpose

```
src/
├── server/                                # Express backend (Node.js)
│   ├── index.ts                          # Main server entry point, route registration
│   ├── shopify.ts                        # OAuth flow, session management, API client setup
│   ├── orders.ts                         # Order API endpoints (sync, fetch, collections, inventory)
│   ├── drops.ts                          # Drop CRUD endpoints with metrics caching
│   ├── webhooks.ts                       # Webhook handlers (GDPR, orders/create, orders/updated)
│   ├── webhookVerification.ts            # HMAC verification for webhook authenticity
│   ├── sessionStorage.ts                 # SQLite database for sessions, orders, product cache
│   ├── database.ts                       # Piscina worker pool manager
│   ├── databaseAsync.ts                  # Async wrapper for database operations
│   ├── databaseWorker.ts                 # Worker thread entry point for DB operations
│   ├── orderSyncService.ts               # GraphQL-based order sync from Shopify
│   ├── dropMetricsService.ts             # Drop metrics calculation and caching logic
│   ├── shopifyRateLimiter.ts             # p-queue rate limiter for API calls
│   └── routes/
│       └── config.ts                     # Client-safe config endpoint (API key, store URL)
│
├── client/                               # React frontend
│   ├── index.tsx                         # React entry point, renders App component
│   ├── App.tsx                           # Main app with routing, shop param handling
│   ├── services/
│   │   └── config.ts                     # Fetch client config from backend
│   └── styles.css                        # Global styles
│
├── components/                           # React UI components
│   ├── Dashboard.tsx                     # Main dashboard: drops list, order explorer
│   ├── DropAnalysis.tsx                  # Individual drop detail page with tabs
│   ├── DropModal.tsx                     # Create/edit drop modal form
│   ├── PerformanceScoreCard.tsx          # Performance metrics display card
│   ├── OrdersListWithFilters.tsx         # Advanced order filtering and search
│   ├── InventoryManagement/              # Inventory management components
│   │   ├── InventoryManagement.tsx       # Main inventory UI with tabs
│   │   ├── InventoryTable.tsx            # Editable inventory table
│   │   ├── CSVImportModal.tsx            # CSV import functionality
│   │   └── InventoryTypes.ts             # TypeScript interfaces for inventory
│   └── orders/                           # Order analysis components
│       ├── FilterSection.tsx             # Filter UI (date, product, collection)
│       ├── SummaryMetricsCard.tsx        # Summary metrics (revenue, orders, AOV)
│       ├── TopSellersCard.tsx            # Top selling products visual cards
│       ├── PerformingProductsCard.tsx    # Product performance ranking table
│       ├── SoldOutVariantsSection.tsx    # Sold-out variants tracking
│       ├── OrderDataCard.tsx             # Order list display
│       └── types.ts                      # TypeScript interfaces for order components
│
├── config/
│   └── shopify.ts                        # Centralized Shopify configuration (API key, scopes, URLs)
│
├── utils/                                # Shared utilities
│   ├── productRanking.ts                 # Product ranking algorithms (multi-factor scoring)
│   ├── dropScore.ts                      # Performance scoring system (0-100 scale)
│   └── formatting.ts                     # Number/currency formatting helpers
│
├── types/                                # TypeScript type definitions
│   ├── index.ts                          # Barrel export for all types
│   ├── order.ts                          # Order, OrderLineItem, OrderCustomer, etc.
│   ├── product.ts                        # ProductSummary, ColorSummary, etc.
│   ├── metrics.ts                        # SalesMetrics, CustomerMetrics, etc.
│   ├── sync.ts                           # SyncStatus types
│   └── analysis.ts                       # OrderAnalysisData types
│
├── constants/                            # Shared constants
│   ├── index.ts                          # Barrel export for all constants
│   ├── scoring.ts                        # Performance scoring thresholds
│   ├── ranking.ts                        # Product ranking weights
│   └── timeouts.ts                       # API timeout values
│
└── hooks/
    └── useOrderAnalysis.ts               # Custom React hook for order analysis logic

scripts/                                  # Utility scripts
├── ultimate-order-generator.ts           # Generate realistic test orders
├── get-access-token.ts                   # Get Shopify access token for scripts
└── create-products.js                    # Create sample products in store

data/                                     # SQLite database files (auto-created)
├── sessions.db                           # Sessions, orders, product cache, sync status
└── drops.db                              # Drops, inventory snapshots, cached metrics
```

---

## Database Schema

### sessions.db (Order Data & Cache)

**sessions** - OAuth session storage
- `id`, `shop`, `access_token`, `scope`, `expires_at`, `created_at`, `updated_at`

**orders** - Cached order data (synced via webhooks)
- `id`, `shop`, `name`, `email`, `created_at`, `total_price`, `financial_status`
- `line_items_json` - Serialized line items with variant info
- `refunds_json` - Serialized refund data
- Primary key: `(shop, id)` - Composite key per shop

**product_cache** - Product metadata cache
- `shop`, `product_id`, `image_url`, `product_type`, `vendor`, `category`, `cached_at`
- Reduces repeated GraphQL calls for product info

**order_sync_status** - Order sync progress tracking
- `shop`, `status`, `total_orders`, `synced_orders`, `last_order_id`, `started_at`, `completed_at`

### drops.db (Analytics & Drops)

**drops** - Drop configuration and cached metrics
- **Config**: `id`, `shop`, `title`, `start_time`, `end_time`, `collection_id`, `collection_title`
- **Inventory**: `inventory_snapshot`, `snapshot_taken_at`, `inventory_source`, `original_inventory_snapshot`
- **Cached Metrics**: `net_sales`, `order_count`, `gross_sales`, `discounts`, `refunds`, `metrics_cached_at`
- **Timestamps**: `created_at`, `updated_at`

---

## API Endpoints Reference

### Shopify OAuth
- `GET /api/shopify/auth?shop=SHOP_NAME` - Initiate OAuth flow
- `GET /api/shopify/callback` - OAuth callback handler

### Configuration
- `GET /api/config` - Get client-safe config (API key, store URL)

### Drops
- `GET /api/drops?shop=SHOP_NAME` - List all drops with cached metrics
- `GET /api/drops/:dropId` - Get specific drop details
- `POST /api/drops` - Create drop (auto-captures inventory, calculates metrics)
- `PUT /api/drops/:dropId` - Update drop details
- `DELETE /api/drops/:dropId` - Delete drop
- `PUT /api/drops/:dropId/inventory` - Update inventory snapshot
- `POST /api/drops/:dropId/inventory/snapshot` - Capture fresh inventory
- `POST /api/drops/:dropId/inventory/reset` - Reset to original snapshot

### Orders
- `GET /api/orders/recent?shop=SHOP_NAME` - Fetch cached orders with pagination
- `POST /api/orders/sync?shop=SHOP_NAME` - Trigger manual order sync
- `GET /api/orders/sync-status?shop=SHOP_NAME` - Get sync status
- `POST /api/orders/product-images` - Batch fetch product images/metadata
- `GET /api/orders/collections?shop=SHOP_NAME` - List collections
- `GET /api/orders/inventory?shop=SHOP_NAME&variantIds=...` - Get current inventory levels
- `GET /api/orders/variants?shop=SHOP_NAME&variantIds=...` - Get variant metadata

### Webhooks (HMAC Verified)
- `POST /api/webhooks/customers/data_request` - GDPR data request
- `POST /api/webhooks/customers/redact` - GDPR customer redaction
- `POST /api/webhooks/shop/redact` - GDPR shop redaction
- `POST /api/webhooks/orders/create` - Real-time order creation
- `POST /api/webhooks/orders/updated` - Real-time order updates

### Health
- `GET /api/health` - Health check with database connectivity test

---

## Key Concepts & Features

### 1. Server-Side Metrics Caching

**Problem**: Calculating drop metrics (revenue, sell-through, top products) on every request is slow and hits API limits.

**Solution**: Pre-calculate metrics and store in `drops.db`:
- Metrics calculated on drop creation
- Automatically recalculated when webhooks arrive
- Cached data served instantly on dashboard load

**Files**: `src/server/dropMetricsService.ts`, `src/server/drops.ts`

### 2. Real-Time Webhook Sync

**Flow**:
1. Order created in Shopify → Webhook sent to app
2. HMAC verification ensures authenticity (`webhookVerification.ts`)
3. Order saved to `orders` table (`webhooks.ts`)
4. Affected drop metrics invalidated and recalculated in background

**Benefits**: Dashboard always shows latest data without manual refresh

**Files**: `src/server/webhooks.ts`, `src/server/webhookVerification.ts`

### 3. Product Ranking Algorithm

Multi-factor ranking considers:
- **Revenue** (40% weight) - Total sales value
- **Units Sold** (30% weight) - Quantity sold
- **Sell-Through Rate** (20% weight) - % of inventory sold
- **Order Frequency** (10% weight) - How many unique orders

**Score**: 0-100 scale with performance grades (A+, A, B, C, D, F)

**Files**: `src/utils/productRanking.ts`, `src/utils/dropScore.ts`

### 4. Inventory Management

**Automatic Snapshot**: When drop is created, current inventory is captured via GraphQL
**Manual Editing**: User can adjust quantities for accuracy
**CSV Import**: Bulk import from spreadsheet
**Reset Feature**: Restore original auto-captured snapshot

**Why**: Accurate starting inventory enables precise sell-through calculations

**Files**: `src/components/InventoryManagement/`

### 5. Worker Thread Pattern

**Why**: SQLite operations block the event loop, slowing down the server

**Solution**:
- Database operations run in worker threads via Piscina
- Main thread stays responsive
- Multiple operations can run concurrently

**Files**:
- `src/server/database.ts` - Pool manager
- `src/server/databaseWorker.ts` - Worker entry point
- `src/server/databaseAsync.ts` - Async wrapper

### 6. GraphQL Order Sync

**Why**: REST API is slow for bulk data fetching

**Solution**:
- Use GraphQL Admin API for efficient queries
- Fetch orders in batches with cursor pagination
- Rate limiting via `p-queue` to avoid hitting limits
- Save to local `orders` table for instant access

**Files**: `src/server/orderSyncService.ts`, `src/server/shopifyRateLimiter.ts`

---

## Common Development Tasks

### Adding a New API Endpoint

1. **Add route** in appropriate file (`src/server/orders.ts`, `src/server/drops.ts`, etc.)
2. **Register route** in `src/server/index.ts`
3. **Add TypeScript types** in `src/types/`
4. **Update frontend** to call new endpoint

### Adding a New UI Component

1. **Create component** in `src/components/`
2. **Import in parent** component or route
3. **Add types** to `src/types/` or `src/components/*/types.ts`
4. **Use Polaris components** for consistency

### Modifying Drop Metrics Calculation

1. **Edit** `src/server/dropMetricsService.ts`
2. **Update database schema** if adding new metrics fields
3. **Invalidate cache** by triggering recalculation
4. **Test** with real drop data

### Adding a New Webhook Handler

1. **Add handler** in `src/server/webhooks.ts`
2. **Ensure HMAC verification** is applied
3. **Register route** in webhooks router
4. **Configure webhook** in Shopify Partner Dashboard

### Debugging Database Issues

- **Check database files**: `data/sessions.db`, `data/drops.db`
- **View schema**: Use SQLite viewer or `sqlite3 data/sessions.db .schema`
- **Check migrations**: Migrations run automatically on server start
- **Worker thread errors**: Check server logs for Piscina errors

---

## Coding Patterns & Conventions

### TypeScript Usage
- **All files use TypeScript** - No plain JavaScript
- **Types defined in** `src/types/` with barrel exports
- **Interface naming**: PascalCase (e.g., `Order`, `ProductSummary`)
- **API responses**: Type all fetch responses

### React Patterns
- **Functional components** with hooks (no class components)
- **Polaris components** for all UI elements
- **State management**: `useState` and `useEffect` (no Redux)
- **Routing**: React Router DOM 7

### API Design
- **RESTful conventions** - GET, POST, PUT, DELETE
- **Query params** - Use `?shop=SHOP_NAME` for multi-tenant
- **JSON responses** - All endpoints return JSON
- **Error handling** - Return appropriate HTTP status codes

### Database Patterns
- **Prepared statements** - Use `db.prepare()` for all queries
- **Worker threads** - Use `runDatabaseTask()` for operations
- **Transactions** - Use transactions for multi-statement operations
- **Indexes** - Critical columns are indexed

### File Naming
- **React components**: PascalCase (`Dashboard.tsx`, `DropModal.tsx`)
- **Utilities/services**: camelCase (`shopifyRateLimiter.ts`, `orderSyncService.ts`)
- **Types files**: lowercase (`order.ts`, `product.ts`)

---

## Performance Optimizations

1. **Server-Side Caching** - Drop metrics pre-calculated and stored
2. **Worker Threads** - Non-blocking database operations
3. **WAL Mode SQLite** - Better read concurrency
4. **Product Cache** - Images/metadata cached to avoid repeated API calls
5. **Rate Limiting** - p-queue prevents hitting Shopify API limits
6. **GraphQL Bulk Fetching** - Efficient data retrieval
7. **Webhook-Driven Updates** - Only recalculate when data changes

---

## Environment Variables

Required in `.env.local`:

```env
# Shopify App Configuration
SHOPIFY_API_KEY=your_api_key
SHOPIFY_API_SECRET=your_api_secret
SHOPIFY_APP_URL=https://your-ngrok-url.ngrok-free.dev
SHOPIFY_SCOPES=read_orders,read_products
PORT=3000

# Store Configuration (REQUIRED)
SHOPIFY_STORE_URL=your-store.myshopify.com

# Optional - For scripts
SHOPIFY_ACCESS_TOKEN=shpat_xxxxx
DISCOUNT_CODE=10%off
```

---

## Development Workflow

### Starting Development Server
```bash
npm run dev              # Run both frontend and backend
npm run dev:server       # Backend only (port 3000)
npm run dev:client       # Frontend only (port 3001, proxies to 3000)
```

### Building for Production
```bash
npm run build            # Build both client and server
npm run build:client     # Build React app only
npm run build:server     # Compile TypeScript server only
npm start                # Run production server
```

### Testing with Sample Data
```bash
npx tsx scripts/ultimate-order-generator.ts 100    # Generate 100 test orders
npx tsx scripts/create-products.js                 # Create sample products
```

---

## Common Gotchas & Tips

### 1. Shop Parameter Required
- All API calls need `?shop=SHOP_NAME` for multi-tenant support
- Frontend gets shop from URL params on initial load

### 2. Webhook Verification
- Webhooks must verify HMAC signature before processing
- Use raw body for verification (configured in `index.ts`)

### 3. Database Locking
- SQLite can lock if too many concurrent writes
- Worker threads help but use transactions carefully
- WAL mode helps with read concurrency

### 4. Metric Cache Invalidation
- When orders are added/updated, affected drop metrics must recalculate
- This happens automatically via webhook handlers

### 5. Rate Limiting
- Shopify API has strict rate limits
- Always use `shopifyRateLimiter.ts` for API calls
- GraphQL has different limits than REST

### 6. OAuth Sessions
- Sessions expire and need re-authentication
- Frontend shows re-auth link when detected

### 7. Inventory Sync Timing
- Inventory snapshot taken at drop creation time
- If inventory changes before drop starts, manual adjustment may be needed

---

## Future Enhancement Ideas

Based on current architecture, easy additions:
- **Email notifications** - On drop completion or low inventory
- **Export to CSV** - Drop analytics export
- **Multi-collection drops** - Track multiple collections in one drop
- **Scheduled drops** - Auto-start/end drops
- **Customer segmentation** - Analyze by customer type
- **Refund tracking** - Separate refund analytics
- **Discount analysis** - Track discount code usage
- **Real-time dashboard** - WebSocket-based live updates

---

## Quick Reference: Most Changed Files

When making typical changes, you'll most often edit:

1. **UI Changes**: `src/components/Dashboard.tsx`, `src/components/DropAnalysis.tsx`
2. **API Changes**: `src/server/drops.ts`, `src/server/orders.ts`
3. **Metrics Logic**: `src/server/dropMetricsService.ts`
4. **Order Sync**: `src/server/orderSyncService.ts`
5. **Types**: `src/types/order.ts`, `src/types/product.ts`
6. **Styling**: `src/client/styles.css`

---

## Summary: What Makes This App Unique

1. **Event-Driven Architecture** - Webhooks keep data fresh automatically
2. **Aggressive Caching** - Metrics pre-calculated for instant dashboard loads
3. **Worker Thread Performance** - Non-blocking database operations
4. **GraphQL-First** - Efficient bulk data fetching
5. **Local-First Data** - SQLite cache reduces API dependency
6. **Advanced Analytics** - Multi-factor product ranking and scoring
7. **Real-Time Ready** - Built for live order tracking during drops

---

**Last Updated**: 2026-02-11

**For Questions**: Reference this doc first, then check README.md for user-facing documentation.
