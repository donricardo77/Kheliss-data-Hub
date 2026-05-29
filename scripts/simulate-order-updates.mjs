function normalizeAllenDataHubStatus(status) {
  if (!status) {
    return { mappedStatus: undefined, vendorStatus: undefined };
  }

  const normalized = String(status).trim().toLowerCase();
  const completedStatuses = new Set(["delivered", "resolved", "success", "complete", "completed", "fulfilled"]);
  const failedStatuses = new Set(["failed", "cancelled", "canceled", "refunded", "error", "rejected"]);
  const processingStatuses = new Set(["processing", "in_progress", "in-progress", "running", "started"]);
  const pendingStatuses = new Set(["pending", "queued", "waiting", "submitted", "received"]);

  let mappedStatus;
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

function applyWebhookToOrder(order, incomingVendorStatus, timestamp = new Date()) {
  const { mappedStatus, vendorStatus } = normalizeAllenDataHubStatus(incomingVendorStatus);

  const oldOrderStatus = order.status;
  const oldVendorStatus = order.vendorStatus;

  order.vendorStatus = vendorStatus || order.vendorStatus;

  const isFinal = oldOrderStatus === "completed" || oldOrderStatus === "failed";

  if (mappedStatus === "completed") {
    order.status = "completed";
  } else if (mappedStatus === "failed") {
    order.status = "failed";
  } else if (!isFinal) {
    if (mappedStatus === "processing" || mappedStatus === "pending") {
      order.status = "processing";
    }
  }

  if (!order.webhookHistory) order.webhookHistory = [];
  order.webhookHistory.push({ mappedStatus, vendorStatus, timestamp, raw: { incomingVendorStatus } });

  return { oldOrderStatus, oldVendorStatus, newOrderStatus: order.status, newVendorStatus: order.vendorStatus };
}

function simulateScenario(initialOrder, incomingStatus) {
  const order = JSON.parse(JSON.stringify(initialOrder));
  console.log("\n---\nInitial order:", order);
  console.log("Incoming vendor status:", incomingStatus);
  const result = applyWebhookToOrder(order, incomingStatus);
  console.log("Result:", result);
  console.log("Updated order:", order);
}

const scenarios = [
  // Pending -> completed
  [{ status: "pending", vendorStatus: undefined, webhookHistory: [] }, "delivered"],
  // Processing -> completed
  [{ status: "processing", vendorStatus: "processing", webhookHistory: [] }, "completed"],
  // Completed -> processing (should NOT regress)
  [{ status: "completed", vendorStatus: "delivered", webhookHistory: [] }, "processing"],
  // Failed -> completed (should NOT change final failed -> completed? business rule: final remains)
  [{ status: "failed", vendorStatus: "failed", webhookHistory: [] }, "completed"],
  // Pending -> failed
  [{ status: "pending", vendorStatus: "pending", webhookHistory: [] }, "failed"],
  // No mapping (unknown status) -> should not change order status unless not final
  [{ status: "pending", vendorStatus: "pending", webhookHistory: [] }, "unknown_status_xyz"],
];

for (const [initialOrder, incoming] of scenarios) {
  simulateScenario(initialOrder, incoming);
}

console.log('\nSimulation complete');
