# Quick Start - Ultimate Order Generator

## ⚡ 1-Minute Setup

### Step 1: Configure .env
```bash
SHOPIFY_STORE_URL=your-store.myshopify.com
SHOPIFY_ACCESS_TOKEN=shpat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
DISCOUNT_CODE=10%off
```

### Step 2: Run It
```bash
# Test with 10 orders first
npx tsx scripts/ultimate-order-generator.ts 10

# Then generate full dataset
npx tsx scripts/ultimate-order-generator.ts 100
```

---

## 📖 Common Commands

```bash
# Quick test (10 orders, ~15 seconds)
npx tsx scripts/ultimate-order-generator.ts 10

# Standard dataset (100 orders, ~1 minute)
npx tsx scripts/ultimate-order-generator.ts 100

# Large dataset (250 orders, ~2-3 minutes)
npx tsx scripts/ultimate-order-generator.ts 250

# Maximum (500 orders, ~5 minutes)
npx tsx scripts/ultimate-order-generator.ts 500
```

---

## ✅ What You'll Get

For **100 orders**:
- ✅ 60 systematic + 40 random orders
- ✅ ~12 with discount codes (your actual code)
- ✅ ~5 cancelled orders
- ✅ ~15 hype buyers (5-10 items each)
- ✅ 30 unique customers
- ✅ Drop pattern: 65% in first 20 min, 35% over next 100 min
- ✅ All product variants covered

---

## 🔧 Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| "Access token not found" | Add `SHOPIFY_ACCESS_TOKEN` to `.env` |
| "No products available" | Create & publish products in Shopify Admin |
| "Rate limited" | Wait 2 minutes, script auto-retries |
| Discounts not showing | Create discount code in Shopify, update `.env` |

---

## 📍 Where to Look

- **Shopify Orders:** `https://admin.shopify.com/store/YOUR-STORE/orders`
- **Full Guide:** See [README-ORDER-GENERATOR.md](README-ORDER-GENERATOR.md)
- **Script:** [ultimate-order-generator.ts](ultimate-order-generator.ts)

---

## 💡 Pro Tips

1. **Always test with 10 orders first**
2. **Check Shopify Admin** immediately after to verify
3. **Most orders cluster in first 20 minutes** (drop pattern)
4. **Look for 🔥 emoji** in output = hype buyer orders
5. **Cancelled orders** are marked with ⚠️ during creation

---

That's it! Run the command and check Shopify Admin. 🚀
