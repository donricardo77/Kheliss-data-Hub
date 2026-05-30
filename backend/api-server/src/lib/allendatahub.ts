import { normalizePhoneNumber } from "./phone-utils";

const API_KEY = process.env.ALLENDATAHUB_API_KEY || process.env.VENDOR_API_KEY || "adh_live_pcdwbIH0coUXbjD5_O4VpEmRGERMkuyxCx-XMqHFeLo";
const RAW_BASE_URL = process.env.ALLENDATAHUB_BASE_URL || process.env.VENDOR_API_URL || "https://allen-data-hub-backend.onrender.com";
const BASE_URL = RAW_BASE_URL
  .replace(/\/+$/, "")
  .replace(/\/api\/v1$/i, "")
  .replace(/^https?:\/\/(www\.)?allendatahub\.com/i, "https://allen-data-hub-backend.onrender.com");
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8080";
const DEFAULT_WEBHOOK_URL = `${BACKEND_URL.replace(/\/+$/, "")}/api/vendor/allen-datahub/webhook`;

if (process.env.NODE_ENV === "production") {
  if (!process.env.BACKEND_URL) {
    console.error(
      "🚨 CRITICAL: BACKEND_URL is not set in production! AllenDataHub webhooks will fail silently.\n" +
      "Set BACKEND_URL environment variable to your production backend domain (e.g., https://api.yourdomain.com)"
    );
  } else if (BACKEND_URL.includes("localhost")) {
    console.error(
      "🚨 CRITICAL: BACKEND_URL contains 'localhost' in production! AllenDataHub cannot send webhooks to localhost.\n" +
      "Update BACKEND_URL to your production backend domain."
    );
  }
}

const supportedNetworks = ["MTN", "Telecel", "AirtelTigo"];
const supportedVolumes: Record<string, number[]> = {
  MTN: [1, 2, 3, 4, 5, 6, 7, 8, 10, 15, 20, 25, 30, 40, 50, 100],
  Telecel: [5, 10, 15, 20, 25, 30, 40, 50, 100],
  AirtelTigo: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 20],
};

export interface AllenDataHubProduct {
  id: string;
  name: string;
  network: string;
  dataAmount: string;
  description: string | null;
  apiPrice: number;
}

export interface AllenDataHubPurchaseRequest {
  phoneNumber: string;
  network: string;
  volume: number;
  webhookUrl?: string;
}

export interface AllenDataHubPurchaseResponse {
  success: boolean;
  order?: Record<string, any>;
  orderId?: string;
  transactionId?: string;
  reference?: string;
  status?: string;
  message?: string;
  amount?: number;
  currency?: string;
  webhookUrl?: string;
  walletBalanceBefore?: number;
  walletBalanceAfter?: number;
  raw?: Record<string, any> | null;
  requestId?: string;
  error?: string;
}

interface WebhookParseResult {
  success: boolean;
  error?: string;
  event?: string;
  orderId?: string;
  vendorOrderId?: string;
  reference?: string;
  status?: string;
  webhookEvent?: string;
  phoneNumber?: string;
  dataAmount?: string | number;
  timestamp?: Date;
  raw?: Record<string, any>;
}

function validateNetwork(network: string): boolean {
  return supportedNetworks.includes(network);
}

function validateVolume(network: string, volume: number): boolean {
  return supportedVolumes[network]?.includes(volume) ?? false;
}

function formatPhoneForAllenDataHub(phone: string): string {
  if (!phone) return phone;
  if (phone.startsWith("+233") && phone.length === 13) {
    return `0${phone.slice(4)}`;
  }
  if (phone.startsWith("233") && phone.length === 12) {
    return `0${phone.slice(3)}`;
  }
  return phone;
}

function getWebhookPayloadSource(payload: Record<string, any>): Record<string, any> {
  if (payload?.data && typeof payload.data === "object") {
    return payload.data;
  }
  if (payload?.payload && typeof payload.payload === "object") {
    return payload.payload;
  }
  if (payload?.body && typeof payload.body === "object") {
    return payload.body;
  }
  return payload;
}

async function fetchJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = {
    Accept: "application/json",
    ...(init.headers || {}),
  } as Record<string, string>;

  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers,
  });

  const text = await response.text();
  let data: any = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    if (response.ok) {
      throw new Error(`Invalid JSON response from AllenDataHub: ${text}`);
    }
  }

  if (!response.ok) {
    const message = data?.message || data?.error || text || `AllenDataHub API error (${response.status})`;
    const error = new Error(message);
    (error as any).response = data;
    throw error;
  }

  return data as T;
}

class AllenDataHubService {
  constructor() {
    if (!API_KEY) {
      console.warn("[AllenDataHub] WARNING: ALLENDATAHUB_API_KEY / VENDOR_API_KEY is not configured. Using built-in key fallback.");
    }
    console.log(`[AllenDataHub] Initialized. Base: ${BASE_URL}, Webhook: ${DEFAULT_WEBHOOK_URL}`);
  }

  async getProducts(): Promise<AllenDataHubProduct[]> {
    const data = await fetchJson<{ products: AllenDataHubProduct[] }>("/api/v1/products", {
      method: "GET",
      headers: {
        "X-API-Key": API_KEY,
      },
    });
    return data.products || [];
  }

