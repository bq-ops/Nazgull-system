import type { Metadata } from "next";

export const metadata: Metadata = { title: "Dashboard" };

const CARDS = [
  { label: "Revenue", value: "—" },
  { label: "COGS", value: "—" },
  { label: "Gross profit", value: "—" },
  { label: "Net profit", value: "—" },
];

export default function DashboardPage() {
  return (
    <div className="p-6 md:p-8">
      <h1 className="font-display text-2xl font-bold text-brand-oxblood">
        Dashboard
      </h1>
      <p className="mt-1 text-sm text-text-muted">
        Overview coming soon — add products, purchases, and sales first.
      </p>

      {/* KPI placeholders */}
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {CARDS.map(({ label, value }) => (
          <div
            key={label}
            className="rounded-lg border border-border bg-surface p-4"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
              {label}
            </p>
            <p className="mt-2 font-display text-2xl font-semibold tabular-nums text-brand-oxblood">
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Chart placeholder */}
      <div className="mt-4 flex h-48 items-center justify-center rounded-lg border border-dashed border-border bg-surface md:h-64">
        <p className="text-sm text-text-muted">Revenue chart</p>
      </div>
    </div>
  );
}
