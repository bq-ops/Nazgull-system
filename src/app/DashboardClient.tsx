"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import type { LoyaltySettings } from "@/types/database";
import { formatMoney, type Currency } from "@/lib/currency";
import { createClient } from "@/lib/supabase/client";
import {
  ComposedChart,
  BarChart,
  PieChart,
  Area,
  Bar,
  Line,
  Pie,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const IraqMap = dynamic(() => import("./IraqMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-text-muted">
      Loading map…
    </div>
  ),
});

// ─── Shared types (imported by page.tsx) ──────────────────────────────────────
export interface SaleForDash {
  id: string;
  date: string;
  city: string | null;
  channel: string | null;
  discount_amount: number;
  sale_items: {
    quantity: number;
    unit_price: number;
    cost_at_sale: number;
    product_id: string | null;
    products: { name: string; sku: string } | null;
  }[];
}

export interface ExpenseForDash {
  category: string;
  amount: number;
  date: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────────
const CHANNEL_COLORS: Record<string, string> = {
  Instagram: "#C98B92",
  Facebook:  "#4A1416",
  WhatsApp:  "#4E7C59",
  "Walk-in": "#B5792B",
  Referral:  "#8A6E6F",
  Other:     "#2B1A1B",
};

const CATEGORY_COLORS: Record<string, string> = {
  Advertising:          "#4A1416",
  Marketing:            "#C98B92",
  "Platform fees":      "#B5792B",
  "Payment processing": "#4E7C59",
  Shipping:             "#8A6E6F",
  Software:             "#2B1A1B",
  Returns:              "#B23A48",
  Other:                "#ECCFCD",
};

const RANGE_LABELS: Record<string, string> = {
  today: "Today",
  week:  "This week",
  month: "This month",
  custom:"Custom",
};

// ─── Helpers ───────────────────────────────────────────────────────────────────
function shortNum(n: number) {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000)     return `${(n / 1_000).toFixed(0)}k`;
  return String(Math.round(n));
}

function fmtLabel(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

// ─── Sub-components ────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  sub,
  danger = false,
  warn = false,
}: {
  label: string;
  value: string;
  sub?: string;
  danger?: boolean;
  warn?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4 md:p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
        {label}
      </p>
      <p
        className={
          "mt-2 font-display text-2xl font-semibold tabular-nums " +
          (warn ? "text-warning" : danger ? "text-danger" : "text-brand-oxblood")
        }
      >
        {value}
      </p>
      {sub && (
        <p
          className={
            "mt-0.5 text-xs " +
            (danger ? "text-danger" : warn ? "text-warning" : "text-text-muted")
          }
        >
          {sub}
        </p>
      )}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload, label, formatter }: any) {
  if (!active || !payload?.length) return null;
  const fmtVal = (n: number) =>
    typeof formatter === "function"
      ? formatter(n)
      : n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 shadow-sm">
      {label && (
        <p className="mb-1.5 text-xs text-text-muted">{label}</p>
      )}
      {payload.map(
        (p: { name: string; value: number; color: string }, i: number) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span
              className="inline-block h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: p.color }}
            />
            <span className="text-text-muted">{p.name}:</span>
            <span className="font-medium tabular-nums text-text">
              {fmtVal(p.value)}
            </span>
          </div>
        ),
      )}
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center text-sm text-text-muted">
      {message}
    </div>
  );
}