  async purchaseDataBundle({ phoneNumber, network, volume, webhookUrl }: AllenDataHubPurchaseRequest): Promise<AllenDataHubPurchaseResponse> {
    if (!phoneNumber || !network || !volume) {
      return {
        success: false,
        error: "Missing required fields: phoneNumber, network, volume",
      };
    }

    const normalized = normalizePhoneNumber(phoneNumber);
    if (!normalized.success || !normalized.formatted) {
      return {
        success: false,
        error: normalized.error || "Invalid phone number",
      };
    }

    if (!validateNetwork(network)) {
      return {
        success: false,
        error: `Unsupported network: ${network}`,
      };
    }

    if (!validateVolume(network, volume)) {
      return {
        success: false,
        error: `Unsupported volume ${volume} for network ${network}`,
      };
    }

    const payload = {
      phoneNumber: formatPhoneForAllenDataHub(normalized.formatted),
      network,
      volume,
      webhookUrl: webhookUrl || DEFAULT_WEBHOOK_URL,
    };

    // Debug: log the exact request URL and payload (without exposing API key)
    try {
      const requestUrl = `${BASE_URL}/api/v1/data/purchase`;
      console.info(`[AllenDataHub] Request URL: ${requestUrl}`);
      console.info(`[AllenDataHub] Payload: ${JSON.stringify(payload)}`);

      const data = await fetchJson<AllenDataHubPurchaseResponse>("/api/v1/data/purchase", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY,
        },
        body: JSON.stringify(payload),
      });

      return {
        ...data,
        orderId: data.orderId || data.order?.id || data.transactionId,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "AllenDataHub API error";
      return {
        success: false,
        error: message,
        raw: (err as any).response || null,
      };
    }
  }

  async getOrders(page = 1, limit = 20): Promise<any> {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    return await fetchJson<any>(`/api/v1/orders?${params.toString()}`, {
      method: "GET",
      headers: {
        "X-API-Key": API_KEY,
      },
    });
  }

  async getOrder(orderId: string): Promise<any> {
    if (!orderId) {
      throw new Error("orderId is required");
    }
    return await fetchJson<any>(`/api/v1/orders/${orderId}`, {
      method: "GET",
      headers: {
        "X-API-Key": API_KEY,
      },
    });
  }

  processWebhookPayload(payload: Record<string, any>): WebhookParseResult {
    if (!payload || typeof payload !== "object") {
      return { success: false, error: "Empty webhook payload" };
    }

    const source = getWebhookPayloadSource(payload);
    const event = source.webhookEvent || source.event || source.type || payload.webhookEvent || payload.event || payload.type || "unknown";
    // Accept a wider range of possible identifier field names from vendor payloads
    const orderId =
      source.orderId ||
      source.vendorOrderId ||
      source.order_id ||
      source.transactionId ||
      source.transaction_id ||
      source.id ||
      source.orderRef ||
      source.order_ref ||
      source.orderReference ||
      source.order_reference ||
      source.reference ||
      source.clientOrderReference ||
      source.vendorReference ||
      payload.orderId ||
      payload.vendorOrderId ||
      payload.order_id ||
      payload.transactionId ||
      payload.transaction_id ||
      payload.id ||
      payload.orderRef ||
      payload.order_ref ||
      payload.orderReference ||
      payload.order_reference;

    const reference =
      source.reference ||
      source.requestId ||
      source.request_id ||
      source.clientOrderReference ||
      source.vendorReference ||
      source.orderRef ||
      source.order_ref ||
      source.orderReference ||
      source.order_reference ||
      source.id ||
      payload.reference ||
      payload.requestId ||
      payload.request_id ||
      payload.clientOrderReference ||
      payload.vendorReference ||
      payload.orderRef ||
      payload.order_ref ||
      payload.orderReference ||
      payload.order_reference ||
      payload.id;

    const status =
      source.status ||
      source.vendorStatus ||
      source.state ||
      source.statusCode ||
      source.orderStatus ||
      source.currentStatus ||
      source.result ||
      source.status_message ||
      payload.status ||
      payload.vendorStatus ||
      payload.state ||
      payload.statusCode ||
      payload.result ||
      payload.status_message;

    if (!orderId && !reference) {
      return { success: false, error: "Missing orderId or reference in webhook payload" };
    }

    const timestampValue = source.timestamp || source.updatedAt || payload.timestamp || payload.updatedAt;
    const timestamp = timestampValue ? new Date(timestampValue) : new Date();

    // Add a small debug-friendly object so webhook handlers can log exactly what was parsed
    const parsed = {
      success: true,
      event,
      orderId,
      vendorOrderId: orderId,
      reference,
      status: status?.toString(),
      webhookEvent: event,
      phoneNumber: source.phoneNumber || source.recipientPhone || source.msisdn || payload.phoneNumber || payload.recipientPhone || payload.msisdn,
      dataAmount: source.dataAmount || source.volume || source.bundleSize || payload.dataAmount || payload.volume || payload.bundleSize,
      timestamp,
      raw: payload,
    } as WebhookParseResult;

    // Helpful console.info to aid in diagnosing mismatched fields in production logs
    try {
      console.info(`[AllenDataHub] Parsed webhook: orderId=${String(parsed.orderId)}, reference=${String(parsed.reference)}, status=${String(parsed.status)}, event=${String(parsed.webhookEvent)}`);
    } catch (err) {
      // ignore logging errors
    }

    return parsed;
  }
}

const allenDataHubService = new AllenDataHubService();
export default allenDataHubService;
