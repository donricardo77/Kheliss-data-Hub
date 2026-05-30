import { Router, type Request, type Response } from "express";
import { Order } from "../models/Order";
import { User } from "../models/User";
import { Product } from "../models/Product";
import { WalletTransaction } from "../models/WalletTransaction";
import { requireAuth } from "../lib/auth-middleware";
import allenDataHubService from "../lib/allendatahub";
import { formatPhoneNumber, validatePhoneNumber } from "../lib/phone-utils";

const router = Router();

router.get("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { status, network, limit = 20, page = 1 } = req.query;

    const filter: any = {};
    if (user.role !== "admin") {
      filter.userId = user._id;
    }
    if (status) filter.status = status;
    if (network) filter.network = network;

    const skip = (Number(page) - 1) * Number(limit);
    const total = await Order.countDocuments(filter);
    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    return res.json({
      orders: orders.map(formatOrder),
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
    });
  } catch (err) {
    req.log.error({ err }, "Get orders error");
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { productId, recipientPhone, paymentMethod } = req.body;

    if (!productId || !recipientPhone || !paymentMethod) {
      return res.status(400).json({ error: "Missing required fields: productId, recipientPhone, paymentMethod" });
    }

    // Fetch product from database instead of static data
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(400).json({ error: `Product with ID '${productId}' not found in database` });
    }

    // ===== IDEMPOTENCY CHECK =====
    // Prevent duplicate orders from retried requests, but allow new orders after delivery
    const idempotencyKey = req.headers['idempotency-key'] as string || 
                          `${user._id}-${productId}-${recipientPhone}-${paymentMethod}`;
    
    const existingOrder = await Order.findOne({ idempotencyKey, userId: user._id });
    if (existingOrder && existingOrder.status !== "completed") {
      req.log.info(`⚠️  Duplicate order request detected. Returning existing order: ${existingOrder._id}`);
      return res.status(201).json({
        order: formatOrder(existingOrder),
        message: "Order already exists (idempotent request)",
        isDuplicate: true,
      });
    }

    const isAgent = user.role === "agent" || user.role === "admin";
    const price = isAgent ? product.agentPrice : product.userPrice;

    // Validate payment method
    if (paymentMethod !== "wallet" && paymentMethod !== "paystack") {
      return res.status(400).json({ error: `Invalid payment method: '${paymentMethod}'. Use 'wallet' or 'paystack'` });
    }

    // Validate wallet payment requirements
    if (paymentMethod === "wallet") {
      if (!isAgent) {
        return res.status(403).json({ error: "Wallet payment is only available for agents" });
      }
      if (!user.isVerified) {
        return res.status(403).json({ error: "Your agent account must be verified to use wallet" });
      }
      if (user.walletBalance < price) {
        return res.status(400).json({ error: `Insufficient wallet balance. Required: ${price}, Available: ${user.walletBalance}` });
      }
    }

    // ===== FOR WALLET: CALL AllenDataHub IMMEDIATELY =====
    // ===== FOR PAYSTACK: WAIT FOR WEBHOOK CONFIRMATION =====
    let vendorOrderId: string | undefined;
    let vendorReference: string | undefined;
    let vendorProductId = product.vendorProductId || `${product.network}_${product.dataAmount}`;
    let vendorError: string | undefined;
    let vendorWebhookUrl: string | undefined;

    // Only call AllenDataHub for wallet payments (user has sufficient balance already)
    // For Paystack, we wait for the webhook to confirm payment before calling the vendor
    if (paymentMethod === "wallet" && validatePhoneNumber(recipientPhone)) {
      try {
        const formattedPhone = formatPhoneNumber(recipientPhone);
        req.log.info(`📞 [AllenDataHub] Calling vendor for wallet payment. Product: ${productId}, Phone: ${recipientPhone} → ${formattedPhone}`);

        const volume = Number(String(product.dataAmount).replace(/\D/g, ""));
        if (!volume || Number.isNaN(volume)) {
          throw new Error(`Invalid data amount for AllenDataHub: ${product.dataAmount}`);
        }

        const webhookTarget = `${req.protocol}://${req.get("host")}/api/vendor/allen-datahub/webhook`;
        const result = await allenDataHubService.purchaseDataBundle({
          phoneNumber: formattedPhone,
          network: product.network,
          volume,
          webhookUrl: webhookTarget,
        });

        if (!result) {
          throw new Error(`AllenDataHub service returned empty result`);
        }

        if (result.success) {
          vendorOrderId = result.orderId || result.transactionId;
          vendorReference = result.reference;
          vendorWebhookUrl = webhookTarget;
          req.log.info(`✅ [AllenDataHub] Order created successfully. Vendor ID: ${vendorOrderId}`);
        } else {
          vendorError = result?.error || "Unknown AllenDataHub error";
          req.log.error(`❌ [AllenDataHub] API failed: ${vendorError}`);
          return res.status(502).json({ 
            error: `AllenDataHub order failed: ${vendorError}. Your wallet has NOT been charged. Please try again.`,
            vendorError
          });
        }
      } catch (vendorErr) {
        vendorError = vendorErr instanceof Error ? vendorErr.message : "AllenDataHub API error";
        req.log.error({ err: vendorErr }, `❌ [AllenDataHub] CRITICAL: Vendor API call failed: ${vendorError}`);
        return res.status(502).json({ 
          error: `AllenDataHub communication failed: ${vendorError}. Your wallet has NOT been charged. Please try again.`,
          vendorError
        });
      }
    }
    
    // Validate phone number for Paystack orders too (vendor call happens later on webhook confirmation)
    if (!validatePhoneNumber(recipientPhone)) {
      req.log.error(`❌ Invalid phone number: ${recipientPhone}`);
      return res.status(400).json({ 
        error: `Invalid phone number. Must be valid Ghana number.`,
        recipientPhone
      });
    }

    // ===== WALLET PAYMENT FLOW =====
    if (paymentMethod === "wallet") {
      const reference = `WALLET-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      
      const order = new Order({
        userId: user._id,
        username: user.username,
        productId,
        network: product.network,
        type: product.type,
        productName: product.name,
        recipientPhone,
        amount: price,
        status: "processing", // Start as processing to sync with vendor
        paymentMethod: "wallet",
        paymentReference: reference,
        idempotencyKey,
        vendorOrderId,
        vendorReference,
        vendorWebhookUrl,
        vendorProductId,
        vendorStatus: vendorOrderId ? "pending" : undefined,
        webhookHistory: [],
      });
      await order.save();

      await User.findByIdAndUpdate(user._id, {
        $inc: { walletBalance: -price, totalSpent: price },
      });

      await WalletTransaction.create({
        userId: user._id,
        type: "debit",
        amount: price,
        description: `Purchase: ${product.name} for ${recipientPhone}`,
        reference,
      });

      req.log.info(`Order placed successfully. Order ID: ${order._id}, Reference: ${reference}${vendorOrderId ? `, Vendor Order ID: ${vendorOrderId}` : ""}`);
      return res.status(201).json({
        order: formatOrder(order),
        message: vendorOrderId ? "Order placed - processing via vendor" : "Order placed - awaiting processing",
        vendorOrderId,
        vendorError,
      });
    }

    // ===== PAYSTACK PAYMENT FLOW =====
    // IMPORTANT: For Paystack, we DO NOT create the order until payment is confirmed
    // This prevents orders from appearing as placed before payment is actually made
    // The order will be created when the Paystack webhook confirms payment
    const reference = `PAY-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const paystackKey = process.env.PAYSTACK_SECRET_KEY;
    let paymentUrl: string | undefined;
    let paystackError: string | undefined;

    if (paystackKey && paystackKey !== "sk_test_placeholder") {
      try {
        const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${paystackKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: user.email,
            amount: Math.round(price * 100),
            reference,
            // Store order metadata in Paystack for webhook to use when creating order
            metadata: { 
              type: "product",
              userId: user._id.toString(),
              username: user.username,
              productId,
              recipientPhone,
              paymentMethod: "paystack",
              idempotencyKey,
              productName: product.name,
              placedAt: new Date().toISOString(),
            },
          }),
        });

        const paystackData = await paystackRes.json() as any;
        if (paystackData.status && paystackData.data?.authorization_url) {
          paymentUrl = paystackData.data.authorization_url;
          req.log.info(`🔗 Paystack payment URL generated (order will be created after payment): ${paymentUrl}`);
        } else {
          paystackError = paystackData.message || "Failed to initialize Paystack payment";
          req.log.warn(`Paystack initialization failed: ${paystackError}`);
        }
      } catch (err) {
        paystackError = err instanceof Error ? err.message : "Paystack connection error";
        req.log.warn({ err }, "Paystack initialization error");
      }
    } else {
      req.log.info("Paystack not configured with valid key, returning error");
      paystackError = "Payment service not configured";
    }

    if (!paymentUrl) {
      return res.status(503).json({
        error: paystackError || "Failed to initialize payment",
        message: "Could not generate payment URL. Please try again.",
      });
    }

    return res.status(200).json({
      paymentUrl,
      reference,
      message: "Proceed to payment - order will be created after payment is confirmed",
    });
  } catch (err) {
    req.log.error({ err }, "Create order error");
    const errorMessage = err instanceof Error ? err.message : "Failed to create order";
    return res.status(500).json({ error: errorMessage });
  }
});

