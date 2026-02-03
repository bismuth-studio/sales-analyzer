# Ultimate Order Generator - User Guide

A powerful script that simulates realistic street fashion drop patterns by creating test orders in your Shopify store.

## 🎯 What It Does

Creates realistic test orders with:
- **Drop Pattern Simulation** - 65% of orders in first 20 minutes, 35% spread over next 100 minutes
- **30 Diverse Customers** - Unique profiles across 10 US cities
- **Hype Buyers** - ~15% of orders with 5-10 items (street fashion resellers)
- **Discount Codes** - ~12% of orders with your actual discount codes
- **Order Cancellations** - ~5% of orders get cancelled
- **Systematic Coverage** - All product variants get orders
- **Random Mix** - Realistic variety in products and quantities

---

## 📋 Prerequisites

### 1. Shopify Access Token

You need a Shopify access token with these scopes:
- `read_products`
- `write_orders`

**How to get your access token:**

1. Install your Shopify app in your development store
2. After OAuth, the access token is available in your session
3. Add it to your `.env` file:

```bash
SHOPIFY_ACCESS_TOKEN=shpat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Alternative method using the helper script:**
```bash
npx tsx scripts/get-access-token.ts
```

### 2. Environment Variables

Make sure your `.env` file contains:

```bash
# Required
SHOPIFY_API_KEY=your_api_key_here
SHOPIFY_API_SECRET=your_api_secret_here
SHOPIFY_ACCESS_TOKEN=shpat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Optional - Customize discount code (defaults to "10%off")
DISCOUNT_CODE=10%off
```

### 3. Published Products

The script only uses products that are:
- Active (not archived or draft)
- Published to your online store

**Check your products:**
1. Go to Shopify Admin → Products
2. Make sure you have active products published to "Online Store" sales channel

---

## 🚀 How to Run

### Basic Usage

```bash
# Generate 100 orders (default)
npx tsx scripts/ultimate-order-generator.ts
```

### Custom Order Count

```bash
# Generate 10 orders (quick test)
npx tsx scripts/ultimate-order-generator.ts 10

# Generate 250 orders (large dataset)
npx tsx scripts/ultimate-order-generator.ts 250

# Generate 500 orders (maximum)
npx tsx scripts/ultimate-order-generator.ts 500
```

**Valid range:** 1-500 orders

---

## 📊 What to Expect

### Execution Time

- **10 orders:** ~15 seconds
- **100 orders:** ~50-60 seconds
- **250 orders:** ~2-3 minutes
- **500 orders:** ~4-5 minutes

### Order Distribution

For 100 orders, you'll get:
- **60 systematic orders** - Cycles through all product variants
- **40 random orders** - Random product selection
- **~12 orders with discounts** (your actual discount code)
- **~5 cancelled orders** (marked as cancelled in Shopify)
- **~15 hype buyer orders** (5-10 items each)

### Sample Output

```
🚀 Ultimate Order Generator
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📦 Fetching published products...
✓ Found 15 published products (128 total variants)
  - Classic Cotton T-Shirt (12 variants)
  - Premium Hoodie (12 variants)
  - V-Neck T-Shirt (8 variants)
  ...

👥 Loaded 30 customer profiles
⏰ Drop window: 2026-02-02T06:00:00Z → 08:00:00Z

🛍️  Creating 100 orders (60 systematic + 40 random)...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Systematic Orders (60):
✓ Created 1/100... Latest: #1001 - $79.96 (10%off)
✓ Created 10/100... Latest: #1010 - $360.00 🔥
  🔄 Attempting to cancel order ##1012...
  ⚠️  Successfully cancelled order ##1012
...

Random Orders (40):
✓ Created 100/100... Latest: #1100 - $175.00

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ Order Generation Complete!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 Summary:
  Total Orders Created: 100
  ├─ Systematic: 60
  └─ Random: 40

  💰 Total Revenue: $15,234.67
  📈 Average Order Value: $152.35

  Special Orders:
  ├─ With Discounts: 12 (12%)
  ├─ Cancelled: 5 (5%)
  └─ Hype Buyers: 15 (15%) 🔥

  ⏰ Time Range:
     First Order: 2026-02-02T22:00:15-05:00
     Last Order: 2026-02-02T23:45:23-05:00

🔗 View orders: https://admin.shopify.com/store/bismuth-dev/orders

⏱️  Execution Time: 54.2 seconds
```

---

## ✅ Verification

After running the script, check these in Shopify Admin:

### 1. View Orders
Go to: `https://admin.shopify.com/store/YOUR-STORE/orders`

### 2. Check Drop Pattern
- Most orders should have timestamps clustered in the first 20 minutes
- Remaining orders spread over the next 100 minutes

### 3. Verify Discounts
- ~12% of orders should show your discount code applied
- Look for orders with price reductions

### 4. Check Cancellations
- ~5% of orders should be marked as "Cancelled"
- Filter by "Cancelled" status to see them

### 5. Find Hype Buyers
- ~15% of orders should have 5-10 items
- Look for orders with high item counts

### 6. Customer Diversity
- Should see 30 different customer names
- Names like "Sarah Smith", "Michael Johnson", etc.
- Addresses across 10 US cities

### 7. Variant Coverage
- All product variants should appear in at least one order
- Systematic orders ensure complete coverage

---

## ⚙️ Configuration

### Customize Discount Code

By default, the script uses `"10%off"`. To change this:

**Option 1: Environment Variable**
```bash
# In your .env file
DISCOUNT_CODE=HYPE20
```

**Option 2: Edit Script Directly**
```typescript
// In ultimate-order-generator.ts, line 76
const DISCOUNT_CODE = process.env.DISCOUNT_CODE || 'YOUR_CODE_HERE';
```

