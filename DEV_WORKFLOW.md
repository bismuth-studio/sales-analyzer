# Development Workflow Guide

Quick reference for starting and stopping development sessions for the Drop Analyzer Shopify app.

## Configuration

Before starting, configure your environment in `.env.local` (for local dev):

```bash
# Shopify App Configuration
SHOPIFY_API_KEY=your_api_key_here
SHOPIFY_API_SECRET=your_api_secret_here
SHOPIFY_APP_URL=https://your-ngrok-url.ngrok-free.dev
SHOPIFY_SCOPES=read_orders,read_products
PORT=3000

# Store Configuration (REQUIRED)
SHOPIFY_STORE_URL=your-store.myshopify.com

# Optional - for scripts
SHOPIFY_ACCESS_TOKEN=shpat_xxxxx
DISCOUNT_CODE=10%off
```

**Important Notes:**
- Use `.env.local` for development (not tracked by git)
- `SHOPIFY_STORE_URL` is **required** for the app to work
- Update `SHOPIFY_APP_URL` every time your ngrok URL changes

## Starting a Dev Session

### 1. Start the development server
```bash
npm run dev
```
This starts both:
- Express server on `http://localhost:3000`
- Vite dev server on `http://localhost:3001`

### 2. Start ngrok tunnel
```bash
ngrok http 3000
```

### 3. Get your ngrok URL
Check the ngrok output for your public URL (e.g., `https://your-subdomain.ngrok-free.dev`)

Or use the API:
```bash
curl -s http://127.0.0.1:4040/api/tunnels | grep -o '"public_url":"https://[^"]*"'
```

### 4. Update .env (if ngrok URL changed)
If you got a new ngrok URL, update this line in `.env`:
```
SHOPIFY_APP_URL=https://your-new-subdomain.ngrok-free.dev
```

Then restart the dev server (Ctrl+C and `npm run dev` again)

### 5. Reinstall/authenticate the app
Visit this URL in your browser (replace with your ngrok URL):
```
https://your-subdomain.ngrok-free.dev/api/shopify/auth?shop=YOUR_STORE.myshopify.com
```

This will:
- Start OAuth flow
- Redirect to Shopify for approval
- Redirect back to your app
- Create an active session

### 6. Access your app
After authentication, you can access the app either:
- Directly: `https://your-subdomain.ngrok-free.dev`
- Through Shopify Admin: Apps > Sales Analyzer

## Ending a Dev Session

### 1. Stop the dev server
Press `Ctrl+C` in the terminal running `npm run dev`

### 2. Stop ngrok
Press `Ctrl+C` in the terminal running ngrok

OR if running in background:
```bash
pkill ngrok
```

## Quick Start (if ngrok URL hasn't changed)

If your ngrok tunnel URL is the same as last time:

1. `npm run dev`
2. `ngrok http 3000` (in another terminal)
3. Visit `https://your-subdomain.ngrok-free.dev/api/shopify/auth?shop=YOUR_STORE.myshopify.com`

Done! Your app should work immediately.

## Troubleshooting

### "Error loading orders" or "Not authenticated"
Run the auth URL again:
```
https://your-subdomain.ngrok-free.dev/api/shopify/auth?shop=YOUR_STORE.myshopify.com
```

### ngrok says "endpoint already online"
You already have ngrok running. Find the existing URL:
```bash
curl -s http://127.0.0.1:4040/api/tunnels | grep public_url
```

Or check alternate port:
```bash
curl -s http://127.0.0.1:4041/api/tunnels | grep public_url
```

### Can't access through Shopify Admin
Make sure:
1. Your ngrok URL matches the one in `.env`
2. You've run the auth URL to create a session
3. The dev server is still running

## Testing Webhooks in Development

### 1. Configure Webhooks in Shopify Partner Dashboard

Go to your app settings and add these webhook subscriptions:

**GDPR Webhooks (Mandatory)**:
- `customers/data_request` → `https://your-ngrok-url.ngrok-free.dev/api/webhooks/customers/data_request`
- `customers/redact` → `https://your-ngrok-url.ngrok-free.dev/api/webhooks/customers/redact`
- `shop/redact` → `https://your-ngrok-url.ngrok-free.dev/api/webhooks/shop/redact`

**Order Webhooks (Real-time sync)**:
- `orders/create` → `https://your-ngrok-url.ngrok-free.dev/api/webhooks/orders/create`
- `orders/updated` → `https://your-ngrok-url.ngrok-free.dev/api/webhooks/orders/updated`

### 2. Test Webhook Flow

1. Make sure your dev server is running (`npm run dev`)
2. Make sure ngrok is running (`ngrok http 3000`)
3. Create a test order in your Shopify store (or use the order generator script)
4. Watch the server logs for webhook activity:
   ```
   Webhook received: orders/create
   Order created: #1234 - Synced successfully
   Updating metrics for 2 affected drops...
   ```

### 3. Verify Webhook Data

- Check `data/sessions.db` → `orders` table for synced orders
- Check `data/drops.db` → `drops` table for updated metrics (net_sales, order_count)
- Refresh the dashboard to see updated data

### 4. Troubleshooting Webhooks

**Webhooks not arriving?**
- Verify ngrok is running and URL matches webhook configuration
- Check Shopify Partner Dashboard → Webhooks → View recent deliveries
- Look for failed deliveries and error messages

**HMAC verification failed?**
- Ensure `SHOPIFY_API_SECRET` is correct in `.env.local`
- Check server logs for specific verification errors

**Metrics not updating?**
- Check server logs for drop metrics calculation errors
- Verify orders are being stored in `sessions.db`
- Check that drop time ranges overlap with order timestamps

## Tips

- **Keep ngrok URL consistent**: Use a paid ngrok account to get a fixed subdomain, so you don't need to update `.env.local` and webhooks every time
- **Session expires**: If you leave the app idle for too long, you may need to re-authenticate by visiting the auth URL again
- **Multiple terminals**: Use separate terminal windows/tabs for `npm run dev` and `ngrok` so you can see both outputs
- **Check server logs**: The dev server logs show useful info about requests, errors, authentication events, and **webhook activity**
- **Test with order generator**: Use `npx tsx scripts/ultimate-order-generator.ts 10` to generate test orders that trigger webhooks
- **Watch both databases**: Check `data/sessions.db` for orders and `data/drops.db` for metrics

## Quick Reference URLs

Replace `[NGROK_URL]` with your current ngrok URL (e.g., `https://suzann-languishing-uncoloredly.ngrok-free.dev`)

| Purpose | URL |
|---------|-----|
| Re-authenticate (after server restart) | `https://[NGROK_URL]/api/shopify/auth?shop=YOUR_STORE.myshopify.com` |
| Debug with console logs (outside iframe) | `http://localhost:3001?shop=YOUR_STORE.myshopify.com` |
| App in Shopify Admin | `https://admin.shopify.com/store/YOUR_STORE/apps/drop-analyzer` |
| Express server | `http://localhost:3000` |
| Vite dev server | `http://localhost:3001` |

**Note:** When viewing the app inside Shopify Admin (iframe), browser console logs aren't visible. Use the localhost:3001 URL directly for debugging.