router.get("/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (user.role !== "admin" && order.userId.toString() !== user._id.toString()) {
      return res.status(403).json({ error: "Forbidden" });
    }

    return res.json(formatOrder(order));
  } catch (err) {
    req.log.error({ err }, "Get order error");
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * POST /api/orders/:id/sync
 * Sync order status with vendor API
 */
function normalizeVendorStatus(status?: string | null) {
  if (!status) {
    return { mappedStatus: undefined, rawStatus: undefined };
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

  return { mappedStatus, rawStatus: normalized };
}

router.post("/:id/sync", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (user.role !== "admin" && order.userId.toString() !== user._id.toString()) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (!order.vendorOrderId) {
      req.log.info(`Order has no vendor order ID. Order ID: ${order._id}`);
      return res.json({
        message: "Order has no vendor order to sync",
        order: formatOrder(order),
      });
    }

    req.log.info(`Order status sync requested. Order ID: ${order._id}, Vendor Order ID: ${order.vendorOrderId}`);

    try {
      const vendorData = await allenDataHubService.getOrder(order.vendorOrderId);
      const vendorStatus = vendorData?.status || vendorData?.state || vendorData?.vendorStatus || vendorData?.orderStatus || vendorData?.statusCode;
      const vendorReference = vendorData?.reference || vendorData?.requestId || vendorData?.vendorReference || vendorData?.clientOrderReference || vendorData?.transactionId;
      const { mappedStatus, rawStatus } = normalizeVendorStatus(vendorStatus);

      if (vendorReference) {
        order.vendorReference = vendorReference;
      }

      if (rawStatus) {
        // store the raw vendor-facing status separately
        order.vendorStatus = rawStatus;
      }

      const oldOrderStatus = order.status;
      const isFinal = oldOrderStatus === "completed" || oldOrderStatus === "failed";

      if (mappedStatus) {
        if (mappedStatus === "completed") {
          order.status = "completed";
        } else if (mappedStatus === "failed") {
          order.status = "failed";
        } else if (!isFinal) {
          order.status = "processing";
        }
      }

      if (!order.webhookHistory) order.webhookHistory = [];
      order.webhookHistory.push({
        mappedStatus: mappedStatus,
        vendorStatus: rawStatus || String(vendorStatus || ""),
        timestamp: new Date(),
        rawPayload: vendorData,
      });

      await order.save();
      req.log.info(`Order status refreshed from vendor. Order ID: ${order._id}, Local Status: ${order.status}, Vendor Status: ${order.vendorStatus}`);

      return res.json({
        message: "Vendor status refreshed",
        order: formatOrder(order),
        vendorData,
      });
    } catch (vendorErr) {
      req.log.error({ err: vendorErr }, "Vendor sync failed");
      return res.status(502).json({
        error: vendorErr instanceof Error ? vendorErr.message : "Failed to fetch vendor order status",
        order: formatOrder(order),
      });
    }
  } catch (err) {
    req.log.error({ err }, "Sync order error");
    return res.status(500).json({ error: "Server error" });
  }
});

function formatOrder(order: any) {
  return {
    id: order._id.toString(),
    userId: order.userId.toString(),
    username: order.username,
    network: order.network,
    type: order.type,
    productName: order.productName,
    recipientPhone: order.recipientPhone,
    amount: order.amount,
    status: order.status,
    paymentMethod: order.paymentMethod,
    paymentReference: order.paymentReference,
    vendorOrderId: order.vendorOrderId,
    vendorStatus: order.vendorStatus,
    placedAt: order.placedAt,
    createdAt: order.createdAt,
  };
}

export { formatOrder };
export default router;
