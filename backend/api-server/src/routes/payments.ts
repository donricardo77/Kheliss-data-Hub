import { Router, type Request, type Response } from "express";
import { createHmac } from "crypto";
import { Order } from "../models/Order";
import { User } from "../models/User";
import { WalletTransaction } from "../models/WalletTransaction";
import { Product } from "../models/Product";
import { requireAuth } from "../lib/auth-middleware";
import allenDataHubService from "../lib/allendatahub";
import { formatPhoneNumber, validatePhoneNumber } from "../lib/phone-utils";

const router = Router();

router.post("/initialize", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { orderId } = req.body;

    const order = await Order.findById(orderId);
    if (!order || order.userId.toString() !== user._id.toString()) {
      return res.status(404).json({ error: "Order not found" });
    }

    const paystackKey = process.env.PAYSTACK_SECRET_KEY;
    if (!paystackKey) {
      return res.status(503).json({ error: "Payment service not configured" });
    }

    const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${paystackKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: user.email,
        amount: Math.round(order.amount * 100),
        reference: order.paymentReference,
      }),
    });

    const data = await paystackRes.json() as any;
    if (!data.status) {
      return res.status(400).json({ error: "Payment initialization failed" });
    }

    return res.json({
      authorizationUrl: data.data.authorization_url,
      accessCode: data.data.access_code,
      reference: data.data.reference,
    });
  } catch (err) {
    req.log.error({ err }, "Initialize payment error");
    return res.status(500).json({ error: "Server error" });
  }
});

