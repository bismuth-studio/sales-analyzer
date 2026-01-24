# Development Workflow Guide

Quick reference for starting and stopping development sessions for the Sales Analyzer Shopify app.

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
https://your-subdomain.ngrok-free.dev/api/shopify/auth?shop=bismuth-dev.myshopify.com
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
3. Visit `https://your-subdomain.ngrok-free.dev/api/shopify/auth?shop=bismuth-dev.myshopify.com`

Done! Your app should work immediately.

## Troubleshooting

### "Error loading orders" or "Not authenticated"
Run the auth URL again:
```
https://your-subdomain.ngrok-free.dev/api/shopify/auth?shop=bismuth-dev.myshopify.com
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

## Tips

- **Keep ngrok URL consistent**: Use a paid ngrok account to get a fixed subdomain, so you don't need to update `.env` every time
- **Session expires**: If you leave the app idle for too long, you may need to re-authenticate by visiting the auth URL again
- **Multiple terminals**: Use separate terminal windows/tabs for `npm run dev` and `ngrok` so you can see both outputs
- **Check server logs**: The dev server logs show useful info about requests, errors, and authentication events

## Quick Reference URLs

Replace `[NGROK_URL]` with your current ngrok URL (e.g., `https://suzann-languishing-uncoloredly.ngrok-free.dev`)

| Purpose | URL |
|---------|-----|
| Re-authenticate (after server restart) | `https://[NGROK_URL]/api/shopify/auth?shop=bismuth-dev.myshopify.com` |
| Debug with console logs (outside iframe) | `http://localhost:3001?shop=bismuth-dev.myshopify.com` |
| App in Shopify Admin | `https://admin.shopify.com/store/bismuth-dev/apps/drop-leak-v2` |
| Express server | `http://localhost:3000` |
| Vite dev server | `http://localhost:3001` |

**Note:** When viewing the app inside Shopify Admin (iframe), browser console logs aren't visible. Use the localhost:3001 URL directly for debugging.
