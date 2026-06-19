"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { LoyaltySettings } from "@/types/database";

type Form = {
  earn_rate: string;
  redeem_value: string;
  referrer_bonus: string;
  new_customer_discount_pct: string;
  base_currency: string;
  usd_iqd_rate: string;
  display_currency: string;
  default_bundle_price: string;
  monthly_ad_budget: string;
};

function toForm(s: LoyaltySettings): Form {
  return {
    earn_rate: String(s.earn_rate),
    redeem_value: String(s.redeem_value),
    referrer_bonus: String(s.referrer_bonus),
    new_customer_discount_pct: String(s.new_customer_discount_pct),
    base_currency: s.base_currency ?? "IQD",
    usd_iqd_rate: String(s.usd_iqd_rate ?? 1310),
    display_currency: s.display_currency ?? "IQD",
    default_bundle_price: String(s.default_bundle_price ?? 0),
    monthly_ad_budget: String(s.monthly_ad_budget ?? 0),
  };
}

const inputCls =
  "mt-1 block w-full rounded-card border border-border bg-bg px-3 py-2 text-sm text-text tabular-nums focus:border-brand-oxblood focus:outline-none focus:ring-1 focus:ring-brand-oxblood";

interface Props {
  settings: LoyaltySettings;
}

export default function SettingsClient({ settings }: Props) {
  const [form, setForm] = useState<Form>(toForm(settings));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = useMemo(() => createClient(), []);

  function field(key: keyof Form) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [key]: e.target.value }));
      setSaved(false);
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const payload = {
      earn_rate: parseFloat(form.earn_rate),
      redeem_value: parseFloat(form.redeem_value),
      referrer_bonus: parseInt(form.referrer_bonus, 10),
      new_customer_discount_pct: parseFloat(form.new_customer_discount_pct),
      base_currency: form.base_currency,
      usd_iqd_rate: parseFloat(form.usd_iqd_rate),
      display_currency: form.display_currency,
      default_bundle_price: parseFloat(form.default_bundle_price || "0"),
      monthly_ad_budget: parseFloat(form.monthly_ad_budget || "0"),
    };

    const { error: err } = await supabase
      .from("settings")
      .upsert({ id: 1, ...payload });

    setSaving(false);
    if (err) { setError(err.message); return; }
    setSaved(true);
  }

  // Live preview helpers
  const earnRate   = parseFloat(form.earn_rate || "0");
  const redeemVal  = parseFloat(form.redeem_value || "0");
  const refBonus   = parseInt(form.referrer_bonus || "0", 10);
  const discPct    = parseFloat(form.new_customer_discount_pct || "0");

  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto max-w-xl px-4 py-4 md:px-8">
          <h1 className="font-display text-2xl font-bold text-brand-oxblood">Settings</h1>
          <p className="mt-0.5 text-sm text-text-muted">Loyalty programme rules.</p>
        </div>
      </header>

      <main className="mx-auto max-w-xl space-y-6 px-4 py-6 md:px-8">
        {/* Currency */}
        <form onSubmit={handleSubmit} className="rounded-lg border border-border bg-surface">
          <div className="border-b border-border px-5 py-4">
            <h2 className="font-display text-base font-semibold text-brand-oxblood">
              Currency
            </h2>
          </div>
          <div className="space-y-5 p-5">
            {/* base_currency */}
            <div>
              <label className="block text-sm font-medium text-text">
                Base currency
              </label>
              <p className="mb-1 text-xs text-text-muted">
                All amounts are stored in this currency.
              </p>
              <select
                value={form.base_currency}
                onChange={(e) => { setForm((p) => ({ ...p, base_currency: e.target.value })); setSaved(false); }}
                className={inputCls}
              >
                <option value="IQD">IQD — Iraqi Dinar</option>
                <option value="USD">USD — US Dollar</option>
              </select>
            </div>

            {/* usd_iqd_rate */}
            <div>
              <label className="block text-sm font-medium text-text">
                USD → IQD rate
              </label>
              <p className="mb-1 text-xs text-text-muted">
                How many IQD equal 1 USD. Used as the default rate on money inputs.
              </p>
              <input
                required
                type="number"
                min="1"
                step="1"
                value={form.usd_iqd_rate}
                onChange={(e) => { setForm((p) => ({ ...p, usd_iqd_rate: e.target.value })); setSaved(false); }}
                className={inputCls}
              />
              {parseFloat(form.usd_iqd_rate) > 0 && (
                <p className="mt-1 text-xs text-text-muted">
                  1 USD = <span className="font-medium text-text">{parseFloat(form.usd_iqd_rate).toLocaleString("en-US")} IQD</span>
                </p>
              )}
            </div>

            {/* display_currency */}
            <div>
              <label className="block text-sm font-medium text-text">
                Display currency
              </label>
              <p className="mb-1 text-xs text-text-muted">
                Default display currency on the dashboard (can be toggled per session).
              </p>
              <select
                value={form.display_currency}
                onChange={(e) => { setForm((p) => ({ ...p, display_currency: e.target.value })); setSaved(false); }}
                className={inputCls}
              >
                <option value="IQD">IQD — Iraqi Dinar</option>
                <option value="USD">USD — US Dollar</option>
              </select>
            </div>

            {error && (
              <p className="rounded-card bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
            )}
            <div className="flex items-center justify-end gap-3 pt-1">
              {saved && <span className="text-sm text-success">Saved.</span>}
              <button
                type="submit"
                disabled={saving}
                className="rounded-card bg-brand-oxblood px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-oxblood-deep disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save settings"}
              </button>
            </div>
          </div>
        </form>

        {/* Loyalty */}
        <form onSubmit={handleSubmit} className="rounded-lg border border-border bg-surface">
          <div className="border-b border-border px-5 py-4">
            <h2 className="font-display text-base font-semibold text-brand-oxblood">
              Loyalty settings
            </h2>
          </div>

          <div className="space-y-5 p-5">
            {/* earn_rate */}
            <div>
              <label className="block text-sm font-medium text-text">
                Earn rate
              </label>
              <p className="text-xs text-text-muted mb-1">
                Points earned per 1.00 of order value (e.g. 0.10 → 10 pts on a 100.00 order).
              </p>
              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={form.earn_rate}
                onChange={field("earn_rate")}
                className={inputCls}
              />
              {earnRate > 0 && (
                <p className="mt-1 text-xs text-text-muted">
                  100.00 sale → <span className="font-medium text-text">{Math.floor(100 * earnRate)} pts</span>
                </p>
              )}
            </div>

            {/* redeem_value */}
            <div>
              <label className="block text-sm font-medium text-text">
                Redeem value
              </label>
              <p className="text-xs text-text-muted mb-1">
                Discount per point redeemed (e.g. 0.01 → 100 pts = 1.00 off).
              </p>
              <input
                required
                type="number"
                min="0"
                step="0.001"
                value={form.redeem_value}
                onChange={field("redeem_value")}
                className={inputCls}
              />
              {redeemVal > 0 && (
                <p className="mt-1 text-xs text-text-muted">
                  100 pts → <span className="font-medium text-text">{(100 * redeemVal).toFixed(2)} discount</span>
                </p>
              )}
            </div>

            {/* referrer_bonus */}
            <div>
              <label className="block text-sm font-medium text-text">
                Referrer bonus (points)
              </label>
              <p className="text-xs text-text-muted mb-1">
                Points awarded to the referrer when a referred customer completes their first order.
              </p>
              <input
                required
                type="number"
                min="0"
                step="1"
                value={form.referrer_bonus}
                onChange={field("referrer_bonus")}
                className={inputCls}
              />
              {refBonus > 0 && redeemVal > 0 && (
                <p className="mt-1 text-xs text-text-muted">
                  Worth <span className="font-medium text-text">{(refBonus * redeemVal).toFixed(2)}</span> in discounts
                </p>
              )}
            </div>

            {/* new_customer_discount_pct */}
            <div>
              <label className="block text-sm font-medium text-text">
                Welcome discount (%)
              </label>
              <p className="text-xs text-text-muted mb-1">
                Percentage off for a new customer who uses a referral code on their first order.
              </p>
              <input
                required
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={form.new_customer_discount_pct}
                onChange={field("new_customer_discount_pct")}
                className={inputCls}
              />
              {discPct > 0 && (
                <p className="mt-1 text-xs text-text-muted">
                  100.00 order → <span className="font-medium text-text">{discPct}% off = {(100 * discPct / 100).toFixed(2)}</span>
                </p>
              )}
            </div>

            {/* default_bundle_price */}
            <div>
              <label className="block text-sm font-medium text-text">
                Default bundle price
              </label>
              <p className="mb-1 text-xs text-text-muted">
                Pre-fills the price field when you add a bundle line on a sale.
                Set to 0 to leave it blank.
              </p>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.default_bundle_price}
                onChange={(e) => { setForm((p) => ({ ...p, default_bundle_price: e.target.value })); setSaved(false); }}
                className={inputCls}
              />
            </div>

            {error && (
              <p className="rounded-card bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
            )}

            <div className="flex items-center justify-end gap-3 pt-1">
              {saved && (
                <span className="text-sm text-success">Saved.</span>
              )}
              <button
                type="submit"
                disabled={saving}
                className="rounded-card bg-brand-oxblood px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-oxblood-deep disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save settings"}
              </button>
            </div>
          </div>
        </form>
        {/* Budgets */}
        <form onSubmit={handleSubmit} className="rounded-lg border border-border bg-surface">
          <div className="border-b border-border px-5 py-4">
            <h2 className="font-display text-base font-semibold text-brand-oxblood">
              Budgets
            </h2>
          </div>
          <div className="space-y-5 p-5">
            <div>
              <label className="block text-sm font-medium text-text">
                Monthly advertising budget
              </label>
              <p className="mb-1 text-xs text-text-muted">
                Shown as a progress bar on the dashboard against this month&apos;s
                Advertising expenses. Set to 0 to hide the widget.
              </p>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.monthly_ad_budget}
                onChange={(e) => { setForm((p) => ({ ...p, monthly_ad_budget: e.target.value })); setSaved(false); }}
                className={inputCls}
              />
            </div>

            {error && (
              <p className="rounded-card bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
            )}
            <div className="flex items-center justify-end gap-3 pt-1">
              {saved && <span className="text-sm text-success">Saved.</span>}
              <button
                type="submit"
                disabled={saving}
                className="rounded-card bg-brand-oxblood px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-oxblood-deep disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save settings"}
              </button>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}
