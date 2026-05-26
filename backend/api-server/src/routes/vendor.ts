import { Router, type Request, type Response } from "express";
import allenDataHubService from "../lib/allendatahub";
import { Order } from "../models/Order";
import { Product } from "../models/Product";
import { requireAuth } from "../lib/auth-middleware";

const router = Router();

function normalizeAllenDataHubStatus(status?: string | null) {
  if (!status) {
    return { mappedStatus: undefined, vendorStatus: undefined };
  }

  const normalized = String(status).trim().toLowerCase();
  const completedStatuses = new Set(["delivered", "resolved", "success", "complete", "completed", "fulfilled"]);
  const failedStatuses = new Set(["failed", "cancelled", "canceled", "refunded", "error", "rejected"]);
  const processingStatuses = new Set(["processing", "in_progress", "in-progress", "running", "started"]);
  const pendingStatuses = new Set(["pending", "queued", "waiting", "submitted", "received"]);

  let mappedStatus: "pending" | "processing" | "completed" | "failed" | undefined;
  if (completedStatuses.has(normalized)) {
    mappedStatus = "completed";
  } else if (failedStatuses.has(normalized)) {
    mappedStatus = "failed";
  } else if (processingStatuses.has(normalized)) {
    mappedStatus = "processing";
  } else if (pendingStatuses.has(normalized)) {
    mappedStatus = "pending";
  }

  return { mappedStatus, vendorStatus: normalized };
}

/**
 * POST /api/vendor/purchase
 * Purchase a data bundle from AllenDataHub
 */
router.post("/purchase", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { phoneNumber, bundleSize, network, productId, webhookUrl } = req.body;

    if (!phoneNumber || (!bundleSize && !productId) || (!network && !productId)) {
      return res.status(400).json({
        error: "Missing required fields: phoneNumber and either productId or (bundleSize and network)",
      });
    }

    let resolvedNetwork = network;
    let resolvedVolume = bundleSize !== undefined ? Number(bundleSize) : undefined;
    let productName = `${network} ${bundleSize}GB`;

    if (productId && (!resolvedNetwork || !resolvedVolume)) {
      const product = await Product.findById(productId);
      if (!product) {
        return res.status(400).json({ error: `Product with ID '${productId}' not found` });
      }
      resolvedNetwork = product.network;
      resolvedVolume = Number(String(product.dataAmount).replace(/\D/g, ""));
      productName = product.name;
    }

    if (!resolvedNetwork || !resolvedVolume || Number.isNaN(resolvedVolume)) {
      return res.status(400).json({
        error: "Missing or invalid network/volume. Provide productId or both network and bundleSize.",
      });
    }

    const webhookTarget = webhookUrl || `${req.protocol}://${req.get("host")}/api/vendor/allen-datahub/webhook`;
    const result = await allenDataHubService.purchaseDataBundle({
      phoneNumber,
      network: resolvedNetwork,
      volume: resolvedVolume,
      webhookUrl: webhookTarget,
    });

    if (!result || !result.success) {
      return res.status(400).json({
        error: result?.error || "Unknown error",
      });
    }

    // Create corresponding order in our system
    const order = new Order({
      userId: user._id,
      username: user.username,
      vendorOrderId: result.orderId || result.transactionId,
      vendorReference: result.reference,
      vendorWebhookUrl: webhookTarget,
      vendorProductId: `${resolvedNetwork}_${resolvedVolume}`,
      vendorPhoneNumber: phoneNumber,
      network: resolvedNetwork,
      type: "data",
      productName,
      recipientPhone: phoneNumber,
      amount: result.amount || 0,
      status: "pending",
      paymentMethod: "wallet",
      paymentReference: result.reference,
      vendorStatus: result.status,
      webhookHistory: [],
    });

    await order.save();
    req.log.info(
      `AllenDataHub order created. Order ID: ${order._id}, Vendor ID: ${order.vendorOrderId}`
    );

    return res.status(201).json({
      order: {
        id: order._id.toString(),
        vendorOrderId: result.orderId || result.transactionId,
        status: order.status,
        vendorStatus: result.status,
        amount: result.amount,
        message: result.message,
        createdAt: order.createdAt,
      },
    });
  } catch (err) {
    req.log.error({ err }, "AllenDataHub order error");
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /api/vendor/orders
 * Get user's AllenDataHub orders from database
 */
router.get("/orders", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { page = 1, limit = 20 } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    const orders = await Order.find({ userId: user._id })
      .skip(skip)
      .limit(Number(limit))
      .sort({ createdAt: -1 });

    const total = await Order.countDocuments({ userId: user._id });

    return res.json({
      orders,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err) {
    req.log.error({ err }, "Get vendor orders error");
    return res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to fetch orders",
    });
  }
});

