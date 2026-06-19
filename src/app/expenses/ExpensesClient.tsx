"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Expense, LoyaltySettings } from "@/types/database";
import CurrencyInput from "@/components/CurrencyInput";
import { formatMoney, type Currency } from "@/lib/currency";

const CATEGORIES = [
  "Advertising", "Marketing", "Platform fees", "Payment processing",
  "Shipping", "Software", "Returns", "Other",
] as const;

const CATEGORY_COLORS: Record<string, string> = {
  "Advertising":         "#4A1416",
  "Marketing":           "#C98B92",
  "Platform fees":       "#B5792B",
  "Payment processing":  "#4E7C59",
  "Shipping":            "#8A6E6F",
  "Software":            "#2B1A1B",
  "Returns":             "#B23A48",
  "Other":               "#ECCFCD",
};

type Form = { category: string; amount: string; date: string; note: string };

function today() { return new Date().toISOString().slice(0, 10); }

const EMPTY: Form = { category: "", amount: "", date: today(), note: "" };

const inputCls =
  "mt-1 block w-full rounded-card border border-border bg-bg px-3 py-2 text-sm text-text focus:border-brand-oxblood focus:outline-none focus:ring-1 focus:ring-brand-oxblood";

const labelCls = "block text-sm font-medium text-text";

