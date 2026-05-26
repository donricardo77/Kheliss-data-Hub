# AllenDataHub Agent API — Real-Time Order Status Guide

This document explains exactly how an agent should integrate with AllenDataHub to receive real-time order status updates.

## 1) Agent API flow for real-time updates

Agents must use the AllenDataHub partner API endpoints and provide a public callback URL (`webhookUrl`) when creating the order.

### Create order endpoint

- URL: `POST /api/v1/data/purchase`
- Headers:
  - `Content-Type: application/json`
  - `x-api-key: <AGENT_API_KEY>`

### Required request body

```json
{
  "phoneNumber": "0241234567",
  "network": "MTN",
  "volume": 1,
  "webhookUrl": "https://agent.example.com/api/webhooks/allendatahub"
}
```

### Notes
- `webhookUrl` is optional for order creation, but required for real-time push status updates.
- The URL must be publicly reachable and use HTTPS.
- `http://localhost` or private LAN URLs will not work for AllenDataHub webhook callbacks.

---

## 2) What AllenDataHub does after purchase

When the agent creates an order:

1. AllenDataHub creates a local order record.
2. AllenDataHub sends the order to its internal fulfillment system.
3. AllenDataHub stores:
   - `vendorOrderId`
   - `clientOrderReference`
   - `webhookUrl`
4. AllenDataHub receives status callbacks at its internal processing endpoint.
5. AllenDataHub updates the local order status and webhook history.
6. If the order reaches `completed` or `failed`, AllenDataHub forwards the update to the agent-provided `webhookUrl`.

---

## 3) Callback payload sent to the agent

AllenDataHub forwards final updates to the agent's webhook URL.

### Example payload

```json
{
  "orderId": "65123456789abcdef0123456",
  "vendorOrderId": "external-12345",
  "clientOrderReference": "API-agentid-1685000000000-abcdef",
  "status": "completed",
  "vendorStatus": "delivered",
  "phoneNumber": "0241234567",
  "dataAmount": "1 GB",
  "webhookEvent": "order.status.updated",
  "timestamp": "2026-05-26T12:00:00.000Z",
  "raw": {
    "event": "order.status.updated",
    "orderId": "external-12345",
    "status": "delivered",
    "timestamp": "2026-05-26T12:00:00.000Z"
  }
}
```

### What is forwarded
- `orderId` — local AllenDataHub order ID
- `vendorOrderId` — external order reference for status reconciliation
- `clientOrderReference` — agent-side order reference
- `status` — local normalized status (`completed`, `failed`, or `processing`)
- `vendorStatus` — raw external status from the fulfillment system
- `phoneNumber` — target phone number
- `dataAmount` — package size
- `webhookEvent` — event type
- `timestamp` — time of the update
- `raw` — original external payload or normalized payload

---

## 4) Agent webhook receiver requirements

The agent webhook endpoint should:

- accept `POST`
- parse JSON bodies
- return HTTP `200` when the payload is accepted
- be publicly reachable by AllenDataHub
- use HTTPS
- respond quickly (within 10 seconds)

### Example receiver (Node.js / Express)

```js
const express = require("express");
const app = express();
app.use(express.json());

app.post("/api/webhooks/allendatahub", (req, res) => {
  const payload = req.body;
  console.log("AllenDataHub status update:", payload);

  // Update your internal order record here.

  res.sendStatus(200);
});

app.listen(3000, () => {
  console.log("Agent webhook listener running on port 3000");
});
```

---

## 5) How to poll status instead of waiting for webhooks

If the agent prefers polling, use the read endpoint:

- URL: `GET /api/v1/orders/:orderId`
- Headers:
  - `x-api-key: <AGENT_API_KEY>`

### Example request

```http
GET /api/v1/orders/65123456789abcdef0123456
x-api-key: adh_live_your_key_here
```

### Example response

```json
{
  "id": "65123456789abcdef0123456",
  "userId": "agentuserid",
  "productId": "69815ba90771ff415dd64020",
  "price": 4.2,
  "dataAmount": "1 GB",
  "status": "completed",
  "paymentStatus": "success",
  "phoneNumber": "0241234567",
  "productName": "MTN 1 GB",
  "vendorOrderId": "external-12345",
  "clientOrderReference": "API-agentid-1685000000000-abcdef",
  "webhookUrl": "https://agent.example.com/api/webhooks/allendatahub",
  "createdAt": "2026-05-26T12:00:00.000Z",
  "updatedAt": "2026-05-26T12:05:00.000Z"
}
```

---

## 6) Unsupported endpoints for this backend

The following agent patterns are not supported by this AllenDataHub backend:

- `POST /webhook`
- `POST /api/orders/:id/sync`

The correct workflow is:

1. `POST /api/v1/data/purchase`
2. optionally receive webhook updates at `webhookUrl`
3. `GET /api/v1/orders/:orderId` to inspect current status

---

## 7) Troubleshooting

### If the agent does not receive status updates

1. Confirm the purchase request included a valid `webhookUrl`.
2. Confirm `webhookUrl` is HTTPS and publicly reachable.
3. Confirm AllenDataHub is receiving status callbacks at its internal processing endpoint.
4. Confirm agent order status is visible via `GET /api/v1/orders/:orderId`.
5. Confirm the `POST /api/v1/data/purchase` response included:
   - `orderId`
   - `transactionId` or `reference`
   - `status`
   - `webhookUrl`

### Common failure causes

- `webhookUrl` is not valid or not accessible from the public internet.
- the agent is using the wrong endpoint contract.
- AllenDataHub backend is misconfigured and sending its internal callback URL as localhost.

---

## 8) Example full flow

### 1) Agent places order

```http
POST /api/v1/data/purchase
Content-Type: application/json
x-api-key: adh_live_your_key_here

{
  "phoneNumber": "0241234567",
  "network": "MTN",
  "volume": 1,
  "webhookUrl": "https://agent.example.com/api/webhooks/allendatahub"
}
```

### 2) AllenDataHub forwards status updates to agent webhook

Agent webhook receives a `POST` containing the normalized status update.

### 3) Agent confirms order with polling if needed

```http
GET /api/v1/orders/65123456789abcdef0123456
x-api-key: adh_live_your_key_here
```

---

## 9) Key takeaways for agents

- Use `POST /api/v1/data/purchase` for purchase.
- Include `webhookUrl` for real-time notifications.
- Accept callbacks at your webhook endpoint.
- Use `GET /api/v1/orders/:orderId` to validate status manually.
- Do not use `/webhook` or `/api/orders/:id/sync` with this backend.
