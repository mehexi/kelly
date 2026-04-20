import { Modal, TitleBar } from "@shopify/app-bridge-react";
import { useState, useEffect } from "react";
import { useFetcher } from "react-router";

interface CreatePlanProps {
  open: boolean;
  onHide: () => void;
  action: string;
}

export const CreatePlan = ({ open, onHide, action }: CreatePlanProps) => {
  const fetcher = useFetcher();
  const isLoading = fetcher.state !== "idle";

  const [selectedProduct, setSelectedProduct] = useState<{
    id: string;
    title: string;
    handle: string;
  } | null>(null);

  const [form, setForm] = useState({
    name: "",
    description: "",
    amount: "",
    interval: "monthly",
    currency: "NGN",
  });

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleProductSelect = async () => {
    const selected = await (window as any).shopify.resourcePicker({
      type: "product",
      multiple: false,
    });

    if (!selected || selected.length === 0) return;

    const product = selected[0];
    setSelectedProduct({
      id: product.id,
      title: product.title,
      handle: product.handle,
    });
  };

  const handleSave = () => {
    if (!selectedProduct) return;

    fetcher.submit(
      {
        ...form,
        intent: "create-plan",
        productId: selectedProduct.id,
        productTitle: selectedProduct.title,
        productHandle: selectedProduct.handle,
      },
      { method: "POST", action }
    );
  };

  // Close and reset on success
  useEffect(() => {
    if (fetcher.data?.success) {
      setForm({
        name: "",
        description: "",
        amount: "",
        interval: "monthly",
        currency: "NGN",
      });
      setSelectedProduct(null);
      onHide();
    }
  }, [fetcher.data]);

  return (
    <Modal id="create-plan-modal" open={open} onHide={onHide}>
      <TitleBar title="Create Plan">
        <button
          variant="primary"
          onClick={handleSave}
          disabled={isLoading || !selectedProduct}
        >
          {isLoading ? "Saving..." : "Save"}
        </button>
        <button onClick={onHide}>Cancel</button>
      </TitleBar>

      <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "16px" }}>
        {fetcher.data?.error && (
          <s-banner tone="critical" heading="Error">
            {fetcher.data.error}
          </s-banner>
        )}

        {/* Product selector */}
        <div>
          <div style={{ marginBottom: "4px" }}>
            <s-text >Product</s-text>
          </div>
          {selectedProduct ? (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <s-text>{selectedProduct.title}</s-text>
              <button variant="primary" onClick={handleProductSelect}>
                Change
              </button>
            </div>
          ) : (
            <button onClick={handleProductSelect}>
              Select Product
            </button>
          )}
        </div>

        <s-text-field
          label="Plan Name"
          value={form.name}
          placeholder="e.g. Basic Plan"
          required
          onInput={(e: any) => handleChange("name", e.currentTarget.value)}
        />
        <s-text-area
          label="Description"
          value={form.description}
          placeholder="Describe what's included in this plan"
          onInput={(e: any) => handleChange("description", e.currentTarget.value)}
        />
        <s-number-field
          label="Amount (₦)"
          value={form.amount}
          placeholder="e.g. 5000"
          min={50}
          required
          onInput={(e: any) => handleChange("amount", e.currentTarget.value)}
        />
        <s-select
          label="Billing Interval"
          value={form.interval}
          onChange={(e: any) => handleChange("interval", e.currentTarget.value)}
        >
          <s-option value="daily">Daily</s-option>
          <s-option value="weekly">Weekly</s-option>
          <s-option value="monthly">Monthly</s-option>
          <s-option value="biannually">Every 6 Months</s-option>
          <s-option value="annually">Annually</s-option>
        </s-select>
        <s-select
          label="Currency"
          value={form.currency}
          onChange={(e: any) => handleChange("currency", e.currentTarget.value)}
        >
          <s-option value="NGN">NGN — Nigerian Naira</s-option>
          <s-option value="GHS">GHS — Ghanaian Cedi</s-option>
          <s-option value="ZAR">ZAR — South African Rand</s-option>
          <s-option value="KES">KES — Kenyan Shilling</s-option>
          <s-option value="USD">USD — US Dollar</s-option>
        </s-select>
      </div>
    </Modal>
  );
};
