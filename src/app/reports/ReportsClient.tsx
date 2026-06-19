"use client";

import { useMemo } from "react";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { formatMoney, type Currency } from "@/lib/currency";
import type { LoyaltySettings } from "@/types/database";

// ─── Shared row types (also imported by page.tsx) ────────────────────────────

export interface WeekRow {
  key: string;
  label: string;
  orders: number;
  units: number;
  revenue: number;
  cogs: number;
  expenses: number;
  grossProfit: number;
  netProfit: number;
  netMargin: number;
}

export interface MonthRow {
  key: string;
  label: string;
  orders: number;
  revenue: number;
  cogs: number;
  expenses: number;
  grossProfit: number;
  netProfit: number;
  netMargin: number;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th
      className={
        "whitespace-nowrap px-3 py-3 text-xs font-semibold uppercase tracking-wide text-text-muted " +
        (right ? "text-right" : "text-left")
      }
    >
      {children}
    </th>
  );
}

function Td({
  children,
  right,
  muted,
}: {
  children: React.ReactNode;
  right?: boolean;
  muted?: boolean;
}) {
  return (
    <td
      className={
        "px-3 py-3 text-sm " +
        (right ? "text-right tabular-nums " : "") +
        (muted ? "text-text-muted" : "text-text")
      }
    >
      {children}
    </td>
  );
}

function MarginBadge({ margin }: { margin: number }) {
  return margin >= 20 ? (
    <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
      Good
    </span>
  ) : (
    <span className="rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
      Watch
    </span>
  );
}

function MarginNum({ n }: { n: number }) {
  return (
    <span
      className={
        n < 0 ? "text-danger" : n >= 20 ? "text-success" : "text-text"
      }
    >
      {n.toFixed(1)}%
    </span>
  );
}

