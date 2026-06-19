import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import type { LoyaltySettings, Product, PurchaseWithProduct } from "@/types/database";
import PurchasesClient from "./PurchasesClient";

export const metadata: Metadata = { title: "Purchases" };

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

export default async function PurchasesPage() {
  const supabase = await createClient();

  const [{ data: products }, { data: purchases }, { data: settingsRow }] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, sku, avg_cost, current_stock")
      .order("name"),
    supabase
      .from("purchases")
      .select("id, product_id, quantity, unit_cost, date, supplier, created_at, products(name, sku)")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("settings").select("*").eq("id", 1).maybeSingle(),
  ]);

  return (
    <PurchasesClient
      initialProducts={(products as Product[]) ?? []}
      initialHistory={(purchases as unknown as PurchaseWithProduct[]) ?? []}
      settings={(settingsRow as LoyaltySettings) ?? DEFAULT_SETTINGS}
    />
  );
}
