/**
 * Portal-02 Vendor API Service
 * Handles all communication with Portal-02.com API for data bundle purchases
 * 
 * @see https://www.portal-02.com/api/docs
 */

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface Portal02RequestPayload {
  type: "single";
  volume: number;
  phone: string;
  offerSlug: string;
  webhookUrl: string;
  reference?: string;
}

interface Portal02SuccessResponse {
  success: true;
  transactionId: string;
  reference: string;
  status: "pending" | "processing" | "delivered" | "failed" | "cancelled" | "refunded" | "resolved";
  message: string;
  amount?: number;
  currency?: string;
  raw: Record<string, any>;
}

interface Portal02ErrorResponse {
  success: false;
  platform: "Portal-02.com";
  error: string;
  code: number;
  details: Record<string, any> | null;
}

type PurchaseResult = Portal02SuccessResponse | Portal02ErrorResponse;

interface WebhookPayload {
  success: true;
  event: string;
  orderId: string;
  reference: string;
  status: string;
  recipient?: string;
  volume?: number;
  timestamp: Date;
}

interface WebhookErrorPayload {
  success: false;
  error: string;
}

type WebhookResult = WebhookPayload | WebhookErrorPayload;

// ============================================================================
// CONFIGURATION
// ============================================================================

const API_KEY = process.env.PORTAL02_API_KEY || "dk_WZqU3-BTai3q4IuEoOXqc6IHVfGkAmaH";
const BASE_URL = process.env.PORTAL02_BASE_URL || "https://www.portal-02.com/api/v1";
const BACKEND_URL = process.env.BACKEND_URL || process.env.VITE_API_URL || "http://localhost:5000";
const FETCH_TIMEOUT = 30000; // 30 seconds

// ⚠️ CRITICAL: Validate BACKEND_URL in production
if (process.env.NODE_ENV === "production") {
  if (!process.env.BACKEND_URL) {
    console.error(
      "🚨 CRITICAL: BACKEND_URL is not set in production! Portal-02 webhooks will fail silently.\n" +
      "Set BACKEND_URL environment variable to your production backend domain (e.g., https://api.yourdomain.com)"
    );
  } else if (BACKEND_URL.includes("localhost")) {
    console.error(
      "🚨 CRITICAL: BACKEND_URL contains 'localhost' in production! Portal-02 cannot send webhooks to localhost.\n" +
      "Update BACKEND_URL to your production backend domain."
    );
  }
}

const offerSlugs: Record<string, string> = {
  MTN: "master_beneficiary_data_bundle",
  Telecel: "telecel_expiry_bundle",
  AirtelTigo: "ishare_data_bundle",
};

const availableVolumes: Record<string, number[]> = {
  MTN: [1, 2, 3, 4, 5, 6, 7, 8, 10, 15, 20, 25, 30, 40, 50, 100],
  Telecel: [5, 10, 15, 20, 25, 30, 40, 50, 100],
  AirtelTigo: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 20],
};

const networkToEndpoint: Record<string, string> = {
  MTN: "mtn",
  Telecel: "telecel",
  AirtelTigo: "at",
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Standardizes phone numbers to international format (233XXXXXXXXX)
 * 
 * Supports multiple input formats:
 * - Local format: "0241234567" → "233241234567"
 * - International: "+233241234567" → "233241234567"
 * - Plain: "241234567" → "233241234567"
 * 
 * @param phone - Phone number in any format
 * @returns Formatted phone number (233XXXXXXXXX)
 */
function formatPhoneNumber(phone: string): string {
  if (!phone) return "";
  let cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("0") && cleaned.length === 10) cleaned = "233" + cleaned.substring(1);
  else if (cleaned.startsWith("+233")) cleaned = cleaned.substring(1);
  else if (cleaned.length === 9) cleaned = "233" + cleaned;
  return cleaned;
}

/**
 * Extracts numeric GB value from product data
 * 
 * Handles multiple formats:
 * - String: "10GB" → 10
 * - Number: 10 → 10
 * - Mixed: "10gb" → 10
 * 
 * @param size - Bundle size in any format
 * @returns Numeric GB value
 */
