"use client";

import { useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Customer, LoyaltySettings } from "@/types/database";
import CustomerDetail from "./CustomerDetail";
import { formatMoney, type Currency } from "@/lib/currency";

// ─── referral code generator (same charset as CustomerLookup) ─────────────────

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function genCode() {
  return Array.from({ length: 6 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join("");
}

const IRAQI_CITIES = [
  "Baghdad", "Basra", "Mosul", "Erbil", "Sulaymaniyah", "Kirkuk",
  "Najaf", "Karbala", "Nasiriyah", "Hillah", "Amarah", "Diwaniyah",
  "Kut", "Ramadi", "Duhok", "Samawah", "Baqubah", "Tikrit", "Halabja",
];

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmtDate(s: string) {
  return new Date(s + "T00:00:00").toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

// ─── shared pieces ────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, warn = false,
}: {
  label: string; value: string; sub?: string; warn?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4 md:p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{label}</p>
      <p className={
        "mt-2 font-display text-2xl font-semibold tabular-nums " +
        (warn ? "text-warning" : "text-brand-oxblood")
      }>
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-text-muted">{sub}</p>}
    </div>
  );
}

const inputCls =
  "mt-1 block w-full rounded-card border border-border bg-bg px-3 py-2 text-sm text-text focus:border-brand-oxblood focus:outline-none focus:ring-1 focus:ring-brand-oxblood";

const labelCls = "block text-sm font-medium text-text";

// ─── main component ───────────────────────────────────────────────────────────

interface Props {
  initialCustomers: Customer[];
  settings: LoyaltySettings;
}

export default function CustomersClient({ initialCustomers, settings: init }: Props) {
  const supabase = useMemo(() => createClient(), []);

  const baseCurrency = init.base_currency as Currency;
  const dispCurrency = init.display_currency as Currency;
  const rate = init.usd_iqd_rate;
  function fmt(n: number) {
    return formatMoney(n, dispCurrency, baseCurrency, rate);
  }

  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [query,    setQuery]    = useState("");
  const [selected, setSelected] = useState<Customer | null>(null);

  // ── New customer modal ────────────────────────────────────────────────────
  const [showNew,   setShowNew]   = useState(false);
  const [nf, setNf] = useState({ name: "", phone: "", city: "", referred_by: "" });
  const [nfSaving,  setNfSaving]  = useState(false);
  const [nfError,   setNfError]   = useState<string | null>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  function openNew() {
    setNf({ name: "", phone: "", city: "", referred_by: "" });
    setNfError(null);
    setShowNew(true);
    // focus first input after paint
    setTimeout(() => firstInputRef.current?.focus(), 50);
  }

  function nfField(k: keyof typeof nf) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setNf((p) => ({ ...p, [k]: e.target.value }));
    };
  }

  async function addCustomer(e: React.FormEvent) {
    e.preventDefault();
    if (!nf.name.trim() || !nf.phone.trim()) return;
    setNfSaving(true);
    setNfError(null);

    let referrerId: string | null = null;
    if (nf.referred_by.trim()) {
      const { data: ref } = await supabase
        .from("customers")
        .select("id")
        .eq("referral_code", nf.referred_by.trim().toUpperCase())
        .maybeSingle();
      if (!ref) {
        setNfError("Referral code not found.");
        setNfSaving(false);
        return;
      }
      referrerId = ref.id;
    }

    for (let attempt = 0; attempt < 10; attempt++) {
      const code = genCode();
      const { data, error } = await supabase
        .from("customers")
        .insert({
          name:         nf.name.trim(),
          phone:        nf.phone.trim(),
          city:         nf.city || null,
          referral_code: code,
          referred_by:  referrerId,
        })
        .select()
        .single();

      if (!error) {
        setCustomers((prev) => [data as Customer, ...prev]);
        setNfSaving(false);
        setShowNew(false);
        return;
      }

      if (error.code === "23505" && error.message.includes("referral_code")) continue;
      if (error.code === "23505" && error.message.includes("phone")) {
        setNfError("A customer with that phone number already exists.");
        setNfSaving(false);
        return;
      }

      setNfError(error.message);
      setNfSaving(false);
      return;
    }

    setNfError("Could not generate a unique referral code — please try again.");
    setNfSaving(false);
  }

  // ── Loyalty settings form ─────────────────────────────────────────────────
  const [sf, setSf] = useState({
    earn_rate:                 String(init.earn_rate),
    redeem_value:              String(init.redeem_value),
    referrer_bonus:            String(init.referrer_bonus),
    new_customer_discount_pct: String(init.new_customer_discount_pct),
  });
  const [sfSaving,  setSfSaving]  = useState(false);
  const [sfSaved,   setSfSaved]   = useState(false);
  const [sfError,   setSfError]   = useState<string | null>(null);

  function sfField(k: keyof typeof sf) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setSf((p) => ({ ...p, [k]: e.target.value }));
      setSfSaved(false);
    };
  }

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSfError(null);
    setSfSaving(true);
    const { error } = await supabase.from("settings").upsert({
      id: 1,
      earn_rate:                 parseFloat(sf.earn_rate),
      redeem_value:              parseFloat(sf.redeem_value),
      referrer_bonus:            parseInt(sf.referrer_bonus, 10),
      new_customer_discount_pct: parseFloat(sf.new_customer_discount_pct),
    });
    setSfSaving(false);
    if (error) { setSfError(error.message); return; }
    setSfSaved(true);
  }

  // ── Computed stats ────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total        = customers.length;
    const repeat       = customers.filter((c) => c.total_orders > 1).length;
    const repeatRate   = total > 0 ? (repeat / total) * 100 : 0;
    const totalPoints  = customers.reduce((s, c) => s + c.points_balance, 0);
    const totalRefer   = customers.filter((c) => c.referred_by !== null).length;
    return { total, repeatRate, totalPoints, totalRefer };
  }, [customers]);

  // ── Search filter ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) => c.name.toLowerCase().includes(q) || c.phone.includes(q),
    );
  }, [customers, query]);

  return (
    <div className="min-h-screen bg-bg">
      {/* Page header */}
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 md:px-8">
          <div>
            <h1 className="font-display text-2xl font-bold text-brand-oxblood">Customers</h1>
            <p className="mt-0.5 text-sm text-text-muted">
              Loyalty programme and customer directory.
            </p>
          </div>
          <button
            onClick={openNew}
            className="shrink-0 rounded-card bg-brand-oxblood px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-oxblood-deep"
          >
            + New customer
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 px-4 py-6 md:px-8">

        {/* ── Loyalty stats ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          <StatCard
            label="Total customers"
            value={stats.total.toLocaleString()}
            sub="all time"
          />
          <StatCard
            label="Repeat customers"
            value={`${stats.repeatRate.toFixed(0)}%`}
            sub={`${customers.filter((c) => c.total_orders > 1).length} of ${stats.total}`}
          />
          <StatCard
            label="Points outstanding"
            value={stats.totalPoints.toLocaleString()}
            sub={`≈ ${fmt(stats.totalPoints * parseFloat(sf.redeem_value || "0"))} in discounts`}
            warn={stats.totalPoints > 0}
          />
          <StatCard
            label="Total referrals"
            value={stats.totalRefer.toLocaleString()}
            sub={stats.total > 0 ? `${((stats.totalRefer / stats.total) * 100).toFixed(0)}% of customers` : undefined}
          />
        </div>

        {/* ── Search ──────────────────────────────────────────────────────── */}
        <div className="relative">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
            width="16" height="16" viewBox="0 0 20 20" fill="currentColor" aria-hidden
          >
            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd"/>
          </svg>
          <input
            type="search"
            placeholder="Search by name or phone…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface py-2.5 pl-9 pr-4 text-sm text-text placeholder:text-text-muted focus:border-brand-oxblood focus:outline-none focus:ring-1 focus:ring-brand-oxblood"
          />
        </div>

        {/* ── Customer list ────────────────────────────────────────────────── */}
        <section>
          {filtered.length === 0 ? (
            <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-border text-sm text-text-muted">
              {query ? "No customers match your search." : "No customers yet."}
            </div>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="space-y-3 md:hidden">
                {filtered.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelected(c)}
                    className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-left transition-colors hover:bg-blush/20"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-text">{c.name}</p>
                        <p className="mt-0.5 text-xs text-text-muted">{c.phone}</p>
                      </div>
                      <span className="shrink-0 font-mono text-xs font-semibold tracking-widest text-brand-oxblood">
                        {c.referral_code}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-4 text-xs text-text-muted">
                      {c.city && <span>{c.city}</span>}
                      <span>{c.total_orders} order{c.total_orders !== 1 ? "s" : ""}</span>
                      <span>{fmt(c.total_spent)} spent</span>
                      <span className={c.points_balance > 0 ? "text-success" : ""}>
                        {c.points_balance} pts
                      </span>
                    </div>
                  </button>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden overflow-hidden rounded-lg border border-border md:block">
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-surface">
                    <tr>
                      {["Name", "Phone", "City", "Orders", "Spent", "Points", "Code", "Since"].map((h) => (
                        <th
                          key={h}
                          className={
                            "px-4 py-3 text-xs font-medium uppercase tracking-wide text-text-muted " +
                            (["Orders", "Spent", "Points"].includes(h) ? "text-right" : "text-left")
                          }
                        >
                          {h}
                        </th>
                      ))}
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-surface">
                    {filtered.map((c) => (
                      <tr
                        key={c.id}
                        onClick={() => setSelected(c)}
                        className="cursor-pointer transition-colors hover:bg-blush/20"
                      >
                        <td className="px-4 py-3 font-medium text-text">{c.name}</td>
                        <td className="px-4 py-3 text-text-muted">{c.phone}</td>
                        <td className="px-4 py-3 text-text-muted">{c.city ?? "—"}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-text">
                          {c.total_orders}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-text">
                          {fmt(c.total_spent)}
                        </td>
                        <td className={
                          "px-4 py-3 text-right tabular-nums font-medium " +
                          (c.points_balance > 0 ? "text-success" : "text-text-muted")
                        }>
                          {c.points_balance.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs font-semibold tracking-widest text-brand-oxblood">
                          {c.referral_code}
                        </td>
                        <td className="px-4 py-3 text-text-muted">
                          {fmtDate(c.created_at.slice(0, 10))}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-brand-oxblood underline-offset-2 hover:underline">
                            View →
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="border-t border-border bg-surface px-4 py-2 text-xs text-text-muted">
                  {filtered.length} customer{filtered.length !== 1 ? "s" : ""}
                  {query && ` matching "${query}"`}
                </div>
              </div>
            </>
          )}
        </section>

        {/* ── Loyalty settings ─────────────────────────────────────────────── */}
        <section className="rounded-lg border border-border bg-surface">
          <div className="border-b border-border px-5 py-4">
            <h2 className="font-display text-base font-semibold text-brand-oxblood">
              Loyalty settings
            </h2>
            <p className="mt-0.5 text-xs text-text-muted">
              Changes apply to all future transactions.
            </p>
          </div>

          <form onSubmit={saveSettings}>
            <div className="grid gap-4 p-5 sm:grid-cols-2">

              {/* Earn rate */}
              <div>
                <label className={labelCls}>Earn rate</label>
                <p className="mb-1 text-xs text-text-muted">
                  Points per 1.00 of order value (e.g. 0.10 → 10 pts on 100.00)
                </p>
                <input
                  required type="number" min="0" step="0.01"
                  value={sf.earn_rate} onChange={sfField("earn_rate")}
                  className={inputCls}
                />
              </div>

              {/* Redeem value */}
              <div>
                <label className={labelCls}>Redeem value</label>
                <p className="mb-1 text-xs text-text-muted">
                  Discount per point (e.g. 0.01 → 100 pts = 1.00 off)
                </p>
                <input
                  required type="number" min="0" step="0.001"
                  value={sf.redeem_value} onChange={sfField("redeem_value")}
                  className={inputCls}
                />
              </div>

              {/* Referrer bonus */}
              <div>
                <label className={labelCls}>Referrer bonus (pts)</label>
                <p className="mb-1 text-xs text-text-muted">
                  Points awarded when a referred customer completes their first order
                </p>
                <input
                  required type="number" min="0" step="1"
                  value={sf.referrer_bonus} onChange={sfField("referrer_bonus")}
                  className={inputCls}
                />
              </div>

              {/* Welcome discount */}
              <div>
                <label className={labelCls}>Welcome discount (%)</label>
                <p className="mb-1 text-xs text-text-muted">
                  % off for new customers who use a referral code on their first order
                </p>
                <input
                  required type="number" min="0" max="100" step="0.5"
                  value={sf.new_customer_discount_pct}
                  onChange={sfField("new_customer_discount_pct")}
                  className={inputCls}
                />
              </div>
            </div>

            {sfError && (
              <p className="mx-5 mb-4 rounded-card bg-danger/10 px-3 py-2 text-sm text-danger">
                {sfError}
              </p>
            )}

            <div className="flex items-center justify-end gap-3 border-t border-border px-5 py-4">
              {sfSaved && <span className="text-sm text-success">Saved.</span>}
              <button
                type="submit"
                disabled={sfSaving}
                className="rounded-card bg-brand-oxblood px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-oxblood-deep disabled:opacity-50"
              >
                {sfSaving ? "Saving…" : "Save settings"}
              </button>
            </div>
          </form>
        </section>

      </main>

      {/* Customer detail drawer */}
      <CustomerDetail customer={selected} settings={init} onClose={() => setSelected(null)} />

      {/* ── New customer modal ────────────────────────────────────────────── */}
      {showNew && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-text/30 backdrop-blur-sm"
            onClick={() => setShowNew(false)}
          />

          {/* Dialog */}
          <div
            role="dialog"
            aria-modal
            aria-label="New customer"
            className="fixed inset-x-4 top-1/2 z-50 mx-auto max-w-md -translate-y-1/2 rounded-xl border border-border bg-surface shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="font-display text-lg font-bold text-brand-oxblood">New customer</h2>
              <button
                onClick={() => setShowNew(false)}
                aria-label="Close"
                className="rounded-card p-1.5 text-text-muted transition-colors hover:bg-blush hover:text-text"
              >
                <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                  <path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" />
                </svg>
              </button>
            </div>

            <form onSubmit={addCustomer}>
              <div className="space-y-4 p-5">

                {/* Name */}
                <div>
                  <label className={labelCls}>Name *</label>
                  <input
                    ref={firstInputRef}
                    required
                    type="text"
                    placeholder="Full name"
                    value={nf.name}
                    onChange={nfField("name")}
                    className={inputCls}
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className={labelCls}>Phone *</label>
                  <input
                    required
                    type="tel"
                    placeholder="e.g. 07901234567"
                    value={nf.phone}
                    onChange={nfField("phone")}
                    className={inputCls}
                  />
                </div>

                {/* City */}
                <div>
                  <label className={labelCls}>City</label>
                  <select
                    value={nf.city}
                    onChange={nfField("city")}
                    className={inputCls}
                  >
                    <option value="">Select…</option>
                    {IRAQI_CITIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                {/* Referred by */}
                <div>
                  <label className={labelCls}>Referred by (optional)</label>
                  <p className="mb-1 text-xs text-text-muted">
                    Enter the referral code of the customer who referred them.
                  </p>
                  <input
                    type="text"
                    placeholder="e.g. ABC123"
                    maxLength={8}
                    value={nf.referred_by}
                    onChange={nfField("referred_by")}
                    className={inputCls + " font-mono uppercase tracking-widest"}
                  />
                </div>

                {nfError && (
                  <p className="rounded-card bg-danger/10 px-3 py-2 text-sm text-danger">
                    {nfError}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-border px-5 py-4">
                <button
                  type="button"
                  onClick={() => setShowNew(false)}
                  className="rounded-card border border-border px-4 py-2 text-sm text-text-muted transition-colors hover:bg-blush"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={nfSaving}
                  className="rounded-card bg-brand-oxblood px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-oxblood-deep disabled:opacity-50"
                >
                  {nfSaving ? "Saving…" : "Add customer"}
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
