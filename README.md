# Sales Analyzer - Shopify App

A Shopify app for analyzing sales data with minute-by-minute precision.

## Features

- View last 10 sales/orders
- Real-time sales data analysis
- Built with React, TypeScript, and Shopify Polaris

## Setup Instructions

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

### 3. Set up ngrok (for local development)

```bash
# Install ngrok if you haven't
# Then run:
ngrok http 3000
```

Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)

### 4. Configure Environment Variables

Edit the [.env](.env) file and fill in your values:

```env
SHOPIFY_API_KEY=your_api_key_from_partner_dashboard
SHOPIFY_API_SECRET=your_api_secret_from_partner_dashboard
SHOPIFY_APP_URL=https://your-ngrok-url.ngrok.io
SHOPIFY_SCOPES=read_orders,read_products
PORT=3000
```

Also update [shopify.app.toml](shopify.app.toml) with your ngrok URL and API key.

### 5. Update App URLs in Shopify Partner Dashboard

In your app settings, set:
- **App URL**: `https://your-ngrok-url.ngrok.io`
- **Allowed redirection URL(s)**: `https://your-ngrok-url.ngrok.io/api/shopify/callback`

### 6. Run the App

```bash
# Development mode (runs both frontend and backend)
npm run dev

# Or run them separately:
npm run dev:server  # Backend API on port 3000
npm run dev:client  # Frontend dev server on port 3001
```

### 7. Install the App

1. Visit: `https://your-ngrok-url.ngrok.io/api/shopify/auth?shop=your-store.myshopify.com`
2. Follow the OAuth flow to install the app
3. You'll be redirected to the app page showing your last 10 sales

## Available Scripts

- `npm run dev` - Run both frontend and backend in development mode
- `npm run dev:server` - Run only the backend server
- `npm run dev:client` - Run only the frontend dev server
- `npm run build` - Build both frontend and backend for production
- `npm start` - Run the production server

## Project Structure

```
sales-analyzer/
├── src/
│   ├── server/           # Express backend
│   │   ├── index.ts      # Main server file
│   │   ├── shopify.ts    # Shopify OAuth & API config
│   │   └── orders.ts     # Orders API endpoints
│   ├── client/           # React frontend
│   │   ├── index.tsx     # React entry point
│   │   └── App.tsx       # Main App component
│   └── components/       # React components
│       └── OrdersList.tsx # Orders display component
├── public/               # Static files
├── dist/                 # Built files (generated)
├── .env                  # Environment variables
├── package.json
├── tsconfig.json
├── tsconfig.server.json
└── vite.config.ts
```

## Next Steps

This is a starting point. You can extend this app to:
- Filter orders by specific time ranges
- Show minute-by-minute sales breakdown
- Add charts and visualizations using Polaris Viz
- Export sales data to CSV
- Create custom reports

## Troubleshooting

- **Authentication errors**: Make sure your API credentials are correct in .env
- **CORS errors**: Ensure your ngrok URL is correctly set in all configuration files
- **Orders not showing**: Verify that your test store has orders and that the app has the `read_orders` scope