function ProfitNum({ n, fmt }: { n: number; fmt: (v: number) => string }) {
  return (
    <span className={n < 0 ? "text-danger" : "text-text"}>{fmt(n)}</span>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-border bg-surface">
      <p className="text-sm text-text-muted">{message}</p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  weeks: WeekRow[];
  months: MonthRow[];
  settings: LoyaltySettings;
}

export default function ReportsClient({ weeks, months, settings }: Props) {
  const baseCurrency = settings.base_currency as Currency;
  const dispCurrency = settings.display_currency as Currency;
  const rate = settings.usd_iqd_rate;

  function fmt(n: number) {
    return formatMoney(n, dispCurrency, baseCurrency, rate);
  }

  function shortNum(n: number) {
    const abs = Math.abs(n);
    if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
    return String(Math.round(n));
  }

  // Ascending order for chart, last 12 months
  const chartData = useMemo(
    () => [...months].sort((a, b) => a.key.localeCompare(b.key)).slice(-12),
    [months],
  );

  // Monthly totals row
  const monthTotals = useMemo(() => {
    const t = months.reduce(
      (acc, r) => ({
        orders: acc.orders + r.orders,
        revenue: acc.revenue + r.revenue,
        cogs: acc.cogs + r.cogs,
        expenses: acc.expenses + r.expenses,
        grossProfit: acc.grossProfit + r.grossProfit,
        netProfit: acc.netProfit + r.netProfit,
      }),
      { orders: 0, revenue: 0, cogs: 0, expenses: 0, grossProfit: 0, netProfit: 0 },
    );
    return {
      ...t,
      netMargin: t.revenue > 0 ? (t.netProfit / t.revenue) * 100 : 0,
    };
  }, [months]);

  return (
    <div className="min-h-screen bg-bg">
      {/* Header */}
      <header className="border-b border-border bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-4 md:px-8">
          <h1 className="font-display text-2xl font-bold text-brand-oxblood">
            Reports
          </h1>
          <p className="mt-0.5 text-sm text-text-muted">
            Performance summaries — returned sales excluded.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 px-4 py-6 md:px-8">

        {/* ── 1. Weekly summary ──────────────────────────────────────────── */}
        <section>
          <h2 className="mb-3 font-display text-lg font-semibold text-brand-oxblood">
            Weekly summary
          </h2>
          {weeks.length === 0 ? (
            <EmptyState message="No sales data yet." />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border bg-surface">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-blush/30">
                    <Th>Week</Th>
                    <Th right>Orders</Th>
                    <Th right>Units</Th>
                    <Th right>Revenue</Th>
                    <Th right>COGS</Th>
                    <Th right>Expenses</Th>
                    <Th right>Gross profit</Th>
                    <Th right>Net profit</Th>
                    <Th right>Net margin</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {weeks.map((row) => (
                    <tr
                      key={row.key}
                      className="border-b border-border last:border-0 transition-colors hover:bg-blush/10"
                    >
                      <Td>
                        <span className="whitespace-nowrap text-text-muted">
                          {row.label}
                        </span>
                      </Td>
                      <Td right>{row.orders}</Td>
                      <Td right>{row.units}</Td>
                      <Td right>{fmt(row.revenue)}</Td>
                      <Td right muted>{fmt(row.cogs)}</Td>
                      <Td right muted>
                        {row.expenses > 0 ? fmt(row.expenses) : "—"}
                      </Td>
                      <Td right>{fmt(row.grossProfit)}</Td>
                      <Td right>
                        <ProfitNum n={row.netProfit} fmt={fmt} />
                      </Td>
                      <Td right>
                        <MarginNum n={row.netMargin} />
                      </Td>
                      <td className="px-3 py-3">
                        <MarginBadge margin={row.netMargin} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ── 2. Monthly summary ─────────────────────────────────────────── */}
        <section>
          <h2 className="mb-3 font-display text-lg font-semibold text-brand-oxblood">
            Monthly summary
          </h2>
          {months.length === 0 ? (
            <EmptyState message="No sales data yet." />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border bg-surface">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-blush/30">
                    <Th>Month</Th>
                    <Th right>Orders</Th>
                    <Th right>Revenue</Th>
                    <Th right>COGS</Th>
                    <Th right>Expenses</Th>
                    <Th right>Gross profit</Th>
                    <Th right>Net profit</Th>
                    <Th right>Net margin</Th>
                  </tr>
                </thead>
                <tbody>
                  {months.map((row) => (
                    <tr
                      key={row.key}
                      className="border-b border-border last:border-0 transition-colors hover:bg-blush/10"
                    >
                      <Td>
                        <span className="whitespace-nowrap font-medium text-text">
                          {row.label}
                        </span>
                      </Td>
                      <Td right>{row.orders}</Td>
                      <Td right>{fmt(row.revenue)}</Td>
                      <Td right muted>{fmt(row.cogs)}</Td>
                      <Td right muted>
                        {row.expenses > 0 ? fmt(row.expenses) : "—"}
                      </Td>
                      <Td right>{fmt(row.grossProfit)}</Td>
                      <Td right>
                        <ProfitNum n={row.netProfit} fmt={fmt} />
                      </Td>
                      <Td right>
                        <MarginNum n={row.netMargin} />
                      </Td>
                    </tr>
                  ))}
                  {/* Totals */}
                  {months.length > 1 && (
                    <tr className="border-t-2 border-border bg-blush/20 font-semibold">
                      <td className="px-3 py-3 text-sm text-text">Total</td>
                      <td className="px-3 py-3 text-right text-sm tabular-nums">
                        {monthTotals.orders}
                      </td>
                      <td className="px-3 py-3 text-right text-sm tabular-nums">
                        {fmt(monthTotals.revenue)}
                      </td>
                      <td className="px-3 py-3 text-right text-sm tabular-nums text-text-muted">
                        {fmt(monthTotals.cogs)}
                      </td>
                      <td className="px-3 py-3 text-right text-sm tabular-nums text-text-muted">
                        {monthTotals.expenses > 0
                          ? fmt(monthTotals.expenses)
                          : "—"}
                      </td>
                      <td className="px-3 py-3 text-right text-sm tabular-nums">
                        {fmt(monthTotals.grossProfit)}
                      </td>
                      <td className="px-3 py-3 text-right text-sm tabular-nums">
                        <ProfitNum n={monthTotals.netProfit} fmt={fmt} />
                      </td>
                      <td className="px-3 py-3 text-right text-sm tabular-nums">
                        <MarginNum n={monthTotals.netMargin} />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ── 3. Month-over-month chart ──────────────────────────────────── */}
        <section className="rounded-lg border border-border bg-surface">
          <div className="border-b border-border px-5 py-4">
            <h2 className="font-display text-base font-semibold text-brand-oxblood">
              Revenue vs net profit — month over month
            </h2>
            <p className="mt-0.5 text-xs text-text-muted">Last 12 months</p>
          </div>
          <div className="px-2 py-4">
            {chartData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-text-muted">
                No data to display.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={288}>
                <ComposedChart
                  data={chartData}
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
                  <Tooltip
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    content={({ active, payload, label }: any) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="rounded-lg border border-border bg-surface px-3 py-2 shadow-sm">
                          {label && (
                            <p className="mb-1.5 text-xs text-text-muted">
                              {label}
                            </p>
                          )}
                          {payload.map(
                            (
                              p: { name: string; value: number; color: string },
                              i: number,
                            ) => (
                              <div
                                key={i}
                                className="flex items-center gap-2 text-xs"
                              >
                                <span
                                  className="inline-block h-2 w-2 shrink-0 rounded-full"
                                  style={{ backgroundColor: p.color }}
                                />
                                <span className="text-text-muted">{p.name}:</span>
                                <span className="font-medium tabular-nums text-text">
                                  {fmt(p.value)}
                                </span>
                              </div>
                            ),
                          )}
                        </div>
                      );
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
                    formatter={(v: string) => (
                      <span style={{ color: "#2B1A1B" }}>{v}</span>
                    )}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    name="Revenue"
                    stroke="#4A1416"
                    strokeWidth={2}
                    fill="#4A1416"
                    fillOpacity={0.07}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="netProfit"
                    name="Net profit"
                    stroke="#4E7C59"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
