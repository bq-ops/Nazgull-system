import type { Metadata } from "next";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { LoyaltySettings } from "@/types/database";
import DashboardClient, {
  type SaleForDash,
  type ExpenseForDash,
} from "./DashboardClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Dashboard" };

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

function computeRange(
  range: string,
  fromParam?: string,
  toParam?: string,
): { from: string; to: string } {
  const todayStr = new Date().toISOString().slice(0, 10);
  if (range === "today") return { from: todayStr, to: todayStr };
  if (range === "week") {
    const d = new Date();
    const day = d.getDay();
    d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
    return { from: d.toISOString().slice(0, 10), to: todayStr };
  }
  if (range === "custom" && fromParam && toParam) {
    return { from: fromParam, to: toParam };
  }
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return { from: `${d.getFullYear()}-${mm}-01`, to: todayStr };
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  await connection();
  const params = await searchParams;
  const range = params.range ?? "month";
  const { from, to } = computeRange(range, params.from, params.to);

  const supabase = await createClient();

  const todayStr = new Date().toISOString().slice(0, 10);
  const monthStart = todayStr.slice(0, 7) + "-01";

  const [salesRes, expensesRes, productsRes, settingsRes, adSpendRes, cityNotesRes] =
    await Promise.all([
      supabase
        .from("sales")
        .select(
          `id, date, city, channel, discount_amount,
           sale_items(quantity, unit_price, cost_at_sale, product_id,
             products(name, sku))`,
        )
        .gte("date", from)
        .lte("date", to)
        .neq("status", "returned"),
      supabase
        .from("expenses")
        .select("category, amount, date")
        .gte("date", from)
        .lte("date", to),
      supabase.from("products").select("current_stock, reorder_level"),
      supabase.from("settings").select("*").eq("id", 1).maybeSingle(),
      supabase
        .from("expenses")
        .select("amount")
        .eq("category", "Advertising")
        .gte("date", monthStart)
        .lte("date", todayStr),
      supabase.from("city_notes").select("city, note"),
    ]);

  const allProducts = productsRes.data ?? [];
  const lowStockCount = allProducts.filter(
    (p) => p.current_stock <= p.reorder_level,
  ).length;

  const thisMonthAdSpend = (adSpendRes.data ?? []).reduce(
    (s: number, r: { amount: number }) => s + r.amount,
    0,
  );

  const cityNotes: Record<string, string> = {};
  for (const row of cityNotesRes.data ?? []) {
    cityNotes[(row as { city: string; note: string }).city] =
      (row as { city: string; note: string }).note;
  }

  return (
    <DashboardClient
      sales={(salesRes.data ?? []) as unknown as SaleForDash[]}
      expenses={(expensesRes.data ?? []) as ExpenseForDash[]}
      lowStockCount={lowStockCount}
      range={range}
      from={from}
      to={to}
      settings={(settingsRes.data as LoyaltySettings) ?? DEFAULT_SETTINGS}
      thisMonthAdSpend={thisMonthAdSpend}
      cityNotes={cityNotes}
    />
  );
}
