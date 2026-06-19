"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { LoyaltySettings, Product, PurchaseWithProduct } from "@/types/database";
import CurrencyInput from "@/components/CurrencyInput";
import { formatMoney, type Currency } from "@/lib/currency";

// ─── helpers ─────────────────────────────────────────────────────────────────

function today() {
  return new Date().toISOString().slice(0, 10);
}

function fmtDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

// ─── dev autofill ─────────────────────────────────────────────────────────────

const DEV_SUPPLIERS = [
  "Milan Textile Co.", "Istanbul Fashion Hub", "Dubai Fabric House",
  "Beirut Style Imports", "Cairo Silk Traders", "Paris Mode Exports",
];

function fakePurchase(products: Product[]): FormData {
  if (!products.length) return EMPTY;
  const p = products[Math.floor(Math.random() * products.length)];
  const baseCost = p.avg_cost > 0 ? p.avg_cost : 30;
  const cost = (baseCost * (0.85 + Math.random() * 0.3)).toFixed(2);
  const d = new Date();
  d.setDate(d.getDate() - Math.floor(Math.random() * 7));
  return {
    product_id: p.id,
    quantity: String(Math.floor(5 + Math.random() * 26)),
    unit_cost: cost,
    date: d.toISOString().slice(0, 10),
    supplier: DEV_SUPPLIERS[Math.floor(Math.random() * DEV_SUPPLIERS.length)],
  };
}

// ─── types ───────────────────────────────────────────────────────────────────

type FormData = {
  product_id: string;
  quantity: string;
  unit_cost: string;
  date: string;
  supplier: string;
};

const EMPTY: FormData = {
  product_id: "",
  quantity: "",
  unit_cost: "",
  date: today(),
  supplier: "",
};

const selectCls =
  "mt-1 block w-full rounded-card border border-border bg-bg px-3 py-2 text-sm text-text tabular-nums placeholder:text-text-muted focus:border-brand-oxblood focus:outline-none focus:ring-1 focus:ring-brand-oxblood disabled:opacity-50";

// ─── history card (mobile) ────────────────────────────────────────────────────

function HistoryCard({ p, fmt }: { p: PurchaseWithProduct; fmt: (n: number) => string }) {
  const total = p.quantity * p.unit_cost;
  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium text-text">
            {p.products?.name ?? "—"}
          </p>
          <p className="text-xs text-text-muted">
            {p.products?.sku ?? "—"} · {fmtDate(p.date)}
          </p>
        </div>
        <p className="shrink-0 tabular-nums text-sm font-semibold text-text">
          {fmt(total)}
        </p>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
        <div>
          <p className="text-xs text-text-muted">Qty</p>
          <p className="tabular-nums font-medium text-text">{p.quantity}</p>
        </div>
        <div>
          <p className="text-xs text-text-muted">Unit cost</p>
          <p className="tabular-nums font-medium text-text">{fmt(p.unit_cost)}</p>
        </div>
        <div>
          <p className="text-xs text-text-muted">Supplier</p>
          <p className="truncate font-medium text-text">{p.supplier ?? "—"}</p>
        </div>
      </div>
    </div>
  );
}

// ─── main ────────────────────────────────────────────────────────────────────

interface Props {
  initialProducts: Product[];
  initialHistory: PurchaseWithProduct[];
  settings: LoyaltySettings;
}

