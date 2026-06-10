import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { MessageCircle } from "lucide-react";

interface OrderComplaintDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  order: {
    _id: string;
    vendorOrderId?: string;
    createdAt: string;
    network: string;
    dataAmount?: string;
    amount?: number;
    status: string;
    recipientPhone?: string;
  };
}

const COMPLAINT_REASONS = [
  { id: "not_received", label: "Data bundle not received" },
  { id: "failed", label: "Order failed" },
  { id: "wrong_amount", label: "Received wrong amount of data" },
  { id: "other", label: "Other issue" },
];

export default function OrderComplaintDialog({ isOpen, onOpenChange, order }: OrderComplaintDialogProps) {
  const [selectedReason, setSelectedReason] = useState<string>("");
  const [additionalMessage, setAdditionalMessage] = useState("");

  const handleSendViaWhatsApp = () => {
    if (!selectedReason) return;

    const reasonLabel = COMPLAINT_REASONS.find(r => r.id === selectedReason)?.label || selectedReason;
    const orderDetails = `
Order ID: ${order._id}
Vendor Order ID: ${order.vendorOrderId || "N/A"}
Time: ${new Date(order.createdAt).toLocaleString()}
Network: ${order.network}
Amount: ${order.amount || "N/A"}
Status: ${order.status}
Phone: ${order.recipientPhone || "N/A"}
    `.trim();

    const message = `*Complaint to AllenDataHub Admin*

*Complaint Reason:* ${reasonLabel}

*Order Details:*
${orderDetails}

${additionalMessage ? `*Additional Message:*\n${additionalMessage}` : ""}

Please help me resolve this issue.`;

    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/233592786175?text=${encodedMessage}`;
    
    window.open(whatsappUrl, "_blank");
    onOpenChange(false);
    setSelectedReason("");
    setAdditionalMessage("");
  };

  const isFormValid = selectedReason.length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Complaint to AllenDataHub Admin</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Order Details Summary */}
          <div className="bg-muted p-4 rounded-lg space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Order ID:</span>
              <span className="font-mono font-semibold">{order._id.substring(0, 8)}...</span>
            </div>
            {order.vendorOrderId && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Vendor Order ID:</span>
                <span className="font-mono font-semibold">{order.vendorOrderId}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Time:</span>
              <span>{new Date(order.createdAt).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Network:</span>
              <span className="font-semibold">{order.network}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status:</span>
              <span className="font-semibold capitalize">{order.status}</span>
            </div>
          </div>

          {/* Complaint Reason */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">What is the issue?</Label>
            <RadioGroup value={selectedReason} onValueChange={setSelectedReason}>
              <div className="space-y-3">
                {COMPLAINT_REASONS.map((reason) => (
                  <div key={reason.id} className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-accent cursor-pointer transition-colors">
                    <RadioGroupItem value={reason.id} id={reason.id} />
                    <Label htmlFor={reason.id} className="flex-1 cursor-pointer font-normal">
                      {reason.label}
                    </Label>
                  </div>
                ))}
              </div>
            </RadioGroup>
          </div>

          {/* Additional Message */}
          <div className="space-y-2">
            <Label htmlFor="message">Additional Details (Optional)</Label>
            <Textarea
              id="message"
              placeholder="Provide any additional information about the issue..."
              value={additionalMessage}
              onChange={(e) => setAdditionalMessage(e.target.value)}
              className="resize-none h-24"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                setSelectedReason("");
                setAdditionalMessage("");
              }}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendViaWhatsApp}
              disabled={!isFormValid}
              className="flex-1 gap-2"
            >
              <MessageCircle className="h-4 w-4" />
              Send via WhatsApp
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
