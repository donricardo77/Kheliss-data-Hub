# Order Status Sync Guide for Agents

## Overview

This guide explains how to properly track and sync order status updates from AllenDataHub. If your orders aren't showing status changes, this guide will help you implement the correct approach.

---

## How Order Status Updates Work

AllenDataHub supports **two methods** for tracking order status:

### Method 1: Webhook Forwarding (Recommended) 🔔
**Push model** - AllenDataHub sends you status updates automatically

### Method 2: Polling (Fallback)
**Pull model** - You repeatedly ask for the latest status

---

## Method 1: Webhook Forwarding (Recommended)

### How It Works

```
Your Server
    ↓
[POST /api/v1/data/purchase] with webhookUrl
    ↓
AllenDataHub Server
    ↓
[Order Created]
    ↓
[Portal02 Vendor Updates Status]
    ↓
[AllenDataHub Receives Update]
    ↓
[POST to Your webhookUrl] ← Automatic push
    ↓
Your Server (receives update)
```

### Step 1: Create an Order with webhookUrl

When creating an order, **include a `webhookUrl` parameter**:

```bash
curl -X POST "https://allen-data-hub-backend.onrender.com/api/v1/data/purchase" \
  -H "X-API-Key: adh_live_your_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "0541234567",
    "network": "MTN",
    "volume": 5,
    "webhookUrl": "https://your-domain.com/api/webhooks/allendatahub"
  }'
```

**Important: webhookUrl Requirements**
- ✅ Must be a valid HTTPS URL (http://localhost won't work)
- ✅ Must be publicly accessible
- ✅ Must accept POST requests
- ✅ Must return HTTP 200-299 within 10 seconds
- ✅ Can be different for each order

### Response Example

```json
{
  "success": true,
  "orderId": "65a4c2e8f123456789abcdef",
  "status": "processing",
  "amount": 10.5,
  "walletBalanceAfter": 89.5,
  "webhookUrl": "https://your-domain.com/api/webhooks/allendatahub"
}
```

### Step 2: Set Up Your Webhook Endpoint

Create an endpoint to receive status updates:

```typescript
// Node.js/Express example
app.post("/api/webhooks/allendatahub", express.json(), async (req, res) => {
  const payload = req.body;
  
  console.log("AllenDataHub webhook received:", payload);
  
  const {
    orderId,
    vendorOrderId,
    clientOrderReference,
    status,           // "completed", "failed", "processing"
    vendorStatus,     // Raw vendor status
    phoneNumber,
    dataAmount,
    webhookEvent,
    timestamp,
  } = payload;
  
  // ✅ CRITICAL: Respond immediately with 200
  res.status(200).json({ received: true });
  
  // Then process asynchronously
  try {
    // Update your database with the new status
    await updateOrderInDatabase({
      orderId,
      vendorOrderId,
      clientOrderReference,
      status,
      phoneNumber,
      dataAmount,
      updatedAt: new Date(timestamp),
    });
    
    // Notify your customer
    await sendStatusNotification(orderId, status);
    
    console.log(`Order ${orderId} updated to: ${status}`);
  } catch (error) {
    console.error("Error processing webhook:", error);
    // Don't throw - webhook already responded with 200
  }
});
```

**Python/Flask example:**
```python
@app.route("/api/webhooks/allendatahub", methods=["POST"])
def allendatahub_webhook():
    payload = request.json
    
    # ✅ CRITICAL: Respond immediately
    response = {"received": True}
    
    # Background task to process
    process_order_update.delay(payload)  # Using Celery or similar
    
    return response, 200
```

### Step 3: Webhook Payload Structure

When status changes, you'll receive:

```json
{
  "orderId": "65a4c2e8f123456789abcdef",
  "vendorOrderId": "VENDOR-123456",
  "clientOrderReference": "API-agent-id-1234-abcd",
  "status": "completed",
  "vendorStatus": "delivered",
  "phoneNumber": "0541234567",
  "dataAmount": "5GB",
  "webhookEvent": "order.completed",
  "timestamp": "2026-05-19T14:32:15.000Z",
  "raw": {
    // Raw vendor response data
  }
}
```

### Status Values Explained

| Status | Meaning | Final? |
|--------|---------|--------|
| `processing` | Vendor is processing | No - will change |
| `completed` | Data bundle delivered successfully | ✅ Yes - final |
| `failed` | Order failed (no refund) | ✅ Yes - final |

---

## Method 2: Polling (Fallback)

### When to Use Polling

If webhooks aren't feasible:
- ❌ You can't expose a public webhook endpoint
- ❌ You're behind a firewall/NAT
- ❌ You want a simple implementation without webhooks

### How Polling Works

```
Your Server (every 30 seconds)
    ↓
[GET /api/v1/orders/:orderId]
    ↓
AllenDataHub Server
    ↓
[Return current status]
    ↓
Your Server (checks if changed)
```

### Implementation

```typescript
// Node.js example
async function pollOrderStatus(orderId: string, maxAttempts = 60) {
  const apiKey = process.env.ALLENDATAHUB_API_KEY;
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    try {
      const response = await fetch(
        `https://allen-data-hub-backend.onrender.com/api/v1/orders/${orderId}`,
        {
          headers: {
            "X-API-Key": apiKey,
          },
        }
      );
      
      const order = await response.json();
      
      console.log(`[Poll ${attempts + 1}] Status: ${order.status}`);
      
      // ✅ Check if final status reached
      if (order.status === "completed" || order.status === "failed") {
        console.log(`Order finished: ${order.status}`);
        return order;
      }
      
      // Wait 30 seconds before next poll
      await new Promise(resolve => setTimeout(resolve, 30000));
      
    } catch (error) {
      console.error("Poll error:", error);
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
    
    attempts++;
  }
  
  throw new Error(`Order ${orderId} did not complete within ${maxAttempts * 30} seconds`);
}