function InlineNote({
  city,
  initial,
  onSave,
}: {
  city: string;
  initial: string;
  onSave: (city: string, note: string) => void;
}) {
  const [val, setVal] = useState(initial);
  return (
    <input
      type="text"
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={() => onSave(city, val)}
      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
      placeholder="Add growth note…"
      className="w-full min-w-[160px] rounded-card border border-border bg-bg px-2.5 py-1.5 text-xs text-text placeholder:text-text-muted/50 focus:border-brand-oxblood focus:outline-none focus:ring-1 focus:ring-brand-oxblood"
    />
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
interface Props {
  sales: SaleForDash[];
  expenses: ExpenseForDash[];
  lowStockCount: number;
  range: string;
  from: string;
  to: string;
  settings: LoyaltySettings;
  cityNotes: Record<string, string>;
  thisMonthAdSpend: number;
}

export default function DashboardClient({
  sales,
  expenses,
  lowStockCount,
  range,
  from,
  to,
  settings,
  cityNotes: initialCityNotes,
  thisMonthAdSpend,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [sortBy,        setSortBy]        = useState<"units" | "revenue">("units");
  const [mapMetric,     setMapMetric]     = useState<"orders" | "revenue">("orders");
  const [channelMetric, setChannelMetric] = useState<"revenue" | "orders">("revenue");
  const [customFrom, setCustomFrom] = useState(from);
  const [customTo,   setCustomTo]   = useState(to);
  const [dispCurrency, setDispCurrency] = useState<Currency>(
    settings.display_currency as Currency,
  );
  const [cityNotes, setCityNotes] = useState<Record<string, string>>(initialCityNotes);
  const supabase = useMemo(() => createClient(), []);

  const baseCurrency = settings.base_currency as Currency;
  const rate = settings.usd_iqd_rate;
  function fmt(n: number) {
    return formatMoney(n, dispCurrency, baseCurrency, rate);
  }

  function navigate(url: string) {
    startTransition(() => router.replace(url));
  }

  async function saveCityNote(city: string, note: string) {
    setCityNotes((prev) => ({ ...prev, [city]: note }));
    await supabase
      .from("city_notes")
      .upsert({ city, note, updated_at: new Date().toISOString() }, { onConflict: "city" });
  }

  // ── Metrics ────────────────────────────────────────────────────────────────
  const { revenue, cogs } = useMemo(() => {
    let rev = 0, cg = 0;
    for (const s of sales) {
      for (const item of s.sale_items) {
        rev += item.quantity * item.unit_price;
        cg  += item.quantity * item.cost_at_sale;
      }
      rev -= s.discount_amount;
    }
    return { revenue: rev, cogs: cg };
  }, [sales]);

  const totalExpenses = useMemo(
    () => expenses.reduce((s, e) => s + e.amount, 0),
    [expenses],
  );

  const grossProfit = revenue - cogs;
  const netProfit   = grossProfit - totalExpenses;
  const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
  const netMargin   = revenue > 0 ? (netProfit   / revenue) * 100 : 0;

  // ── Best sellers ──────────────────────────────────────────────────────────
  const bestSellers = useMemo(() => {
    const map = new Map<string, { name: string; units: number; revenue: number }>();
    for (const s of sales) {
      for (const item of s.sale_items) {
        const name = item.products?.name ?? "Unknown";
        const cur  = map.get(name) ?? { name, units: 0, revenue: 0 };
        cur.units   += item.quantity;
        cur.revenue += item.quantity * item.unit_price;
        map.set(name, cur);
      }
    }
    return [...map.values()]
      .sort((a, b) =>
        sortBy === "units" ? b.units - a.units : b.revenue - a.revenue,
      )
      .slice(0, 8)
      .map((d) => ({
        ...d,
        shortName: d.name.length > 22 ? d.name.slice(0, 20) + "…" : d.name,
      }));
  }, [sales, sortBy]);

  // ── Time series ───────────────────────────────────────────────────────────
  const timeSeries = useMemo(() => {
    const salesByDate = new Map<string, { rev: number; cogs: number }>();
    for (const s of sales) {
      const cur = salesByDate.get(s.date) ?? { rev: 0, cogs: 0 };
      for (const item of s.sale_items) {
        cur.rev  += item.quantity * item.unit_price;
        cur.cogs += item.quantity * item.cost_at_sale;
      }
      cur.rev -= s.discount_amount;
      salesByDate.set(s.date, cur);
    }

    const expByDate = new Map<string, number>();
    for (const e of expenses) {
      expByDate.set(e.date, (expByDate.get(e.date) ?? 0) + e.amount);
    }

    const dates: string[] = [];
    const cursor = new Date(from + "T00:00:00");
    const end    = new Date(to   + "T00:00:00");
    while (cursor <= end) {
      dates.push(cursor.toISOString().slice(0, 10));
      cursor.setDate(cursor.getDate() + 1);
    }

    return dates.map((d) => {
      const s   = salesByDate.get(d) ?? { rev: 0, cogs: 0 };
      const exp = expByDate.get(d)   ?? 0;
      const gross = s.rev - s.cogs;
      return {
        date:      d,
        label:     fmtLabel(d),
        Revenue:   parseFloat(s.rev.toFixed(2)),
        "Net profit": parseFloat((gross - exp).toFixed(2)),
      };
    });
  }, [sales, expenses, from, to]);

  // ── Expenses by category ──────────────────────────────────────────────────
  const expensesByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of expenses) {
      map.set(e.category, (map.get(e.category) ?? 0) + e.amount);
    }
    return [...map.entries()]
      .sort(([, a], [, b]) => b - a)
      .map(([name, value]) => ({ name, value, fill: CATEGORY_COLORS[name] ?? "#8A6E6F" }));
  }, [expenses]);

  // ── Cities (map + top list) ───────────────────────────────────────────────
  const citiesData = useMemo(() => {
    const map = new Map<string, { orders: number; revenue: number }>();
    for (const s of sales) {
      if (!s.city) continue;
      const cur = map.get(s.city) ?? { orders: 0, revenue: 0 };
      cur.orders += 1;
      const itemTotal = s.sale_items.reduce(
        (sum, i) => sum + i.quantity * i.unit_price,
        0,
      );
      cur.revenue += itemTotal - s.discount_amount;
      map.set(s.city, cur);
    }
    return map;
  }, [sales]);

  // ── Sales by channel ──────────────────────────────────────────────────────
  const channelData = useMemo(() => {
    const map = new Map<string, { orders: number; revenue: number }>();
    for (const s of sales) {
      const ch = s.channel ?? "Other";
      const cur = map.get(ch) ?? { orders: 0, revenue: 0 };
      cur.orders += 1;
      for (const item of s.sale_items) {
        cur.revenue += item.quantity * item.unit_price;
      }
      cur.revenue -= s.discount_amount;
      map.set(ch, cur);
    }
    return [...map.entries()].map(([name, stats]) => ({
      name,
      ...stats,
      fill: CHANNEL_COLORS[name] ?? "#8A6E6F",
    }));
  }, [sales]);

  const topCities = useMemo(
    () =>
      [...citiesData.entries()].sort(([, a], [, b]) =>
        mapMetric === "orders"
          ? b.orders - a.orders
          : b.revenue - a.revenue,
      ),
    [citiesData, mapMetric],
  );

  // ── City performance (with COGS, sorted by revenue) ──────────────────────
  const cityPerf = useMemo(() => {
    const map = new Map<string, { orders: number; revenue: number; cogs: number }>();
    for (const s of sales) {
      if (!s.city) continue;
      const cur = map.get(s.city) ?? { orders: 0, revenue: 0, cogs: 0 };
      cur.orders++;
      let rev = 0, cg = 0;
      for (const item of s.sale_items) {
        rev += item.quantity * item.unit_price;
        cg  += item.quantity * item.cost_at_sale;
      }
      cur.revenue += rev - s.discount_amount;
      cur.cogs    += cg;
      map.set(s.city, cur);
    }
    return [...map.entries()].sort(([, a], [, b]) => b.revenue - a.revenue);
  }, [sales]);

  const singlePoint = timeSeries.length === 1;

  // ── Date range display label ──────────────────────────────────────────────
  const rangeSub =
    range === "today"
      ? fmtLabel(from)
      : `${fmtLabel(from)} – ${fmtLabel(to)}`;

  return (
    <div className={"min-h-screen bg-bg transition-opacity " + (isPending ? "opacity-60" : "")}>
      {/* Header */}
      <header className="border-b border-border bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-4 md:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="font-display text-2xl font-bold text-brand-oxblood">
                Dashboard
              </h1>
              <p className="mt-0.5 text-xs text-text-muted">{rangeSub}</p>
            </div>

            {/* Date range tabs + currency toggle */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <div className="flex gap-1 rounded-card border border-border p-0.5">
                  {(["IQD", "USD"] as const).map((c) => (
                    <button
                      key={c}
                      onClick={() => setDispCurrency(c)}
                      className={
                        "rounded-card px-2.5 py-1 text-xs font-semibold transition-colors " +
                        (dispCurrency === c
                          ? "bg-brand-oxblood text-white"
                          : "text-text-muted hover:bg-blush/60")
                      }
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-1 rounded-lg border border-border bg-bg p-1">
                {(["today", "week", "month", "custom"] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => {
                      if (r === "custom") {
                        navigate(`/?range=custom&from=${customFrom}&to=${customTo}`);
                      } else {
                        navigate(`/?range=${r}`);
                      }
                    }}
                    className={
                      "rounded-card px-3 py-1.5 text-xs font-medium transition-colors " +
                      (range === r
                        ? "bg-brand-oxblood text-white"
                        : "text-text-muted hover:bg-blush/60")
                    }
                  >
                    {RANGE_LABELS[r]}
                  </button>
                ))}
              </div>

              {/* Custom date inputs */}
              {range === "custom" && (
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="rounded-card border border-border bg-surface px-2 py-1 text-xs text-text focus:border-brand-oxblood focus:outline-none"
                  />
                  <span className="text-xs text-text-muted">to</span>
                  <input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="rounded-card border border-border bg-surface px-2 py-1 text-xs text-text focus:border-brand-oxblood focus:outline-none"
                  />
                  <button
                    onClick={() =>
                      navigate(
                        `/?range=custom&from=${customFrom}&to=${customTo}`,
                      )
                    }
                    className="rounded-card bg-brand-oxblood px-3 py-1 text-xs font-medium text-white hover:bg-brand-oxblood-deep"
                  >
                    Apply
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 md:px-8">

        {/* ── Stat cards ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          <StatCard
            label="Total sales"
            value={fmt(revenue)}
            sub={`${sales.length} order${sales.length !== 1 ? "s" : ""}`}
          />
          <StatCard
            label="Gross profit"
            value={fmt(grossProfit)}
            sub={`${grossMargin.toFixed(1)}% margin`}
            danger={grossProfit < 0}
          />
          <StatCard
            label="Net profit"
            value={fmt(netProfit)}
            sub={`${netMargin.toFixed(1)}% margin`}
            danger={netProfit < 0}
          />
          <StatCard
            label="Low stock"
            value={String(lowStockCount)}
            sub={lowStockCount === 0 ? "All products stocked" : "products need reorder"}
            warn={lowStockCount > 0}
          />
        </div>

        {/* ── Ad budget ──────────────────────────────────────────────────── */}
        {settings.monthly_ad_budget > 0 && (() => {
          const budget = settings.monthly_ad_budget;
          const spent  = thisMonthAdSpend;
          const over   = spent > budget;
          const pct    = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
          const monthLabel = new Date().toLocaleDateString("en-GB", {
            month: "long",
            year: "numeric",
          });
          return (
            <div className="rounded-lg border border-border bg-surface px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
                    Ad spend — {monthLabel}
                  </p>
                  <p className={`mt-1 font-display text-2xl font-semibold tabular-nums ${over ? "text-warning" : "text-brand-oxblood"}`}>
                    {fmt(spent)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs text-text-muted">Budget</p>
                  <p className="mt-0.5 text-sm font-semibold tabular-nums text-text">
                    {fmt(budget)}
                  </p>
                </div>
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-blush">
                <div
                  className={`h-full rounded-full transition-all ${over ? "bg-warning" : "bg-brand-oxblood"}`}
                  style={{ width: `${pct.toFixed(1)}%` }}
                />
              </div>
              <p className={`mt-1.5 text-xs ${over ? "text-warning" : "text-text-muted"}`}>
                {over
                  ? `Over budget by ${fmt(spent - budget)}`
                  : `${fmt(budget - spent)} remaining · ${pct.toFixed(0)}% used`}
              </p>
            </div>
          );
        })()}

        {/* ── Sales & profit over time ────────────────────────────────────── */}
        <section className="rounded-lg border border-border bg-surface">
          <div className="border-b border-border px-5 py-4">
            <h2 className="font-display text-base font-semibold text-brand-oxblood">
              Sales &amp; profit over time
            </h2>
          </div>
          <div className="px-2 py-4">
            {sales.length === 0 ? (
              <EmptyChart message="No sales in this period." />
            ) : (
              <ResponsiveContainer width="100%" height={256}>
                <ComposedChart
                  data={timeSeries}
                  margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    stroke="#ECCFCD"
                    strokeDasharray="4 4"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: "#8A6E6F" }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#8A6E6F" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={shortNum}
                    width={52}
                  />
                  <Tooltip content={(props) => <ChartTooltip {...props} formatter={fmt} />} />
                  <Legend
                    wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
                    formatter={(v: string) => (
                      <span style={{ color: "#2B1A1B" }}>{v}</span>
                    )}
                  />
                  <Area
                    type="monotone"
                    dataKey="Revenue"
                    stroke="#4A1416"
                    strokeWidth={2}
                    fill="#4A1416"
                    fillOpacity={0.07}
                    dot={singlePoint ? { r: 4, fill: "#4A1416" } : false}
                    activeDot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="Net profit"
                    stroke="#4E7C59"
                    strokeWidth={2}
                    dot={singlePoint ? { r: 4, fill: "#4E7C59" } : false}
                    activeDot={{ r: 4 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        {/* ── Best sellers + Expenses donut ───────────────────────────────── */}
        <div className="grid gap-6 md:grid-cols-5">

          {/* Best sellers */}
          <section className="rounded-lg border border-border bg-surface md:col-span-3">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="font-display text-base font-semibold text-brand-oxblood">
                Best sellers
              </h2>
              <div className="flex gap-1 rounded-card border border-border p-0.5">
                {(["units", "revenue"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSortBy(s)}
                    className={
                      "rounded-card px-2.5 py-1 text-xs font-medium transition-colors " +
                      (sortBy === s
                        ? "bg-brand-oxblood text-white"
                        : "text-text-muted hover:bg-blush/60")
                    }
                  >
                    {s === "units" ? "Units" : "Revenue"}
                  </button>
                ))}
              </div>
            </div>
            <div className="px-2 py-4">
              {bestSellers.length === 0 ? (
                <EmptyChart message="No sales in this period." />
              ) : (
                <ResponsiveContainer width="100%" height={256}>
                  <BarChart
                    data={bestSellers}
                    layout="vertical"
                    margin={{ top: 0, right: 16, left: 4, bottom: 0 }}
                  >
                    <CartesianGrid
                      stroke="#ECCFCD"
                      strokeDasharray="4 4"
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 11, fill: "#8A6E6F" }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={
                        sortBy === "revenue" ? shortNum : (v: number) => String(v)
                      }
                    />
                    <YAxis
                      type="category"
                      dataKey="shortName"
                      width={130}
                      tick={{ fontSize: 11, fill: "#2B1A1B" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: "#F4DAD9", opacity: 0.5 }}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0];
                        return (
                          <div className="rounded-lg border border-border bg-surface px-3 py-2 shadow-sm text-xs">
                            <p className="mb-1 font-medium text-text">
                              {(d.payload as { name: string }).name}
                            </p>
                            <p className="tabular-nums text-text-muted">
                              {sortBy === "revenue"
                                ? fmt(d.value as number)
                                : `${d.value} units`}
                            </p>
                          </div>
                        );
                      }}
                    />
                    <Bar
                      dataKey={sortBy === "revenue" ? "revenue" : "units"}
                      fill="#4A1416"
                      radius={[0, 4, 4, 0]}
                      maxBarSize={28}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </section>

          {/* Expenses donut */}
          <section className="rounded-lg border border-border bg-surface md:col-span-2">
            <div className="border-b border-border px-5 py-4">
              <h2 className="font-display text-base font-semibold text-brand-oxblood">
                Expenses by category
              </h2>
            </div>
            <div className="py-4">
              {expensesByCategory.length === 0 ? (
                <EmptyChart message="No expenses in this period." />
              ) : (
                <ResponsiveContainer width="100%" height={256}>
                  <PieChart>
                    <Pie
                      data={expensesByCategory}
                      cx="50%"
                      cy="45%"
                      innerRadius="45%"
                      outerRadius="65%"
                      paddingAngle={2}
                      dataKey="value"
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0];
                        return (
                          <div className="rounded-lg border border-border bg-surface px-3 py-2 shadow-sm text-xs">
                            <p className="mb-0.5 font-medium text-text">
                              {d.name}
                            </p>
                            <p className="tabular-nums text-text-muted">
                              {fmt(d.value as number)}
                            </p>
                          </div>
                        );
                      }}
                    />
                    <Legend
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: "11px", paddingTop: "4px" }}
                      formatter={(v: string) => (
                        <span style={{ color: "#2B1A1B" }}>{v}</span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </section>
        </div>

        {/* ── Sales by channel ───────────────────────────────────────────── */}
        <section className="rounded-lg border border-border bg-surface">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="font-display text-base font-semibold text-brand-oxblood">
              Sales by channel
            </h2>
            <div className="flex gap-1 rounded-card border border-border p-0.5">
              {(["revenue", "orders"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setChannelMetric(m)}
                  className={
                    "rounded-card px-2.5 py-1 text-xs font-medium transition-colors " +
                    (channelMetric === m
                      ? "bg-brand-oxblood text-white"
                      : "text-text-muted hover:bg-blush/60")
                  }
                >
                  {m === "revenue" ? "Revenue" : "Orders"}
                </button>
              ))}
            </div>
          </div>

          <div className="grid md:grid-cols-5">
            {/* Donut */}
            <div className="border-b border-border py-4 md:col-span-3 md:border-b-0 md:border-r">
              {channelData.length === 0 ? (
                <EmptyChart message="No sales in this period." />
              ) : (
                <ResponsiveContainer width="100%" height={256}>
                  <PieChart>
                    <Pie
                      data={[...channelData].sort((a, b) =>
                        channelMetric === "revenue"
                          ? b.revenue - a.revenue
                          : b.orders - a.orders
                      )}
                      cx="50%"
                      cy="45%"
                      innerRadius="40%"
                      outerRadius="62%"
                      paddingAngle={2}
                      dataKey={channelMetric}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const stats = payload[0].payload as {
                          name: string;
                          revenue: number;
                          orders: number;
                        };
                        return (
                          <div className="rounded-lg border border-border bg-surface px-3 py-2 shadow-sm text-xs">
                            <p className="mb-1 font-medium text-text">{stats.name}</p>
                            <p className="text-text-muted">
                              Revenue:{" "}
                              <span className="tabular-nums font-medium text-text">
                                {fmt(stats.revenue)}
                              </span>
                            </p>
                            <p className="text-text-muted">
                              Orders:{" "}
                              <span className="tabular-nums font-medium text-text">
                                {stats.orders}
                              </span>
                            </p>
                          </div>
                        );
                      }}
                    />
                    <Legend
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: "11px", paddingTop: "4px" }}
                      formatter={(v: string) => (
                        <span style={{ color: "#2B1A1B" }}>{v}</span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Ranked list */}
            <div className="md:col-span-2">
              <div className="border-b border-border px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
                  {channelMetric === "revenue" ? "By revenue" : "By orders"}
                </p>
              </div>
              {channelData.length === 0 ? (
                <p className="px-4 py-6 text-sm text-text-muted">No data in this period.</p>
              ) : (
                <ol className="divide-y divide-border">
                  {[...channelData]
                    .sort((a, b) =>
                      channelMetric === "revenue"
                        ? b.revenue - a.revenue
                        : b.orders - a.orders
                    )
                    .map(({ name, revenue, orders }) => {
                      const value = channelMetric === "revenue" ? revenue : orders;
                      const maxVal =
                        channelMetric === "revenue"
                          ? Math.max(...channelData.map((c) => c.revenue))
                          : Math.max(...channelData.map((c) => c.orders));
                      const pct = maxVal > 0 ? (value / maxVal) * 100 : 0;
                      return (
                        <li key={name} className="flex items-center gap-3 px-4 py-3">
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: CHANNEL_COLORS[name] ?? "#8A6E6F" }}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-text">{name}</p>
                            <div className="mt-1 h-1 overflow-hidden rounded-full bg-blush">
                              <div
                                className="h-full rounded-full bg-brand-oxblood transition-all"
                                style={{ width: `${pct.toFixed(1)}%` }}
                              />
                            </div>
                          </div>
                          <span className="shrink-0 tabular-nums text-sm font-medium text-brand-oxblood">
                            {channelMetric === "revenue" ? fmt(revenue) : orders}
                          </span>
                        </li>
                      );
                    })}
                </ol>
              )}
            </div>
          </div>
        </section>

        {/* ── Orders by city ─────────────────────────────────────────────── */}
        <section className="rounded-lg border border-border bg-surface">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="font-display text-base font-semibold text-brand-oxblood">
              Orders by city
            </h2>
            <div className="flex gap-1 rounded-card border border-border p-0.5">
              {(["orders", "revenue"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMapMetric(m)}
                  className={
                    "rounded-card px-2.5 py-1 text-xs font-medium transition-colors " +
                    (mapMetric === m
                      ? "bg-brand-oxblood text-white"
                      : "text-text-muted hover:bg-blush/60")
                  }
                >
                  {m === "orders" ? "Orders" : "Revenue"}
                </button>
              ))}
            </div>
          </div>

          <div className="grid md:grid-cols-5">
            {/* Map */}
            <div className="h-80 border-b border-border md:col-span-3 md:h-[440px] md:border-b-0 md:border-r">
              {citiesData.size === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-text-muted">
                  No city data in this period.
                </div>
              ) : (
                <IraqMap cities={citiesData} metric={mapMetric} fmtRevenue={(n) => fmt(n)} />
              )}
            </div>

            {/* Top cities ranked list */}
            <div className="md:col-span-2">
              <div className="border-b border-border px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
                  Top cities — {mapMetric === "orders" ? "by orders" : "by revenue"}
                </p>
              </div>
              {topCities.length === 0 ? (
                <p className="px-4 py-6 text-sm text-text-muted">
                  No data in this period.
                </p>
              ) : (
                <ol className="divide-y divide-border">
                  {topCities.map(([city, stats], i) => {
                    const value =
                      mapMetric === "orders" ? stats.orders : stats.revenue;
                    const maxVal =
                      mapMetric === "orders"
                        ? topCities[0][1].orders
                        : topCities[0][1].revenue;
                    const pct = maxVal > 0 ? (value / maxVal) * 100 : 0;
                    return (
                      <li
                        key={city}
                        className="flex items-center gap-3 px-4 py-3"
                      >
                        <span className="w-4 shrink-0 text-right text-xs text-text-muted">
                          {i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-text">
                            {city}
                          </p>
                          <div className="mt-1 h-1 overflow-hidden rounded-full bg-blush">
                            <div
                              className="h-full rounded-full bg-brand-oxblood transition-all"
                              style={{ width: `${pct.toFixed(1)}%` }}
                            />
                          </div>
                        </div>
                        <span className="shrink-0 tabular-nums text-sm font-medium text-brand-oxblood">
                          {mapMetric === "orders"
                            ? stats.orders
                            : fmt(stats.revenue)}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          </div>
        </section>
        {/* ── City performance ───────────────────────────────────────────── */}
        <section className="rounded-lg border border-border bg-surface">
          <div className="border-b border-border px-5 py-4">
            <h2 className="font-display text-base font-semibold text-brand-oxblood">
              City performance
            </h2>
            <p className="mt-0.5 text-xs text-text-muted">
              Sorted by revenue — {rangeSub}
            </p>
          </div>

          {cityPerf.length === 0 ? (
            <p className="px-5 py-8 text-sm text-text-muted">
              No city data in this period.
            </p>
          ) : (
            <>
              {/* Mobile: stacked cards */}
              <div className="divide-y divide-border md:hidden">
                {cityPerf.map(([city, stats]) => {
                  const grossPft = stats.revenue - stats.cogs;
                  const margin = stats.revenue > 0 ? (grossPft / stats.revenue) * 100 : 0;
                  const pctOfTotal = revenue > 0 ? (stats.revenue / revenue) * 100 : 0;
                  return (
                    <div key={city} className="space-y-2 px-4 py-4">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-text">{city}</span>
                        <span className="tabular-nums text-sm font-semibold text-brand-oxblood">
                          {fmt(stats.revenue)}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs text-text-muted">
                        <div>
                          <span className="block font-medium text-text">{stats.orders}</span>
                          Orders
                        </div>
                        <div>
                          <span className="block font-medium text-text">{fmt(stats.cogs)}</span>
                          COGS
                        </div>
                        <div>
                          <span className={`block font-medium ${grossPft < 0 ? "text-danger" : "text-text"}`}>
                            {fmt(grossPft)}
                          </span>
                          Net profit
                        </div>
                        <div>
                          <span className={`block font-medium ${margin < 0 ? "text-danger" : margin >= 20 ? "text-success" : "text-text"}`}>
                            {margin.toFixed(1)}%
                          </span>
                          Margin
                        </div>
                        <div>
                          <span className="block font-medium text-text">{pctOfTotal.toFixed(1)}%</span>
                          % of total
                        </div>
                      </div>
                      <InlineNote
                        city={city}
                        initial={cityNotes[city] ?? ""}
                        onSave={saveCityNote}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Desktop: table */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-blush/30">
                      {["City", "Orders", "Revenue", "COGS", "Net profit", "Margin", "% of total", "Growth note"].map(
                        (h, i) => (
                          <th
                            key={h}
                            className={
                              "px-4 py-3 text-xs font-semibold uppercase tracking-wide text-text-muted " +
                              (i === 0 || i === 7 ? "text-left" : "text-right")
                            }
                          >
                            {h}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {cityPerf.map(([city, stats]) => {
                      const grossPft = stats.revenue - stats.cogs;
                      const margin = stats.revenue > 0 ? (grossPft / stats.revenue) * 100 : 0;
                      const pctOfTotal = revenue > 0 ? (stats.revenue / revenue) * 100 : 0;
                      return (
                        <tr
                          key={city}
                          className="border-b border-border last:border-0 transition-colors hover:bg-blush/10"
                        >
                          <td className="px-4 py-3 font-medium text-text">{city}</td>
                          <td className="px-4 py-3 text-right tabular-nums text-text">
                            {stats.orders}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums font-medium text-brand-oxblood">
                            {fmt(stats.revenue)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-text-muted">
                            {fmt(stats.cogs)}
                          </td>
                          <td className={`px-4 py-3 text-right tabular-nums ${grossPft < 0 ? "text-danger" : "text-text"}`}>
                            {fmt(grossPft)}
                          </td>
                          <td className={`px-4 py-3 text-right tabular-nums ${margin < 0 ? "text-danger" : margin >= 20 ? "text-success" : "text-text"}`}>
                            {margin.toFixed(1)}%
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-text-muted">
                            {pctOfTotal.toFixed(1)}%
                          </td>
                          <td className="min-w-[200px] px-4 py-3">
                            <InlineNote
                              city={city}
                              initial={cityNotes[city] ?? ""}
                              onSave={saveCityNote}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
