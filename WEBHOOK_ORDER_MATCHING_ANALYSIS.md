# AllenDataHub Webhook Order Matching Issue - Root Cause Analysis

## Problem Statement
Webhooks from AllenDataHub are failing to find orders in the database:
```
orderId=6a1b0573ddb7ac6598c3743a
reference=API-698452b0abc0a320e49dffcc-1780155763649-d35d730e4c6b
Error: Order NOT found. Tried all strategies.
```

## Order Creation Flow (Wallet Payment)
1. **Order Creation Call** (`POST /api/orders` with `paymentMethod: "wallet"`)
   - Calls `allenDataHubService.purchaseDataBundle(...)`
   - Receives response with `orderId`, `reference`, `success`, etc.

2. **Response Extraction** (`backend/api-server/src/lib/allendatahub.ts:215-217`)
   ```typescript
   return {
     ...data,
     orderId: data.orderId || data.order?.id || data.transactionId,
   };
   ```

3. **Order Document Creation** (`backend/api-server/src/routes/orders.ts:125-128`)
   ```typescript
   vendorOrderId = result.transactionId || result.orderId;
   vendorReference = result.reference;
   ```

## Critical Issue Identified
**The problem is in how `vendorOrderId` is extracted from the response:**

### Current Code (WRONG):
```typescript
// orders.ts line 125
vendorOrderId = result.transactionId || result.orderId;
```

### What Actually Happens:
1. `purchaseDataBundle` returns: `{ ...data, orderId: data.orderId || data.order?.id || data.transactionId }`
2. If API response has `orderId` = "6a1b0573ddb7ac6598c3743a"
3. Then `result.transactionId` would be `undefined`
4. So `result.orderId` would be "6a1b0573ddb7ac6598c3743a" ✓ (GOOD)

BUT... what if the API response structure is different?

### Potential API Response Structures:
**Structure A (Current Assumption):**
```json
{
  "success": true,
  "orderId": "6a1b0573ddb7ac6598c3743a",
  "reference": "API-698452b0abc0a320e49dffcc-1780155763649-d35d730e4c6b",
  "transactionId": null
}
```
→ Would extract: `vendorOrderId = null || "6a1b0573ddb7ac6598c3743a"` = "6a1b0573ddb7ac6598c3743a" ✓

**Structure B (Actual API Response):**
```json
{
  "success": true,
  "transactionId": "6a1b0573ddb7ac6598c3743a",
  "reference": "API-698452b0abc0a320e49dffcc-1780155763649-d35d730e4c6b"
}
```
→ `result.orderId` = undefined (NOT SET by purchaseDataBundle if API didn't return it)
→ Would extract: `vendorOrderId = "6a1b0573ddb7ac6598c3743a" || undefined` = "6a1b0573ddb7ac6598c3743a" ✓

**Structure C (Another Possibility):**
```json
{
  "success": true,
  "order": {
    "id": "6a1b0573ddb7ac6598c3743a",
    "reference": "API-698452b0abc0a320e49dffcc-1780155763649-d35d730e4c6b"
  }
}
```
→ purchaseDataBundle creates: `orderId: data.orderId || data.order?.id` = "6a1b0573ddb7ac6598c3743a"
→ Would extract: `vendorOrderId = undefined || "6a1b0573ddb7ac6598c3743a"` = "6a1b0573ddb7ac6598c3743a" ✓

## Most Likely Root Cause
The extraction logic in `orders.ts` has the parameters in the WRONG ORDER:

```typescript
vendorOrderId = result.transactionId || result.orderId;  // ❌ WRONG ORDER
```

Should be:
```typescript
vendorOrderId = result.orderId || result.transactionId;  // ✓ CORRECT ORDER
```

This is because `purchaseDataBundle` normalizes the response to return `orderId` as the primary field:
```typescript
return {
  ...data,
  orderId: data.orderId || data.order?.id || data.transactionId,  // orderId is primary
};
```

But `orders.ts` is checking `transactionId` first! This causes:
- If API only returns `orderId` → `result.transactionId` is undefined → falls back to `result.orderId` ✓ (works)
- If API returns both → `result.transactionId` takes precedence → might get wrong value ✗ (breaks matching)
- If the API updates and removes `orderId` field → lookup fails ✗ (breaks)

## Additional Issue: Paystack Webhook Same Problem
File: `backend/api-server/src/routes/paystack.ts:127`
```typescript
order.vendorOrderId = result.transactionId || result.orderId;  // ❌ SAME WRONG ORDER
```

## Solution
Fix both locations to check `orderId` first (the normalized field):

1. **File:** `backend/api-server/src/routes/orders.ts` (line 125)
   ```typescript
   // Change from:
   vendorOrderId = result.transactionId || result.orderId;
   // To:
   vendorOrderId = result.orderId || result.transactionId;
   ```

2. **File:** `backend/api-server/src/routes/paystack.ts` (line 127)
   ```typescript
   // Change from:
   order.vendorOrderId = result.transactionId || result.orderId;
   // To:
   order.vendorOrderId = result.orderId || result.transactionId;
   ```

3. **File:** `backend/api-server/src/routes/vendor.ts` (line 90)
   ```typescript
   // Already correct in AllenDataHub purchase for vendor route
   // But verify it matches the pattern
   ```

## Verification Steps
After fixing, test with:
1. Create order via wallet with valid product
2. Monitor logs for: `vendorOrderId` value
3. Verify webhook comes in with matching `orderId`
4. Confirm order lookup succeeds
