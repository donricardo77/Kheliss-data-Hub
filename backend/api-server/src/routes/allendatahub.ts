import { Router, type Request, type Response } from "express";
import { Order } from "../models/Order";
import { requireAuth, requireAgent } from "../lib/auth-middleware";
import allenDataHubService from "../lib/allendatahub";
import { normalizePhoneNumber, validatePhoneNumber } from "../lib/phone-utils";
import { mongoose } from "../lib/mongodb";

const router = Router();

const supportedNetworks = ["MTN", "Telecel", "AirtelTigo"];

function formatOrder(order: any) {
  return {
    id: order._id.toString(),
    vendorOrderId: order.vendorOrderId,
    vendorReference: order.vendorReference,
    status: order.status,
    vendorStatus: order.vendorStatus,
    network: order.network,
    type: order.type,
    productName: order.productName,
    recipientPhone: order.recipientPhone,
    amount: order.amount,
    paymentMethod: order.paymentMethod,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

router.get("/products", requireAuth, async (_req: Request, res: Response) => {
  try {
    const products = await allenDataHubService.getProducts();
    return res.json({ success: true, products });
  } catch (err) {
    return res.status(502).json({
      success: false,
      error: err instanceof Error ? err.message : "Failed to fetch products",
    });
  }
});

router.post("/purchase", requireAuth, requireAgent, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { phoneNumber, network, volume, webhookUrl } = req.body;

    if (!phoneNumber || !network || volume === undefined) {
      return res.status(400).json({ error: "Missing required fields: phoneNumber, network, volume" });
    }

    if (!supportedNetworks.includes(network)) {
      return res.status(400).json({ error: `Unsupported network: ${network}` });
    }

    if (!validatePhoneNumber(phoneNumber)) {
      return res.status(400).json({ error: "Invalid phone number" });
    }

    const normalized = normalizePhoneNumber(phoneNumber);
    if (!normalized.success || !normalized.formatted) {
      return res.status(400).json({ error: normalized.error || "Invalid phone number" });
    }

    const webhookTarget = webhookUrl || `${req.protocol}://${req.get("host")}/api/vendor/allen-datahub/webhook`;
    const result = await allenDataHubService.purchaseDataBundle({
      phoneNumber: normalized.formatted,
      network,
      volume: Number(volume),
      webhookUrl: webhookTarget,
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error || "AllenDataHub purchase failed",
        details: result,
      });
    }

    const vendorOrderId = result.orderId || result.transactionId || `adh_${Date.now()}`;
    const order = new Order({
      userId: user._id,
      username: user.username,
      network,
      type: "data",
      productName: `${network} ${volume}GB`,
      recipientPhone: normalized.formatted,
      amount: result.amount ?? 0,
      status: "pending",
      paymentMethod: "vendor_wallet",
      paymentReference: result.reference,
      vendorOrderId,
      vendorWebhookUrl: webhookTarget,
      vendorReference: result.reference,
      vendorProductId: `${network}_${volume}`,
      vendorPhoneNumber: normalized.formatted,
      vendorStatus: result.status || "pending",
      webhookHistory: [],
    });

    await order.save();

    return res.status(201).json({
      success: true,
      message: "Order created successfully",
      order: formatOrder(order),
      requestId: result.requestId,
    });
  } catch (err) {
    return res.status(502).json({
      success: false,
      error: err instanceof Error ? err.message : "AllenDataHub purchase failed",
    });
  }
});

router.get("/orders", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { page = 1, limit = 20 } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    const filter = { userId: user._id };
    const total = await Order.countDocuments(filter);
    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    return res.json({
      success: true,
      orders: orders.map(formatOrder),
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : "Failed to fetch orders",
    });
  }
});

router.get("/orders/:vendorOrderId", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { vendorOrderId } = req.params;

    const order = await Order.findOne({ vendorOrderId, userId: user._id });
    if (!order) {
      return res.status(404).json({ success: false, error: "Order not found" });
    }

    return res.json({ success: true, order: formatOrder(order) });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : "Failed to fetch order",
    });
  }
});

