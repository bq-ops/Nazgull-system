import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import type { LoyaltySettings } from "@/types/database";
import ReportsClient, { type WeekRow, type MonthRow } from "./ReportsClient";

export const metadata: Metadata = { title: "Reports" };

const DEFAULT_SETTINGS: LoyaltySettings = {
  id: 1,
  earn_rate: 0.1,
  redeem_value: 0.01,
  referrer_bonus: 100,
  new_customer_discount_pct: 10,
  base_currency: "IQD",
  usd_iqd_rate: 1310,
  display_currency: "IQD",
  default_bundle_price: 0,
  monthly_ad_budget: 0,
};

// ─── Grouping helpers ─────────────────────────────────────────────────────────

function weekStartOf(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay(); // 0=Sun … 6=Sat
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day)); // back to Monday
  return d.toISOString().slice(0, 10);
}

function weekLabel(start: string): string {
  const s = new Date(start + "T00:00:00");
  const e = new Date(start + "T00:00:00");
  e.setDate(s.getDate() + 6);
  const o: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  return (
    s.toLocaleDateString("en-GB", o) +
    " – " +
    e.toLocaleDateString("en-GB", { ...o, year: "numeric" })
  );
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-GB", {
    month: "short",
    year: "numeric",
  });
}

// ─── Raw data types ───────────────────────────────────────────────────────────

type RawItem = { quantity: number; unit_price: number; cost_at_sale: number };
type RawSale = { date: string; discount_amount: number; sale_items: RawItem[] };
type RawExpense = { date: string; amount: number };

// ─── Aggregation ──────────────────────────────────────────────────────────────

function buildWeeks(sales: RawSale[], expenses: RawExpense[]): WeekRow[] {
  const map = new Map<string, WeekRow>();

  function ensure(ws: string): WeekRow {
    if (!map.has(ws)) {
      map.set(ws, {
        key: ws,
        label: weekLabel(ws),
        orders: 0,
        units: 0,
        revenue: 0,
        cogs: 0,
        expenses: 0,
        grossProfit: 0,
        netProfit: 0,
        netMargin: 0,
      });
    }
    return map.get(ws)!;
  }

  for (const s of sales) {
    const row = ensure(weekStartOf(s.date));
    row.orders++;
    let saleRev = 0;
    for (const item of s.sale_items) {
      saleRev += item.quantity * item.unit_price;
      row.cogs += item.quantity * item.cost_at_sale;
      row.units += item.quantity;
    }
    row.revenue += saleRev - s.discount_amount;
  }

  for (const e of expenses) {
    ensure(weekStartOf(e.date)).expenses += e.amount;
  }

  for (const row of map.values()) {
    row.grossProfit = row.revenue - row.cogs;
    row.netProfit = row.grossProfit - row.expenses;
    row.netMargin = row.revenue > 0 ? (row.netProfit / row.revenue) * 100 : 0;
  }

  return [...map.values()].sort((a, b) => b.key.localeCompare(a.key));
}

function buildMonths(sales: RawSale[], expenses: RawExpense[]): MonthRow[] {
  const map = new Map<string, MonthRow>();

  function ensure(key: string): MonthRow {
    if (!map.has(key)) {
      map.set(key, {
        key,
        label: monthLabel(key),
        orders: 0,
        revenue: 0,
        cogs: 0,
        expenses: 0,
        grossProfit: 0,
        netProfit: 0,
        netMargin: 0,
      });
    }
    return map.get(key)!;
  }

  for (const s of sales) {
    const row = ensure(s.date.slice(0, 7));
    row.orders++;
    let saleRev = 0;
    for (const item of s.sale_items) {
      saleRev += item.quantity * item.unit_price;
      row.cogs += item.quantity * item.cost_at_sale;
    }
    row.revenue += saleRev - s.discount_amount;
  }

  for (const e of expenses) {
    ensure(e.date.slice(0, 7)).expenses += e.amount;
  }

  for (const row of map.values()) {
    row.grossProfit = row.revenue - row.cogs;
    row.netProfit = row.grossProfit - row.expenses;
    row.netMargin = row.revenue > 0 ? (row.netProfit / row.revenue) * 100 : 0;
  }

  // Descending for table display; client re-sorts ascending for chart
  return [...map.values()].sort((a, b) => b.key.localeCompare(a.key));
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ReportsPage() {
  const supabase = await createClient();

  const [salesRes, expensesRes, settingsRes] = await Promise.all([
    supabase
      .from("sales")
      .select("date, discount_amount, sale_items(quantity, unit_price, cost_at_sale)")
      .neq("status", "returned"),
    supabase.from("expenses").select("date, amount"),
    supabase.from("settings").select("*").eq("id", 1).maybeSingle(),
  ]);

  const sales = (salesRes.data ?? []) as unknown as RawSale[];
  const expenses = (expensesRes.data ?? []) as RawExpense[];
  const settings = (settingsRes.data as LoyaltySettings) ?? DEFAULT_SETTINGS;

  return (
    <ReportsClient
      weeks={buildWeeks(sales, expenses)}
      months={buildMonths(sales, expenses)}
      settings={settings}
    />
  );
}