function extractVolumeNumber(size: string | number): number {
  if (typeof size === "number") return size;
  const match = String(size).match(/(\d+(\.\d+)?)/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Validates if requested volume is available for network
 * 
 * @param network - Network name (MTN, Telecel, AirtelTigo)
 * @param volume - GB volume to check
 * @returns true if volume is available for network
 */
function isVolumeAvailable(network: string, volume: number): boolean {
  const volumes = availableVolumes[network];
  return volumes ? volumes.includes(volume) : false;
}

/**
 * Maps network to Portal-02 offer slug
 * 
 * @param network - Network name
 * @returns Portal-02 offer slug
 * @throws Error if network not found
 */
function getOfferSlug(network: string): string {
  const slug = offerSlugs[network];
  if (!slug) throw new Error(`No offer slug found for network: ${network}`);
  return slug;
}

/**
 * Maps network name to Portal-02 API endpoint
 * 
 * @param network - Network name
 * @returns API endpoint identifier
 */
function mapNetworkToEndpoint(network: string): string {
  return networkToEndpoint[network] || network.toLowerCase();
}

// ============================================================================
// PORTAL-02 SERVICE CLASS
// ============================================================================

/**
 * Portal-02 Data Bundle Service
 * 
 * Handles purchasing data bundles through Portal-02 API with:
 * - Multiple network support (MTN, Telecel, AirtelTigo)
 * - Phone number normalization
 * - Webhook payload processing
 * - Error handling and validation
 */
class Portal02Service {
  constructor() {
    console.log(`[Portal02] Initialized. Base: ${BASE_URL}, Webhook: ${BACKEND_URL}/api/vendor/webhook`);
  }

  /**
   * Purchase a data bundle from Portal-02
   * 
   * @param phoneNumber - Recipient phone number (any format)
   * @param bundleSize - Bundle size in GB (string or number)
   * @param network - Network name (MTN, Telecel, AirtelTigo)
   * @param orderReference - Optional order ID for tracking
   * @returns Portal02SuccessResponse or Portal02ErrorResponse
   * 
   * @example
   * const result = await portal02Service.purchaseDataBundle(
   *   "0241234567",
   *   "10GB",
   *   "MTN",
   *   "order_123"
   * );
   */
  async purchaseDataBundle(
    phoneNumber: string,
    bundleSize: string | number,
    network: string,
    orderReference?: string | null
  ): Promise<PurchaseResult> {
    try {
      const formattedPhone = formatPhoneNumber(phoneNumber);
      const volume = extractVolumeNumber(bundleSize);
      if (volume <= 0) {
        return { success: false, platform: "Portal-02.com", error: "Invalid bundle size", code: 400, details: null };
      }
      if (!isVolumeAvailable(network, volume)) {
        return { success: false, platform: "Portal-02.com", error: `${volume}GB not available for ${network}`, code: 422, details: null };
      }

      const offerSlug = getOfferSlug(network);
      const webhookUrl = `${BACKEND_URL}/api/vendor/webhook`;
      const payload: Record<string, unknown> = {
        type: "single",
        volume,
        phone: formattedPhone,
        offerSlug,
        webhookUrl,
      };
      if (orderReference) payload.reference = orderReference;

      const endpoint = mapNetworkToEndpoint(network);
      const url = `${BASE_URL}/order/${endpoint}`;

      // Set up timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "x-api-key": API_KEY,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      const data: any = await response.json().catch(() => ({}));
      if (!response.ok) {
        const msg = data.message || data.error || `HTTP ${response.status}`;
        return { success: false, platform: "Portal-02.com", error: msg, code: response.status, details: data };
      }
      return {
        success: true,
        transactionId: data.orderId || data.id,
        reference: data.reference || data.orderId,
        status: data.status || "pending",
        message: "Order submitted to Portal-02",
        amount: data.totalAmount,
        currency: data.currency,
        raw: data,
      };
    } catch (error: any) {
      // Handle timeout specifically
      if (error?.name === "AbortError") {
        return {
          success: false,
          platform: "Portal-02.com",
          error: `Request timeout after ${FETCH_TIMEOUT}ms`,
          code: 504,
          details: null,
        };
      }
      
      return {
        success: false,
        platform: "Portal-02.com",
        error: error?.message || "Network error",
        code: 500,
        details: null,
      };
    }
  }

  /**
   * Process Portal-02 webhook payload
   * 
   * Validates and extracts data from webhook notifications.
   * Handles multiple event types and status values.
   * 
   * @param payload - Webhook payload from Portal-02
   * @returns WebhookPayload or WebhookErrorPayload
   * 
   * @example
   * const result = portal02Service.processWebhookPayload({
   *   data: {
   *     event: "order.status.updated",
   *     orderId: "portal02_txn_123",
   *     reference: "order_123",
   *     status: "delivered",
   *     recipient: "233241234567",
   *     volume: 10
   *   }
   * });
   */
  processWebhookPayload(payload: any): WebhookResult {
    const root = payload?.data && typeof payload.data === "object" ? payload.data : payload;
    const event =
      root?.event ||
      root?.event_type ||
      payload?.event ||
      payload?.event_type ||
      payload?.type;
    if (
      event !== "order.status.updated" &&
      event !== "order.status_update" &&
      event !== "order.updated" &&
      event !== "status.updated"
    ) {
      return { success: false, error: `Unknown event: ${event}` };
    }
    const orderId = root?.orderId || root?.order_id || root?.id || payload?.orderId || payload?.order_id || payload?.id;
    const reference =
      root?.reference ||
      root?.clientReference ||
      payload?.reference ||
      payload?.clientReference ||
      orderId;
    const status = root?.status ?? payload?.status;
    const validStatuses = ["pending", "processing", "delivered", "failed", "cancelled", "refunded", "resolved"];
    if (!validStatuses.includes(status)) {
      return { success: false, error: `Invalid status: ${status}` };
    }
    const tsRaw = root?.timestamp ?? root?.updatedAt ?? payload?.timestamp;
    return {
      success: true,
      event,
      orderId,
      reference,
      status,
      recipient: root?.recipient ?? payload?.recipient,
      volume: root?.volume ?? payload?.volume,
      timestamp: tsRaw ? new Date(tsRaw) : new Date(),
    };
  }
}

export const portal02Service = new Portal02Service();
export default portal02Service;

// Export types for use in other modules
export type {
  Portal02RequestPayload,
  Portal02SuccessResponse,
  Portal02ErrorResponse,
  PurchaseResult,
  WebhookPayload,
  WebhookErrorPayload,
  WebhookResult,
};
