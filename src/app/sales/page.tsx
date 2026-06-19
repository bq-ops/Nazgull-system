import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import type { LoyaltySettings, Product, SaleWithDetails } from "@/types/database";
import SalesClient from "./SalesClient";

export const metadata: Metadata = { title: "Sales" };

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

export default async function SalesPage() {
  const supabase = await createClient();

  const [{ data: products }, { data: sales }, { data: settingsRow }] =
    await Promise.all([
      supabase.from("products").select("id, name, sku, selling_price, avg_cost").order("name"),
      supabase
        .from("sales")
        .select(`
          id, date, city, channel, status, points_earned, points_redeemed,
          discount_amount, referral_code_used, customer_id, created_at,
          customers(name, phone),
          sale_items(id, product_id, quantity, unit_price, cost_at_sale, line_type, bundle_components, products(name, sku))
        `)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(100),
      supabase.from("settings").select("*").eq("id", 1).maybeSingle(),
    ]);

  return (
    <SalesClient
      initialProducts={(products as Product[]) ?? []}
      initialHistory={(sales as unknown as SaleWithDetails[]) ?? []}
      settings={(settingsRow as LoyaltySettings) ?? DEFAULT_SETTINGS}
    />
  );
}