### Adjust Drop Pattern

The script simulates a 2-hour drop window starting 2 hours ago from when you run it.

To adjust the time distribution, modify the `generateDropTimestamp()` function:

```typescript
// Line 115-133 in ultimate-order-generator.ts
function generateDropTimestamp(dropStartTime: Date): Date {
  const random = Math.random();

  if (random < 0.65) {
    // First 20 minutes - adjust 0.65 to change percentage
    const lambda = 0.15; // Adjust decay rate
    const minutesOffset = -Math.log(1 - Math.random()) / lambda;
    const clampedMinutes = Math.min(minutesOffset, 20);
    return new Date(dropStartTime.getTime() + clampedMinutes * 60 * 1000);
  } else {
    // Remaining 100 minutes
    const lambda = 0.02; // Adjust decay rate
    const minutesOffset = 20 + (-Math.log(1 - Math.random()) / lambda);
    const clampedMinutes = Math.min(minutesOffset, 120);
    return new Date(dropStartTime.getTime() + clampedMinutes * 60 * 1000);
  }
}
```

### Change Customer Count

To use more or fewer customers, edit lines 47-72:

```typescript
// Add more names to these arrays
const firstNames = ['Sarah', 'Michael', /* add more */];
const lastNames = ['Smith', 'Johnson', /* add more */];
```

### Adjust Special Order Percentages

```typescript
// Line 520: Hype buyers (currently 15%)
const isHypeBuyer = Math.random() < 0.15;

// Line 521: Discounts (currently 12%)
const shouldApplyDiscount = Math.random() < 0.12;

// Line 522: Cancellations (currently 5%)
const shouldCancel = Math.random() < 0.05;
```

---

## 🔧 Troubleshooting

### Error: "SHOPIFY_ACCESS_TOKEN not found"

**Solution:**
1. Make sure you have a `.env` file in the project root
2. Add your access token: `SHOPIFY_ACCESS_TOKEN=shpat_xxxxx`
3. Run the OAuth flow to get a new token if needed

### Error: "No products available"

**Solution:**
1. Go to Shopify Admin → Products
2. Create some products if you don't have any
3. Make sure products are "Active" (not draft or archived)
4. Publish products to "Online Store" sales channel

### Error: "Rate limited"

**Solution:**
- The script automatically handles rate limiting with retries
- If you see multiple rate limit errors, your store might have other API activity
- Wait a few minutes and try again

### Discounts not showing up

**Solution:**
1. Make sure you created a discount code in Shopify Admin
2. Update the `DISCOUNT_CODE` environment variable or script constant
3. The discount code must exist and be active in your store

### Cancellations not working

**Solution:**
- Check that your access token has `write_orders` scope
- Cancelled orders appear as "Cancelled" status in Shopify
- With small batches (10-20 orders), you might not get any cancellations due to 5% probability

### Orders have wrong timestamps

**Solution:**
- Shopify may convert timestamps to your store's timezone
- The script creates orders with timestamps 2 hours ago from runtime
- Check the "Time Range" in the summary output to see actual timestamps used

---

## 🎓 Tips & Best Practices

### Starting Small
```bash
# Always test with 10 orders first
npx tsx scripts/ultimate-order-generator.ts 10
```

### Clean Slate
If you want to start fresh:
1. Go to Shopify Admin → Orders
2. Delete test orders manually (Shopify doesn't have bulk delete)
3. Or use filters to identify test orders (by customer name)

### Realistic Testing
For realistic drop analysis:
```bash
# Generate 100-250 orders
npx tsx scripts/ultimate-order-generator.ts 150
```

### Large Datasets
For comprehensive testing:
```bash
# Maximum 500 orders (takes ~5 minutes)
npx tsx scripts/ultimate-order-generator.ts 500
```

### Multiple Drops
To simulate multiple drop events:
```bash
# Run the script multiple times with delays
npx tsx scripts/ultimate-order-generator.ts 100
sleep 3600  # Wait 1 hour
npx tsx scripts/ultimate-order-generator.ts 100
```

---

## 📝 Script Features Reference

| Feature | Percentage | Description |
|---------|-----------|-------------|
| Systematic Orders | 60% | Cycles through all product variants |
| Random Orders | 40% | Random product/quantity selection |
| Hype Buyers | ~15% | Orders with 5-10 items (quantities 2-5 each) |
| Regular Buyers | ~85% | Orders with 1-3 items (quantities 1-2 each) |
| With Discounts | ~12% | Orders with discount code applied |
| Cancelled | ~5% | Orders marked as cancelled |
| Drop Pattern | 65%/35% | 65% in first 20min, 35% over next 100min |

### Customer Distribution
- **30 unique customers** with consistent profiles
- **10 US cities**: LA, NYC, Chicago, Houston, Phoenix, Miami, Seattle, Denver, Atlanta, Portland
- **Email format**: `firstname.lastname@example.com`

### Financial Statuses
Orders randomly assigned:
- `paid` (most common)
- `pending`
- `authorized`

---

## 🆘 Getting Help

If you encounter issues:

1. **Check this guide** - Most solutions are above
2. **Verify prerequisites** - Access token, products, environment variables
3. **Test with 10 orders** - Easier to debug small batches
4. **Check Shopify API status** - [status.shopify.com](https://status.shopify.com)
5. **Review script output** - Error messages are descriptive

---

## 📄 License & Credits

Built for testing drop analytics in Shopify fashion stores.

**Key Technologies:**
- Shopify Admin REST API
- TypeScript
- Node.js

**Created:** 2026
**Last Updated:** 2026-02-02
