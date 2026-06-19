import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import type { Expense, LoyaltySettings } from "@/types/database";
import ExpensesClient from "./ExpensesClient";

export const metadata: Metadata = { title: "Expenses" };

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

export default async function ExpensesPage() {
  const supabase = await createClient();

  const [{ data }, { data: settingsRow }] = await Promise.all([
    supabase
      .from("expenses")
      .select("*")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("settings").select("*").eq("id", 1).maybeSingle(),
  ]);

  return (
    <ExpensesClient
      initialExpenses={(data as Expense[]) ?? []}
      settings={(settingsRow as LoyaltySettings) ?? DEFAULT_SETTINGS}
    />
  );
}