// Usage
const order = await pollOrderStatus("65a4c2e8f123456789abcdef");
console.log("Final status:", order.status);
```

### Polling Best Practices

- ❌ **DON'T** poll every second (wastes bandwidth)
- ✅ **DO** poll every 30-60 seconds
- ❌ **DON'T** poll indefinitely
- ✅ **DO** set max attempts (e.g., 120 = 1 hour max)
- ✅ **DO** cache the last known status
- ✅ **DO** exponential backoff on errors

---

## Common Issues & Solutions

### Issue 1: "Webhook Status Not Received"

**Symptoms:**
- Order created successfully
- Webhook endpoint never gets called
- Order status stuck on "processing"

**Solutions:**

1. **Verify webhookUrl is HTTPS**
   ```bash
   ❌ http://localhost:3000/webhook  # Won't work
   ❌ http://192.168.1.1/webhook      # Won't work
   ✅ https://yourdomain.com/webhook  # Correct
   ```

2. **Check that endpoint returns 200 quickly**
   ```typescript
   app.post("/webhook", (req, res) => {
     res.status(200).json({ ok: true }); // Return immediately
     
     // Process asynchronously
     handleWebhookAsync(req.body);
   });
   ```

3. **Verify webhookUrl was received**
   ```bash
   curl -X GET "https://allen-data-hub-backend.onrender.com/api/v1/orders/ORDER_ID" \
     -H "X-API-Key: adh_live_..."
   
   # Check response for "webhookUrl" field
   ```

4. **Check backend logs** (if you have access)
   ```
   Look for: [Portal02] Forwarded status update to https://yourdomain.com/webhook
   ```

### Issue 2: "Order Stuck on 'processing'"

**Symptoms:**
- Status won't change to completed/failed
- Been waiting more than 2-3 minutes

**Solutions:**

1. **Check order creation was successful**
   ```bash
   curl "https://allen-data-hub-backend.onrender.com/api/v1/orders/ORDER_ID" \
     -H "X-API-Key: adh_live_..."
   ```

2. **Verify phone number format**
   - Must be exactly 10 digits starting with 0: `0541234567`
   - Not international: `+233541234567` ❌
   - Not 9 digits: `541234567` ❌

3. **Use polling to check current status**
   ```bash
   # Poll every 30 seconds
   for i in {1..10}; do
     curl "https://allen-data-hub-backend.onrender.com/api/v1/orders/ORDER_ID" \
       -H "X-API-Key: adh_live_..."
     echo "Poll #$i"
     sleep 30
   done
   ```

4. **Check API limits**
   - Max 20 requests/minute for purchase endpoint
   - If rate limited, requests will fail with 429

### Issue 3: "Webhook Returns Error"

**Symptoms:**
- Backend logs show: "Failed to forward webhook to..."
- Webhook never called

**Solutions:**

1. **Verify endpoint is accessible**
   ```bash
   curl -X POST "https://yourdomain.com/api/webhooks/allendatahub" \
     -H "Content-Type: application/json" \
     -d '{"test": true}'
   # Should return 200
   ```

2. **Check for CORS issues** (if from browser)
   ```typescript
   app.use(cors());
   ```

3. **Verify firewall/network allows incoming requests**
   - Check that your server isn't blocking inbound connections
   - Whitelist: `https://allen-data-hub-backend.onrender.com`

4. **Check response time**
   - Endpoint must respond within 10 seconds
   - AllenDataHub gives up after 10s and marks as failed

---

## Implementation Checklist