export default function PurchasesClient({ initialProducts, initialHistory, settings }: Props) {
  const [form, setForm] = useState<FormData>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState(initialHistory);

  const supabase = useMemo(() => createClient(), []);

  const baseCurrency  = settings.base_currency as Currency;
  const dispCurrency  = settings.display_currency as Currency;
  const rate          = settings.usd_iqd_rate;

  function fmt(n: number) {
    return formatMoney(n, dispCurrency, baseCurrency, rate);
  }

  function field(key: keyof FormData) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value }));
  }

  function handleProductChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    const product = initialProducts.find((p) => p.id === id);
    setForm((prev) => ({
      ...prev,
      product_id: id,
      unit_cost: product && product.avg_cost > 0 ? String(product.avg_cost) : prev.unit_cost,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const qty = parseInt(form.quantity, 10);
    const cost = parseFloat(form.unit_cost);

    const { data: product, error: fetchErr } = await supabase
      .from("products")
      .select("current_stock, avg_cost")
      .eq("id", form.product_id)
      .single();

    if (fetchErr || !product) {
      setError(fetchErr?.message ?? "Could not load product");
      setSaving(false);
      return;
    }

    const prevStock = product.current_stock;
    const prevCost = product.avg_cost;
    const newAvgCost =
      prevStock + qty === 0
        ? cost
        : (prevStock * prevCost + qty * cost) / (prevStock + qty);

    const { error: updateErr } = await supabase
      .from("products")
      .update({
        current_stock: prevStock + qty,
        avg_cost: Math.round(newAvgCost * 10000) / 10000,
      })
      .eq("id", form.product_id);

    if (updateErr) {
      setError(updateErr.message);
      setSaving(false);
      return;
    }

    const { data: saved, error: insertErr } = await supabase
      .from("purchases")
      .insert({
        product_id: form.product_id,
        quantity: qty,
        unit_cost: cost,
        date: form.date,
        supplier: form.supplier.trim() || null,
      })
      .select("id, product_id, quantity, unit_cost, date, supplier, created_at, products(name, sku)")
      .single();

    if (insertErr || !saved) {
      setError(insertErr?.message ?? "Insert failed");
      setSaving(false);
      return;
    }

    setHistory((prev) => [saved as unknown as PurchaseWithProduct, ...prev]);
    setForm((prev) => ({ ...EMPTY, date: prev.date }));
    setSaving(false);
  }

  const previewTotal =
    form.quantity && form.unit_cost
      ? parseInt(form.quantity || "0", 10) * parseFloat(form.unit_cost || "0")
      : null;

  return (
    <div className="min-h-screen bg-bg">
      {/* ── Header ── */}
      <header className="border-b border-border bg-surface">
        <div className="mx-auto max-w-3xl px-4 py-4 md:px-8">
          <h1 className="font-display text-2xl font-bold text-brand-oxblood">Purchases</h1>
          <p className="mt-0.5 text-sm text-text-muted">
            Record stock replenishments and update weighted-average cost.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-8 px-4 py-6 md:px-8">
        {/* ── Restock form ── */}
        <section className="rounded-lg border border-border bg-surface">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="font-display text-base font-semibold text-brand-oxblood">
              Record restock
            </h2>
            {process.env.NODE_ENV === "development" && (
              <button
                type="button"
                onClick={() => setForm(fakePurchase(initialProducts))}
                className="rounded border border-dashed border-text-muted/40 px-2 py-0.5 font-mono text-xs text-text-muted transition-colors hover:border-brand-rose hover:text-brand-rose"
                title="Fill with random test data (dev only)"
              >
                ⚡ fill
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 p-5">
            {/* Product */}
            <div>
              <label className="block text-sm font-medium text-text">
                Product <span className="text-danger">*</span>
              </label>
              <select
                required
                value={form.product_id}
                onChange={handleProductChange}
                className={selectCls}
              >
                <option value="">Select a product…</option>
                {initialProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.sku})
                  </option>
                ))}
              </select>
            </div>

            {/* Qty + Unit cost */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text">
                  Quantity <span className="text-danger">*</span>
                </label>
                <input
                  required
                  type="number"
                  min="1"
                  step="1"
                  value={form.quantity}
                  onChange={field("quantity")}
                  placeholder="0"
                  className={selectCls}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text">
                  Unit cost <span className="text-danger">*</span>
                </label>
                <CurrencyInput
                  required
                  min="0"
                  value={form.unit_cost}
                  onChange={(base) => setForm((prev) => ({ ...prev, unit_cost: base }))}
                  baseCurrency={baseCurrency}
                  defaultRate={rate}
                  placeholder="0"
                />
              </div>
            </div>

            {/* Date + Supplier */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text">
                  Date <span className="text-danger">*</span>
                </label>
                <input
                  required
                  type="date"
                  value={form.date}
                  onChange={field("date")}
                  className={selectCls}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text">Supplier</label>
                <input
                  type="text"
                  value={form.supplier}
                  onChange={field("supplier")}
                  placeholder="Supplier name"
                  className={selectCls}
                />
              </div>
            </div>

            {previewTotal !== null && previewTotal > 0 && (
              <p className="text-sm text-text-muted">
                Total:{" "}
                <span className="font-semibold tabular-nums text-text">
                  {fmt(previewTotal)}
                </span>
              </p>
            )}

            {error && (
              <p className="rounded-card bg-danger/10 px-3 py-2 text-sm text-danger">
                {error}
              </p>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="rounded-card bg-brand-oxblood px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-oxblood-deep disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save purchase"}
              </button>
            </div>
          </form>
        </section>

        {/* ── History ── */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-muted">
            Past purchases{history.length > 0 && ` · ${history.length}`}
          </h2>

          {history.length === 0 ? (
            <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-border bg-surface">
              <p className="text-sm text-text-muted">No purchases recorded yet.</p>
            </div>
          ) : (
            <>
              {/* Mobile: stacked cards */}
              <div className="flex flex-col gap-3 md:hidden">
                {history.map((p) => (
                  <HistoryCard key={p.id} p={p} fmt={fmt} />
                ))}
              </div>

              {/* Desktop: table */}
              <div className="hidden overflow-x-auto rounded-lg border border-border bg-surface md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-blush/30">
                      {["Date", "Product", "Qty", `Unit cost (${dispCurrency})`, `Total (${dispCurrency})`, "Supplier"].map(
                        (h) => (
                          <th
                            key={h}
                            className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-text-muted ${
                              ["Qty"].includes(h) ? "text-right" : h.startsWith("Unit") || h.startsWith("Total") ? "text-right" : "text-left"
                            }`}
                          >
                            {h}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((p) => (
                      <tr
                        key={p.id}
                        className="border-b border-border last:border-0 transition-colors hover:bg-blush/20"
                      >
                        <td className="whitespace-nowrap px-4 py-3 text-text-muted">
                          {fmtDate(p.date)}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-medium text-text">
                            {p.products?.name ?? "—"}
                          </span>
                          <br />
                          <span className="text-xs text-text-muted">{p.products?.sku}</span>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-text">
                          {p.quantity}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-text">
                          {fmt(p.unit_cost)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-medium text-text">
                          {fmt(p.quantity * p.unit_cost)}
                        </td>
                        <td className="px-4 py-3 text-text-muted">
                          {p.supplier ?? "—"}
                        </td>
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