router.post("/webhook", async (req: Request, res: Response) => {
  try {
    const payload = req.body;
    const webhookResult = allenDataHubService.processWebhookPayload(payload);

    if (!webhookResult.success) {
      return res.status(200).json({ received: true, success: false, error: webhookResult.error });
    }

    // Log parsed identifiers to aid debugging when lookups fail
    try {
      (req as any).log.info(`AllenDataHub webhook parsed: orderId=${webhookResult.orderId}, reference=${webhookResult.reference}, status=${webhookResult.status}`);
    } catch (err) {
      // ignore logging errors
    }

    // Build lookup strategies - try both string and ObjectId formats for _id
      const lookupStrategies: Array<Record<string, any>> = [
      { _id: webhookResult.orderId }, // Try as string first
    ];

    // Try to convert to ObjectId if it looks like a valid MongoDB ID
    if (webhookResult.orderId && /^[a-f0-9]{24}$/.test(String(webhookResult.orderId))) {
      try {
        lookupStrategies.push({ _id: new mongoose.Types.ObjectId(webhookResult.orderId) });
      } catch (err) {
        // Skip if conversion fails
      }
    }

    // Add additional strategies
    lookupStrategies.push(
      { vendorOrderId: webhookResult.orderId },
      { vendorReference: webhookResult.reference },
      { clientOrderReference: webhookResult.reference },
      { paymentReference: webhookResult.reference },
      { vendorOrderId: webhookResult.reference }
    );

    let order: any = null;
    let matchedQuery: Record<string, any> | null = null;
    let strategyIndex = 0;
    for (const query of lookupStrategies) {
      try {
        order = await Order.findOne(query as any);
        if (order) {
          matchedQuery = query as any;
          (req as any).log.info(`AllenDataHub webhook found order using strategy ${strategyIndex}: ${JSON.stringify(query, (key, val) => val instanceof mongoose.Types.ObjectId ? val.toString() : val)}`);
          break;
        }
      } catch (err) {
        // Log but continue to next strategy
        (req as any).log.debug?.(`Strategy ${strategyIndex} failed: ${err instanceof Error ? err.message : String(err)}`);
      }
      strategyIndex++;
    }

    if (!order) {
      (req as any).log.error(`AllenDataHub webhook: Order NOT found. Tried all strategies. orderId=${webhookResult.orderId}, reference=${webhookResult.reference}`);
      return res.status(200).json({ received: true, success: false, message: "Order not found" });
    }

    if (matchedQuery) {
      (req as any).log.info(`AllenDataHub webhook matched order with query: ${JSON.stringify(matchedQuery)}`);
    }

    const incomingStatus = webhookResult.status?.toString().toLowerCase() || "pending";
    const oldStatus = order.status;
    const oldVendorStatus = order.vendorStatus;

    // Determine new status based on incoming status
    let newStatus: "pending" | "processing" | "completed" | "failed" = order.status;
    let newVendorStatus: string = order.vendorStatus || "pending";

    if (["completed", "delivered", "success", "resolved"].includes(incomingStatus)) {
      newStatus = "completed";
      newVendorStatus = "completed";
    } else if (["failed", "cancelled", "refunded"].includes(incomingStatus)) {
      newStatus = "failed";
      newVendorStatus = "failed";
    } else if (["processing", "pending"].includes(incomingStatus)) {
      newStatus = "processing";
      newVendorStatus = incomingStatus;
    }

    // Use atomic update to prevent race conditions
    const updatedOrder = await Order.findOneAndUpdate(
      { _id: order._id },
      {
        $set: {
          vendorOrderId: webhookResult.orderId,
          vendorReference: webhookResult.reference,
          status: newStatus,
          vendorStatus: newVendorStatus,
          updatedAt: new Date(),
        },
        $push: {
          webhookHistory: {
            status: incomingStatus,
            timestamp: webhookResult.timestamp || new Date(),
            rawPayload: webhookResult.raw || payload,
          },
        },
      },
      { new: true }
    );

    (req as any).log.info(`AllenDataHub webhook updated order: id=${order._id}, status: ${oldStatus} → ${updatedOrder?.status}, vendorStatus: ${oldVendorStatus} → ${updatedOrder?.vendorStatus}`);

    return res.status(200).json({ received: true, success: true, order: formatOrder(updatedOrder) });
  } catch (err) {
    return res.status(500).json({ success: false, error: err instanceof Error ? err.message : "Webhook processing failed" });
  }
});

router.get("/status", async (_req: Request, res: Response) => {
  try {
    const products = await allenDataHubService.getProducts();
    return res.json({ success: true, status: "online", productsCount: products.length });
  } catch (err) {
    return res.status(502).json({
      success: false,
      status: "offline",
      error: err instanceof Error ? err.message : "Unable to reach AllenDataHub",
    });
  }
});

export default router;