### Using Webhooks
- [ ] Order creation includes `webhookUrl` parameter
- [ ] `webhookUrl` is valid HTTPS (not HTTP, not localhost)
- [ ] Webhook endpoint is publicly accessible
- [ ] Endpoint returns 200 within 5 seconds
- [ ] Endpoint stores `orderId` and `status` from payload
- [ ] Endpoint processes asynchronously (doesn't block response)
- [ ] You've tested the endpoint with a tool like curl/Postman

### Using Polling
- [ ] Saving `orderId` from creation response
- [ ] Polling every 30-60 seconds (not faster)
- [ ] Checking `status` field in response
- [ ] Stopping poll when status = "completed" or "failed"
- [ ] Setting max attempts (recommended: 120 = 1 hour)
- [ ] Handling network errors gracefully

---

## Example: Complete Integration

### Node.js Complete Example

```typescript
import express from "express";

const app = express();
app.use(express.json());

const BASE_URL = "https://allen-data-hub-backend.onrender.com";
const API_KEY = process.env.ALLENDATAHUB_API_KEY;

// In-memory order tracking (use database in production)
const orders = new Map();

// 1. Create order with webhook
app.post("/api/purchase", async (req, res) => {
  const { phoneNumber, network, volume } = req.body;
  
  // Create order with webhook URL pointing back to us
  const response = await fetch(`${BASE_URL}/api/v1/data/purchase`, {
    method: "POST",
    headers: {
      "X-API-Key": API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      phoneNumber,
      network,
      volume,
      webhookUrl: "https://yourdomain.com/api/webhooks/allendatahub",
    }),
  });
  
  const order = await response.json();
  
  if (!order.success) {
    return res.status(400).json(order);
  }
  
  // Store locally
  orders.set(order.orderId, {
    ...order,
    status: "processing",
    createdAt: new Date(),
  });
  
  return res.json({ orderId: order.orderId, status: "processing" });
});

// 2. Webhook receiver (AllenDataHub calls this)
app.post("/api/webhooks/allendatahub", (req, res) => {
  const { orderId, status, phoneNumber, dataAmount } = req.body;
  
  // ✅ CRITICAL: Respond immediately
  res.status(200).json({ received: true });
  
  // ✅ Update order status
  const order = orders.get(orderId);
  if (order) {
    order.status = status;
    order.updatedAt = new Date();
    console.log(`Order ${orderId} updated to ${status}`);
  }
});

// 3. Check order status
app.get("/api/orders/:orderId", (req, res) => {
  const order = orders.get(req.params.orderId);
  
  if (!order) {
    return res.status(404).json({ message: "Order not found" });
  }
  
  return res.json({
    orderId: order.orderId,
    status: order.status,
    phoneNumber: order.phoneNumber,
    dataAmount: order.dataAmount,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  });
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
```

### Testing the Integration

```bash
# 1. Create order
curl -X POST "http://localhost:3000/api/purchase" \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "0541234567",
    "network": "MTN",
    "volume": 5
  }'

# Response: {"orderId": "65a4c2e8f123456789abcdef", "status": "processing"}

# 2. Check status (immediately - should be processing)
curl "http://localhost:3000/api/orders/65a4c2e8f123456789abcdef"

# Response: {"orderId": "...", "status": "processing", ...}

# 3. Wait 30-60 seconds, then check again
# (or webhook will notify you automatically)

curl "http://localhost:3000/api/orders/65a4c2e8f123456789abcdef"

# Response: {"orderId": "...", "status": "completed", ...}
```

---

## Debug Checklist

If orders aren't syncing, check in this order:

1. **Order creation response**
   - [ ] `success: true`
   - [ ] `orderId` is present
   - [ ] `webhookUrl` matches your endpoint (if using webhooks)
   - [ ] Wallet deducted correctly

2. **Order retrieval**
   - [ ] `GET /api/v1/orders/:orderId` returns the order
   - [ ] Status shows "processing" or higher
   - [ ] `webhookUrl` field is populated

3. **If using webhooks:**
   - [ ] Your webhook endpoint is publicly accessible
   - [ ] Server logs show incoming POST requests
   - [ ] Endpoint responds with 200 within 5 seconds
   - [ ] Backend logs show "Forwarded status update to..."

4. **If using polling:**
   - [ ] `GET /api/v1/orders/:orderId` is returning current data
   - [ ] Status changes after 1-3 minutes
   - [ ] No rate limit errors (HTTP 429)

5. **If still failing:**
   - [ ] Check phone number format (0XXXXXXXXX)
   - [ ] Verify network spelling (MTN, Telecel, AirtelTigo)
   - [ ] Verify volume is valid for that network
   - [ ] Check wallet balance is sufficient

---

## Support

If you're still experiencing issues:

1. **Check backend logs** - Look for errors in `/api/webhooks/portal02` processing
2. **Verify phone number** - Exact format must be `0XXXXXXXXX` (10 digits)
3. **Test with curl/Postman** - Eliminate your code as variable
4. **Contact admin** - Provide order ID and request logs for that order

---

## Quick Reference

### Create Order with Webhook
```bash
curl -X POST "https://allen-data-hub-backend.onrender.com/api/v1/data/purchase" \
  -H "X-API-Key: adh_live_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "0541234567",
    "network": "MTN",
    "volume": 5,
    "webhookUrl": "https://yourdomain.com/webhook"
  }'
```

### Poll Order Status
```bash
curl "https://allen-data-hub-backend.onrender.com/api/v1/orders/ORDER_ID" \
  -H "X-API-Key: adh_live_YOUR_KEY"
```

### Valid Status Values
- `processing` → Waiting for completion
- `completed` → Success! Data delivered
- `failed` → Failed, wallet NOT refunded

---

**Last Updated:** May 2026  
**API Version:** v1  
**Status:** Active