/**
 * GET /api/vendor/orders/:vendorOrderId
 * Get specific vendor order details from local database
 */
router.get("/orders/:vendorOrderId", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { vendorOrderId } = req.params;

    // Query the order from database
    const order = await Order.findOne({ 
      vendorOrderId,
      userId: user._id 
    });

    if (!order) {
      return res.status(404).json({ error: "Vendor order not found" });
    }

    return res.json({
      vendorOrderId: order.vendorOrderId,
      orderId: order._id.toString(),
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
    });
  } catch (err) {
    req.log.error({ err }, "Get vendor order details error");
    return res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to fetch vendor order",
    });
  }
});

/**
 * POST /api/vendor/webhook
 * Receive webhook from vendor for order status updates
 */
router.post("/webhook", async (req: Request, res: Response) => {
  try {
    const rawPayload = req.body;
    req.log.info({ payload: rawPayload }, "🔔 AllenDataHub webhook received (raw)");

    // Process and validate webhook payload using AllenDataHub
    const webhookResult = allenDataHubService.processWebhookPayload(rawPayload);
    
    if (!webhookResult.success) {
      req.log.warn(`[AllenDataHub Webhook] Invalid payload: ${webhookResult.error}`);
      return res.status(200).json({ received: true, status: "invalid_payload" });
    }

    const { orderId, reference, status } = webhookResult;
    const { mappedStatus, vendorStatus } = normalizeAllenDataHubStatus(status);

    if (!mappedStatus || (!orderId && !reference)) {
      req.log.warn(`[AllenDataHub Webhook] Ignored webhook because status or order reference could not be determined: event=${webhookResult.event}, status=${status}, orderId=${orderId}, reference=${reference}`);
      return res.status(200).json({ received: true, status: "ignored" });
    }

    // Find order using multiple lookup strategies (in order of priority)
    let order = null;
    const lookupStrategies = [
      { vendorOrderId: orderId },                    // Primary: by vendor order ID
      { vendorReference: reference },               // Secondary: by vendor reference
      { paymentReference: reference },              // Tertiary: by payment reference
      { vendorOrderId: reference },                 // Fallback: reference might be the orderId
    ];

    for (const query of lookupStrategies) {
      order = await Order.findOne(query);
      if (order) {
        req.log.info(`[AllenDataHub Webhook] Order found using strategy: ${JSON.stringify(query)}`);
        break;
      }
    }

    if (order) {
      const oldStatus = order.vendorStatus || order.status;

      order.vendorStatus = mappedStatus;
      if (mappedStatus === "completed") {
        order.status = "completed";
        req.log.info(`✅ [AllenDataHub Webhook] Order ${order._id} completed. Vendor ID: ${orderId}`);
      } else if (mappedStatus === "failed") {
        order.status = "failed";
        req.log.error(`❌ [AllenDataHub Webhook] Order ${order._id} failed. Vendor ID: ${orderId}. Reason: ${status}`);
      } else {
        order.status = "processing";
        req.log.info(`⏳ [AllenDataHub Webhook] Order ${order._id} status updated to processing. Vendor ID: ${orderId}`);
      }

      if (!order.webhookHistory) order.webhookHistory = [];
      order.webhookHistory.push({
        status: vendorStatus,
        timestamp: webhookResult.timestamp,
        rawPayload,
      });

      await order.save();
      req.log.info(`[AllenDataHub Webhook] Order ${order._id} updated: ${oldStatus} → ${order.status} (${vendorStatus})`);
    } else {
      req.log.warn(`[AllenDataHub Webhook] ⚠️ No local order found for vendor order: ${orderId}. Reference: ${reference}. Tried lookups: ${JSON.stringify(lookupStrategies)}`);
      req.log.warn(`[AllenDataHub Webhook] Webhook payload for debugging:`, rawPayload);
    }

    // Always respond with 200 to acknowledge receipt
    return res.status(200).json({ received: true });
  } catch (err) {
    req.log.error({ err }, "AllenDataHub webhook error");
    return res.status(500).json({ error: "Webhook processing failed" });
  }
});

/**
 * GET /api/vendor/status
 * Check vendor service health
 */
router.get("/status", async (req: Request, res: Response) => {
  try {
    // Try to fetch products to verify connection
    const products = await allenDataHubService.getProducts();

    return res.json({
      status: "online",
      message: "Vendor service is operational",
      productsCount: products.length,
    });
  } catch (err) {
    req.log.error({ err }, "Vendor status check failed");
    return res.json({
      status: "error",
      message:
        err instanceof Error ? err.message : "Failed to reach vendor service",
    });
  }
});

export default router;
