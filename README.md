# Drop Analyzer - Shopify App

A comprehensive Shopify app for analyzing product drops with detailed sales tracking, inventory management, and advanced analytics.

## Features

### Drop Management
- **Create & Track Drops** - Define time-based sales periods for product drops
- **Collection Support** - Associate drops with specific Shopify collections or track all products
- **Drop Status Tracking** - Automatic status badges (Scheduled, Active, Completed)
- **Edit & Delete** - Full CRUD operations for managing your drops

### Analytics & Reporting
- **Sales Summary** - View total revenue, units sold, and average order value
- **Product Performance** - Detailed breakdown by product and variant
- **Color-Based Analysis** - Track sales by product color with visual charts
- **Time-Based Trends** - Minute-by-minute sales data visualization
- **Sell-Through Rates** - Calculate sell-through percentages with inventory tracking

### Inventory Management
- **Automatic Snapshots** - Capture inventory at drop creation time
- **Manual Editing** - Adjust inventory quantities manually for accurate calculations
- **CSV Import** - Bulk import inventory data from CSV files
- **Hybrid Tracking** - Combine auto-captured data with manual overrides

### Order Exploration
- **Advanced Filtering** - Filter orders by date range, product, and collection
- **Quick Drop Creation** - Create drops directly from filtered order views
- **Real-time Data** - Live order data from your Shopify store

### Built With
- React + TypeScript
- Shopify Polaris UI components
- Shopify Polaris Viz for charts
- Express backend
- SQLite database (better-sqlite3)
- Shopify Admin API

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

Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)

### 4. Configure Environment Variables

Create or edit the `.env` file in the project root:

```env
SHOPIFY_API_KEY=your_api_key_from_partner_dashboard
SHOPIFY_API_SECRET=your_api_secret_from_partner_dashboard
SHOPIFY_APP_URL=https://your-ngrok-url.ngrok.io
SHOPIFY_SCOPES=read_orders,read_products,read_inventory
SHOPIFY_ACCESS_TOKEN=shpat_xxxxx  # Optional - for testing scripts
PORT=3000

# Optional - For order generator script
DISCOUNT_CODE=10%off
```

### 5. Update App URLs in Shopify Partner Dashboard

In your app settings, configure:
- **App URL**: `https://your-ngrok-url.ngrok.io`
- **Allowed redirection URL(s)**: `https://your-ngrok-url.ngrok.io/api/shopify/callback`

### 6. Run the App

```bash
# Development mode (runs both frontend and backend concurrently)
npm run dev

# Or run them separately:
npm run dev:server  # Backend API on port 3000
npm run dev:client  # Frontend dev server on port 3001
```

### 7. Install the App on Your Store

1. Visit: `https://your-ngrok-url.ngrok.io/api/shopify/auth?shop=your-store.myshopify.com`
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
│   ├── server/                    # Express backend
│   │   ├── index.ts               # Main server entry point
│   │   ├── shopify.ts             # Shopify OAuth & API configuration
│   │   ├── orders.ts              # Orders API endpoints
│   │   ├── drops.ts               # Drops CRUD API endpoints
│   │   └── database.ts            # SQLite database setup & migrations
│   ├── client/                    # React frontend
│   │   ├── index.tsx              # React entry point
│   │   ├── App.tsx                # Main App component with routing
│   │   └── styles.css             # Global styles
│   └── components/                # React UI components
│       ├── Dashboard.tsx          # Main dashboard with drops list
│       ├── DropAnalysis.tsx       # Individual drop analysis page
│       ├── DropModal.tsx          # Create/edit drop modal
│       ├── OrdersList.tsx         # Basic orders list
│       ├── OrdersListWithFilters.tsx  # Advanced order filtering
│       └── InventoryManagement/
│           ├── InventoryManagement.tsx  # Inventory tracking UI
│           ├── InventoryTable.tsx       # Editable inventory table
│           ├── CSVImportModal.tsx       # CSV import functionality
│           └── InventoryTypes.ts        # TypeScript interfaces
├── scripts/                       # Utility scripts
│   ├── ultimate-order-generator.ts     # Generate realistic test orders
│   ├── get-access-token.ts             # Get Shopify access token
│   ├── create-products.js              # Create sample products
│   ├── README-ORDER-GENERATOR.md       # Order generator documentation
│   └── QUICK-START.md                  # Quick start guide
├── data/                          # Database storage
│   └── drops.db                   # SQLite database (auto-created)
├── public/                        # Static assets
│   └── index.html                 # HTML template
├── dist/                          # Built files (generated)
│   ├── client/                    # Built React app
│   └── server/                    # Built Node.js server
├── .env                           # Environment variables (create this)
├── package.json                   # Dependencies and scripts
├── tsconfig.json                  # TypeScript config for client
├── tsconfig.server.json           # TypeScript config for server
└── vite.config.ts                 # Vite bundler configuration
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
4. Try re-authenticating: Visit `https://your-ngrok-url.ngrok.io/api/shopify/auth?shop=your-store.myshopify.com`

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
1. The database is stored in `data/drops.db`
2. Restart the server - migrations run automatically
3. If corrupted, delete `data/drops.db` (you'll lose drop data)
4. The server will recreate the database on next start

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

## Technology Stack

### Frontend
- **React 18** - UI library
- **TypeScript** - Type-safe JavaScript
- **Shopify Polaris** - Official Shopify design system
- **Shopify Polaris Viz** - Data visualization components
- **React Router DOM** - Client-side routing
- **Vite** - Fast build tool and dev server

### Backend
- **Express 5** - Web server framework
- **TypeScript** - Type-safe server code
- **better-sqlite3** - Fast, synchronous SQLite database
- **@shopify/shopify-api** - Official Shopify API library
- **CORS** - Cross-origin resource sharing
- **dotenv** - Environment variable management

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
3. Use the SQLite database from `data/drops.db`

### Deployment Considerations

1. **Environment Variables**: Set all required environment variables on your hosting platform
2. **Database**: The SQLite database file (`data/drops.db`) needs persistent storage
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

### Drops
- `GET /api/drops?shop=SHOP_NAME` - List all drops for a shop
- `GET /api/drops/:dropId` - Get a specific drop
- `POST /api/drops` - Create a new drop
- `PATCH /api/drops/:dropId` - Update a drop
- `DELETE /api/drops/:dropId` - Delete a drop

### Orders
- `GET /api/orders?shop=SHOP_NAME` - Fetch orders with optional filters
- `GET /api/orders/drop/:dropId` - Get orders for a specific drop

### Health Check
- `GET /api/health` - Check if the API is running

## Database Schema

The app uses SQLite with the following schema:

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