router.get("/verify/:reference", requireAuth, async (req: Request, res: Response) => {
  try {
    const { reference } = req.params;
    const user = (req as any).user;
    const paystackKey = process.env.PAYSTACK_SECRET_KEY;

    if (!paystackKey) {
      return res.status(503).json({ error: "Payment service not configured" });
    }

    const paystackRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${paystackKey}` },
    });

    const data = await paystackRes.json() as any;

    if (!data.status || data.data.status !== "success") {
      return res.json({ status: "failed", message: "Payment not successful" });
    }

    // Check if order already exists
    let order = await Order.findOne({ paymentReference: reference });
    
    const metadata = data.data.metadata;
    
    // Handle wallet fund transactions (no Order created for these)
    // NOTE: Wallet funds are ONLY processed via webhook to prevent double crediting
    if (metadata?.type === "wallet_fund") {
      req.log.info(`Payment verification: Wallet fund detected. Processing via webhook only. Reference: ${reference}`);
      return res.json({
        status: "success",
        message: "Payment verified - wallet fund will be processed via webhook",
        isWalletFund: true,
        reference,
      });
    }
    
    if (!order) {
      // Order doesn't exist - create it from Paystack metadata
      // Use idempotencyKey to prevent duplicate order creation
      const idempotencyKey = metadata?.idempotencyKey;
      if (idempotencyKey) {
        const existingOrder = await Order.findOne({ idempotencyKey });
        if (existingOrder) {
          req.log.warn(`Payment verification: Order already created with idempotencyKey: ${idempotencyKey}. Order ID: ${existingOrder._id}`);
          order = existingOrder;
          return res.json({
            status: "success",
            message: "Payment verified",
            order: {
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
            },
          });
        }
      }
      
      req.log.info(`Payment verification: Creating order from Paystack metadata. Reference: ${reference}`);
      
      try {
        const userId = metadata?.userId || user._id.toString();
        const productId = metadata?.productId;
        const recipientPhone = metadata?.recipientPhone;
        const productName = metadata?.productName;
        const username = metadata?.username || user.username;

        if (!productId || !recipientPhone) {
          req.log.error(`Payment verification: Missing metadata for order creation. ProductId: ${productId}, Phone: ${recipientPhone}`, { metadata });
          return res.json({ status: "success", message: "Payment verified but order creation failed: missing required fields" });
        }

        const product = await Product.findById(productId);
        if (!product) {
          req.log.error(`Payment verification: Product ${productId} not found in database`);
          return res.json({ status: "success", message: "Payment verified but product not found in system" });
        }

        const amount = Number(data.data.amount) / 100;

        // Create order
        order = new Order({
          userId,
          username,
          productId,
          network: product.network,
          type: product.type,
          productName: product.name,
          recipientPhone,
          amount,
          status: "pending",
          paymentMethod: "paystack",
          paymentReference: reference,
          idempotencyKey,
          placedAt: new Date(),
        });
        await order.save();
        req.log.info(`✅ Payment verification: Order created successfully. Order ID: ${order._id}, Product: ${product.name}, Amount: ${amount}`);
      } catch (createErr) {
        req.log.error({ err: createErr }, `Payment verification: Failed to create order`);
        return res.json({ status: "success", message: "Payment verified but order creation failed: server error" });
      }
    }

    // Update order status and defer vendor fulfillment to the Paystack webhook flow
    if (order.status === "pending") {
      req.log.info(`Payment verification: Order ${order._id} payment confirmed, processing...`);

      // Product orders are fulfilled by the Paystack webhook handler.
      // Avoid duplicate vendor calls from the manual verification path.
      if (order.paymentMethod === "paystack" && order.productId) {
        req.log.info(`Payment verification: Order ${order._id} is pending. Vendor fulfillment will be handled by webhook, not verification.`);
        return res.json({
          status: "success",
          message: "Payment verified - order is pending vendor fulfillment",
          order: {
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
          },
        });
      }

      if (order.paymentMethod !== "paystack" || !order.productId) {
        order.status = "completed";
        await order.save();
      }
    }

    return res.json({
      status: "success",
      message: "Payment verified",
      order: {
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
      },
    });
  } catch (err) {
    req.log.error({ err }, "Verify payment error");
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/webhook", async (req: Request, res: Response) => {
  try {
    // Verify Paystack signature for security
    const hash = createHmac('sha512', process.env.PAYSTACK_SECRET_KEY || "").update(JSON.stringify(req.body)).digest('hex');
    const paystackSignature = req.headers['x-paystack-signature'] as string;
    
    if (hash !== paystackSignature) {
      req.log.warn({ receivedHash: hash, receivedSig: paystackSignature }, "Invalid Paystack webhook signature");
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    const event = req.body;
    req.log.info({ event: event.event, reference: event.data?.reference }, "✅ Paystack webhook received (signature verified)");

    if (event.event === "charge.success") {
      const reference = event.data.reference;
      const metadata = event.data.metadata;
      req.log.info(`[Paystack Webhook] Processing charge.success for reference: ${reference}`);
      
      // Handle wallet fund transactions (no Order created for these)
      if (metadata?.type === "wallet_fund") {
        const amount = metadata.amount; // Use metadata amount (without 4% fee)
        const userId = metadata.userId;
        const adminFee = metadata.adminFee;
        const totalCharged = metadata.totalChargeAmount;
        
        req.log.info(`[Paystack Webhook] Processing wallet fund: ${amount} (with ${adminFee} admin fee, total: ${totalCharged}) for user ${userId}`);
        
        try {
          // Check if transaction already exists to prevent duplicates
          const existingTx = await WalletTransaction.findOne({ reference });
          if (existingTx) {
            req.log.info(`[Paystack Webhook] Transaction already processed for reference: ${reference}`);
            return res.status(200).json({ received: true });
          }
          
          const updatedUser = await User.findByIdAndUpdate(userId, {
            $inc: { walletBalance: amount, totalFunded: amount },
          }, { new: true });
          
          if (!updatedUser) {
            req.log.error(`[Paystack Webhook] User ${userId} not found`);
            return res.status(200).json({ received: true });
          }
          
          await WalletTransaction.create({
            userId,
            type: "credit",
            amount,
            description: `Wallet funded via Paystack (4% fee: ${adminFee})`,
            reference,
          });
          
          req.log.info(`✅ [Paystack Webhook] Wallet fund successful: ${amount} credited to user ${userId} (Fee: ${adminFee}), New Balance: ${updatedUser.walletBalance}`);
          return res.status(200).json({ received: true });
        } catch (walletErr) {
          req.log.error({ err: walletErr }, `[Paystack Webhook] Wallet fund failed`);
          return res.status(200).json({ received: true });
        }
      }
      
      // Handle product orders
      let order = await Order.findOne({ paymentReference: reference });
      if (!order) {
        // Create order from Paystack metadata if it doesn't exist
        if (metadata?.type === "product") {
          req.log.info(`[Paystack Webhook] Creating order from Paystack metadata for reference: ${reference}`);
          
          try {
            const user = await User.findById(metadata.userId);
            if (!user) {
              req.log.error(`[Paystack Webhook] User ${metadata.userId} not found for order creation`);
              return res.status(200).json({ received: true });
            }
            
            const product = await Product.findById(metadata.productId);
            if (!product) {
              req.log.error(`[Paystack Webhook] Product ${metadata.productId} not found for order creation`);
              return res.status(200).json({ received: true });
            }
            
            const isAgent = user.role === "agent" || user.role === "admin";
            const price = isAgent ? product.agentPrice : product.userPrice;
            
            order = new Order({
              userId: user._id,
              username: user.username,
              productId: metadata.productId,
              network: product.network,
              type: product.type,
              productName: product.name,
              recipientPhone: metadata.recipientPhone,
              amount: price,
              status: "pending", // Will be updated below
              paymentMethod: "paystack",
              paymentReference: reference,
              idempotencyKey: metadata.idempotencyKey,
              placedAt: metadata.placedAt ? new Date(metadata.placedAt) : new Date(),
              vendorOrderId: undefined,
              vendorReference: undefined,
              vendorProductId: product.vendorProductId || `${product.network}_${product.dataAmount}`,
              vendorStatus: undefined,
              webhookHistory: [],
            });
            
            await order.save();
            req.log.info(`[Paystack Webhook] Order created successfully: ${order._id}`);
          } catch (createErr) {
            req.log.error({ err: createErr }, `[Paystack Webhook] Failed to create order from metadata`);
            return res.status(200).json({ received: true });
          }
        } else {
          req.log.warn(`[Paystack Webhook] No order found for reference: ${reference} and no product metadata available.`);
          return res.status(200).json({ received: true });
        }
      }
      
      if (order.status === "pending" && (metadata?.type === "product" || order.productId)) {
req.log.info(`[Paystack Webhook] Order ${order._id} payment confirmed, calling AllenDataHub...`);
        
        // Try to call vendor API if this is a product order (not wallet fund)
        if (order.paymentMethod === "paystack" && order.productId && metadata?.type === "product") {
          try {
            const product = await Product.findById(order.productId);
            if (!product) {
              req.log.warn(`[Paystack Webhook] Product ${order.productId} not found`);
              order.status = "completed";
              await order.save();
              return res.status(200).json({ received: true });
            }
            
            const vendorProductId = product.vendorProductId || `${product.network}_${product.dataAmount}`;
            if (!product.vendorProductId) {
              req.log.info(`[Paystack Webhook] Product ${order.productId} has no explicit vendorProductId; falling back to ${vendorProductId}`);
            }

            if (validatePhoneNumber(order.recipientPhone)) {
              const formattedPhone = formatPhoneNumber(order.recipientPhone);
              req.log.info(`[Paystack Webhook] Calling AllenDataHub for order ${order._id}. Phone: ${order.recipientPhone} → ${formattedPhone}`);
              
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
              
              if (result && result.success) {
                order.vendorOrderId = result.transactionId || result.orderId;
                order.vendorReference = result.reference; // Store reference for webhook lookup
                order.vendorWebhookUrl = webhookTarget;
                order.vendorProductId = vendorProductId;
                order.vendorStatus = result.status || "pending";
                order.status = "processing";
                req.log.info(`✅ [Paystack Webhook] AllenDataHub order created successfully. Vendor Order ID: ${order.vendorOrderId}`);
              } else {
                req.log.warn(`❌ [Paystack Webhook] AllenDataHub API failed: ${result?.error || "Unknown error"}`);
                order.status = "failed";
              }
            } else {
              req.log.warn(`[Paystack Webhook] Invalid phone number: ${order.recipientPhone}`);
              order.status = "failed";
            }
          } catch (vendorErr) {
            req.log.warn({ err: vendorErr }, `[Paystack Webhook] AllenDataHub call failed: ${vendorErr instanceof Error ? vendorErr.message : "unknown error"}`);
            order.status = "failed";
          }
        } else {
          // Mark as completed if it's a wallet fund or no product
          req.log.info(`[Paystack Webhook] Non-product order, marking as completed`);
          order.status = "completed";
        }

        await order.save();
        req.log.info(`[Paystack Webhook] Order ${order._id} saved with status: ${order.status}`);
      } else {
        req.log.warn(`[Paystack Webhook] Order already processed. Current status: ${order.status}`);
      }

      return res.json({ received: true });
    }

    return res.json({ received: true });
  } catch (err) {
    req.log.error({ err }, "Webhook error");
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
