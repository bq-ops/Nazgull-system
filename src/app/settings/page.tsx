import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import type { LoyaltySettings } from "@/types/database";
import SettingsClient from "./SettingsClient";

export const metadata: Metadata = { title: "Settings" };

const DEFAULTS: LoyaltySettings = {
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

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("settings").select("*").eq("id", 1).maybeSingle();
  return <SettingsClient settings={(data as LoyaltySettings) ?? DEFAULTS} />;
}