function fmtDate(s: string) {
  return new Date(s + "T00:00:00").toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function devFill(): Form {
  const cat = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
  const amount = (10 + Math.random() * 490).toFixed(2);
  const d = new Date();
  d.setDate(d.getDate() - Math.floor(Math.random() * 60));
  const devNotes: Record<string, string[]> = {
    "Advertising":         ["Instagram campaign", "Facebook ads", "TikTok boost"],
    "Marketing":           ["Influencer partnership", "Photography shoot", "Promo materials"],
    "Platform fees":       ["Shopify monthly", "WooCommerce plugin", "Marketplace commission"],
    "Payment processing":  ["Stripe fees", "PayPal monthly", "Transaction charges"],
    "Shipping":            ["DHL bulk shipment", "Aramex account", "Packaging supplies"],
    "Software":            ["Notion subscription", "Canva Pro", "Google Workspace"],
    "Returns":             ["Customer refund", "Damaged goods credit", "Return postage"],
    "Other":               ["Office supplies", "Bank transfer fee", "Miscellaneous"],
  };
  const notes = devNotes[cat] ?? [];
  const note = Math.random() > 0.4 ? notes[Math.floor(Math.random() * notes.length)] : "";
  return { category: cat, amount, date: d.toISOString().slice(0, 10), note: note ?? "" };
}

interface Props {
  initialExpenses: Expense[];
  settings: LoyaltySettings;
}

export default function ExpensesClient({ initialExpenses, settings }: Props) {
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses);
  const [form, setForm] = useState<Form>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = useMemo(() => createClient(), []);

  const baseCurrency = settings.base_currency as Currency;
  const dispCurrency = settings.display_currency as Currency;
  const rate = settings.usd_iqd_rate;

  function fmt(n: number) {
    return formatMoney(n, dispCurrency, baseCurrency, rate);
  }

  function field(key: keyof Form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const { data, error: err } = await supabase
      .from("expenses")
      .insert({
        category: form.category,
        amount: parseFloat(form.amount),
        date: form.date,
        note: form.note.trim() || null,
      })
      .select()
      .single();

    setSaving(false);
    if (err) { setError(err.message); return; }

    setExpenses((prev) => [data as Expense, ...prev]);
    setForm((prev) => ({ ...EMPTY, date: prev.date, category: prev.category }));
  }

  const breakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const ex of expenses) {
      map.set(ex.category, (map.get(ex.category) ?? 0) + ex.amount);
    }
    return [...map.entries()]
      .sort(([, a], [, b]) => b - a)
      .map(([category, total]) => ({ category, total }));
  }, [expenses]);

  const grandTotal = breakdown.reduce((sum, { total }) => sum + total, 0);

  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto max-w-5xl px-4 py-4 md:px-8">
          <h1 className="font-display text-2xl font-bold text-brand-oxblood">Expenses</h1>
          <p className="mt-0.5 text-sm text-text-muted">
            Track operating costs and see spending by category.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 px-4 py-6 md:px-8">

        {/* Log expense form */}
        <section className="rounded-lg border border-border bg-surface">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="font-display text-base font-semibold text-brand-oxblood">Log expense</h2>
            {process.env.NODE_ENV === "development" && (
              <button type="button" onClick={() => setForm(devFill())}
                className="rounded border border-border px-2 py-0.5 text-xs text-text-muted hover:bg-blush/50">
                ⚡ fill
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Category</label>
                <select required value={form.category} onChange={field("category")} className={inputCls}>
                  <option value="">Select category…</option>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label className={labelCls}>Amount ({dispCurrency})</label>
                <CurrencyInput
                  required
                  min="0"
                  placeholder="0"
                  value={form.amount}
                  onChange={(base) => setForm((prev) => ({ ...prev, amount: base }))}
                  baseCurrency={baseCurrency}
                  defaultRate={rate}
                />
              </div>

              <div>
                <label className={labelCls}>Date</label>
                <input required type="date" value={form.date} onChange={field("date")} className={inputCls} />
              </div>

              <div>
                <label className={labelCls}>
                  Note <span className="font-normal text-text-muted">(optional)</span>
                </label>
                <input type="text" placeholder="e.g. Shopify monthly subscription"
                  value={form.note} onChange={field("note")} className={inputCls} />
              </div>
            </div>

            {error && (
              <div className="mx-5 mb-4 rounded-card bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div>
            )}

            <div className="flex justify-end border-t border-border px-5 py-4">
              <button type="submit" disabled={saving}
                className="rounded-card bg-brand-oxblood px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-oxblood-deep disabled:opacity-50">
                {saving ? "Saving…" : "Save expense"}
              </button>
            </div>
          </form>
        </section>

        {/* Totals by category */}
        {breakdown.length > 0 && (
          <section className="rounded-lg border border-border bg-surface">
            <div className="border-b border-border px-5 py-4">
              <h2 className="font-display text-base font-semibold text-brand-oxblood">Totals by category</h2>
            </div>
            <div className="divide-y divide-border">
              {breakdown.map(({ category, total }) => {
                const pct = grandTotal > 0 ? (total / grandTotal) * 100 : 0;
                return (
                  <div key={category} className="flex items-center gap-4 px-5 py-3">
                    <div className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: CATEGORY_COLORS[category] ?? "#8A6E6F" }} />
                    <span className="min-w-[12rem] text-sm text-text">{category}</span>
                    <div className="flex flex-1 items-center gap-3">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-blush">
                        <div className="h-full rounded-full transition-all"
                          style={{ width: `${pct.toFixed(1)}%`, backgroundColor: CATEGORY_COLORS[category] ?? "#8A6E6F" }} />
                      </div>
                      <span className="w-8 text-right text-xs text-text-muted">{pct.toFixed(0)}%</span>
                    </div>
                    <span className="w-28 text-right text-sm tabular-nums text-text">{fmt(total)}</span>
                  </div>
                );
              })}
              <div className="flex items-center gap-4 bg-blush/30 px-5 py-3">
                <div className="h-2.5 w-2.5 shrink-0" />
                <span className="min-w-[12rem] text-sm font-semibold text-text">Total</span>
                <div className="flex flex-1 items-center gap-3">
                  <div className="h-1.5 flex-1" /><span className="w-8" />
                </div>
                <span className="w-28 text-right text-sm font-semibold tabular-nums text-brand-oxblood">
                  {fmt(grandTotal)}
                </span>
              </div>
            </div>
          </section>
        )}

        {/* History */}
        <section>
          <h2 className="mb-3 font-display text-base font-semibold text-brand-oxblood">
            History
            {expenses.length > 0 && (
              <span className="ml-2 text-sm font-normal text-text-muted">({expenses.length})</span>
            )}
          </h2>

          {expenses.length === 0 ? (
            <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-border text-sm text-text-muted">
              No expenses recorded yet.
            </div>
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {expenses.map((ex) => (
                  <div key={ex.id} className="rounded-lg border border-border bg-surface px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: CATEGORY_COLORS[ex.category] ?? "#8A6E6F" }} />
                        <span className="text-sm font-medium text-text">{ex.category}</span>
                      </div>
                      <span className="tabular-nums text-sm font-semibold text-brand-oxblood">
                        {fmt(ex.amount)}
                      </span>
                    </div>
                    <p className="mt-1 pl-4 text-xs text-text-muted">{fmtDate(ex.date)}</p>
                    {ex.note && <p className="mt-1 pl-4 text-xs text-text-muted italic">{ex.note}</p>}
                  </div>
                ))}
              </div>

              <div className="hidden overflow-hidden rounded-lg border border-border md:block">
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-surface">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-text-muted">Date</th>
                      <th className="px-4 py-3 text-left font-medium text-text-muted">Category</th>
                      <th className="px-4 py-3 text-right font-medium text-text-muted">Amount ({dispCurrency})</th>
                      <th className="px-4 py-3 text-left font-medium text-text-muted">Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-surface">
                    {expenses.map((ex) => (
                      <tr key={ex.id} className="hover:bg-blush/20 transition-colors">
                        <td className="whitespace-nowrap px-4 py-3 text-text-muted">{fmtDate(ex.date)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-2 shrink-0 rounded-full"
                              style={{ backgroundColor: CATEGORY_COLORS[ex.category] ?? "#8A6E6F" }} />
                            <span className="text-text">{ex.category}</span>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums font-medium text-text">
                          {fmt(ex.amount)}
                        </td>
                        <td className="px-4 py-3 text-text-muted italic">{ex.note ?? "—"}</td>
                      </tr>
                    ))}
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
