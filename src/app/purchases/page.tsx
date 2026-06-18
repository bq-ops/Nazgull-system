import type { Metadata } from "next";

export const metadata: Metadata = { title: "Purchases" };

export default function PurchasesPage() {
  return (
    <div className="p-6 md:p-8">
      <h1 className="font-display text-2xl font-bold text-brand-oxblood">
        Purchases
      </h1>
      <p className="mt-1 text-sm text-text-muted">
        Record stock replenishments and update weighted-average cost.
      </p>
      <div className="mt-6 flex h-48 items-center justify-center rounded-lg border border-dashed border-border bg-surface">
        <p className="text-sm text-text-muted">Purchase log coming soon</p>
      </div>
    </div>
  );
}
