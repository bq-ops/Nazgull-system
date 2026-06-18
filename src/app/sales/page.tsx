import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sales" };

export default function SalesPage() {
  return (
    <div className="p-6 md:p-8">
      <h1 className="font-display text-2xl font-bold text-brand-oxblood">
        Sales
      </h1>
      <p className="mt-1 text-sm text-text-muted">
        Log sales by customer and city, track revenue and COGS.
      </p>
      <div className="mt-6 flex h-48 items-center justify-center rounded-lg border border-dashed border-border bg-surface">
        <p className="text-sm text-text-muted">Sales log coming soon</p>
      </div>
    </div>
  );
}
