import { Router, type Request, type Response } from "express";
import { createHmac } from "crypto";
import { Order } from "../models/Order";
import { User } from "../models/User";
import { WalletTransaction } from "../models/WalletTransaction";
import { Product } from "../models/Product";
import allenDataHubService from "../lib/allendatahub";
import { formatPhoneNumber, validatePhoneNumber } from "../lib/phone-utils";

const router = Router();

/**
 * Paystack webhook endpoint
 * This handles payment notifications from Paystack
 * 
 * Expected at: POST /api/paystack/webhook
 */
router.post("/webhook", async (req: Request, res: Response) => {
  try {
    // Verify Paystack signature for security
    const rawBody = req.rawBody || JSON.stringify(req.body);
    const hash = createHmac('sha512', process.env.PAYSTACK_SECRET_KEY || "").update(rawBody).digest('hex');
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

      // Handle wallet fund transactions first because they do not create an Order.
      if (metadata?.type === "wallet_fund") {
        const amount = metadata.amount;
        const userId = metadata.userId;
        const adminFee = metadata.adminFee;
        const totalCharged = metadata.totalChargeAmount;

        req.log.info(`[Paystack Webhook] Processing wallet fund: ${amount} (with ${adminFee} admin fee, total: ${totalCharged}) for user ${userId}`);

        try {
          const existingTx = await WalletTransaction.findOne({ reference });
          if (existingTx) {
            req.log.info(`[Paystack Webhook] Transaction already processed for reference: ${reference}`);
            return res.status(200).json({ received: true });
          }

          const updatedUser = await User.findByIdAndUpdate(
            userId,
            {
              $inc: { walletBalance: amount, totalFunded: amount },
            },
            { new: true },
          );

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
      
      // Check for existing order using idempotency key from metadata
      const idempotencyKey = metadata?.idempotencyKey;
      let order = await Order.findOne({ idempotencyKey, paymentMethod: "paystack" });
      
      if (!order && idempotencyKey) {
        // Order doesn't exist yet - create it from metadata (first time payment confirmed)
        req.log.info(`[Paystack Webhook] Creating order from payment metadata. Reference: ${reference}`);
        
        try {
          const userId = metadata?.userId;
          const username = metadata?.username;
          const productId = metadata?.productId;
          const recipientPhone = metadata?.recipientPhone;
          const productName = metadata?.productName;

          if (!userId || !productId || !recipientPhone) {
              req.log.error({ metadata }, `[Paystack Webhook] Missing required metadata for order creation`);
            return res.status(200).json({ received: true });
          }

          const product = await Product.findById(productId);
          if (!product) {
            req.log.warn(`[Paystack Webhook] Product ${productId} not found, cannot create order`);
            return res.status(200).json({ received: true });
          }

          const amount = Number(event.data.amount) / 100;

          // Create order with status "pending"
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
          });
          await order.save();
          req.log.info(`[Paystack Webhook] Order created successfully. Order ID: ${order._id}`);
        } catch (createErr) {
          req.log.error({ err: createErr }, `[Paystack Webhook] Failed to create order from metadata`);
          return res.status(200).json({ received: true });
        }
      }
      
      if (!order) {
        req.log.warn(`[Paystack Webhook] No order found for reference: ${reference}`);
        return res.status(200).json({ received: true });
      }

      // Update order status and call vendor if needed
      if (order.status === "pending") {
        req.log.info(`[Paystack Webhook] Order ${order._id} payment confirmed, processing order...`);
        
        // Try to call vendor API if this is a product order
        if (order.paymentMethod === "paystack" && order.productId) {
          try {
            const product = await Product.findById(order.productId);
            if (!product) {
              req.log.warn(`[Paystack Webhook] Product ${order.productId} not found`);
              order.status = "completed";
              await order.save();
              return res.status(200).json({ received: true });
            }
            
            const vendorProductId = product.vendorProductId || `${product.network}_${product.dataAmount}`;
            
            if (validatePhoneNumber(order.recipientPhone)) {
              const formattedPhone = formatPhoneNumber(order.recipientPhone);
              const volume = Number(String(product.dataAmount).replace(/\D/g, ""));
              if (!volume || Number.isNaN(volume)) {
                throw new Error(`Invalid data amount for AllenDataHub: ${product.dataAmount}`);
              }
              req.log.info(`[Paystack Webhook] Calling AllenDataHub for order ${order._id}. Phone: ${order.recipientPhone} → ${formattedPhone}`);

              const webhookTarget = `${req.protocol}://${req.get("host")}/api/vendor/allen-datahub/webhook`;
              const result = await allenDataHubService.purchaseDataBundle({
                phoneNumber: formattedPhone,
                network: product.network,
                volume,
                webhookUrl: webhookTarget,
              });

              if (result && result.success) {
                order.vendorOrderId = result.orderId || result.transactionId;
                order.vendorReference = result.reference; // Store reference for webhook lookup
                order.vendorWebhookUrl = webhookTarget;
                order.vendorProductId = vendorProductId;
                order.vendorStatus = result.status || "pending";
                // Keep the order pending until the vendor sends a status webhook
                order.status = "pending";
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
            // Mark order as failed if AllenDataHub call fails
            order.status = "failed";
          }
        } else {
          // Non-product order (wallet fund) - mark as completed
          req.log.info(`[Paystack Webhook] Non-product order, marking as completed`);
          order.status = "completed";
        }

        await order.save();
        req.log.info(`[Paystack Webhook] Order ${order._id} saved with status: ${order.status}`);
      } else {
        req.log.warn(`[Paystack Webhook] Order already processed. Current status: ${order.status}`);
      }
    }

    return res.json({ received: true });
  } catch (err) {
    req.log.error({ err }, "Webhook error");
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
