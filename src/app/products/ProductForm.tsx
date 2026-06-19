"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { LoyaltySettings, Product } from "@/types/database";
import CurrencyInput from "@/components/CurrencyInput";
import type { Currency } from "@/lib/currency";

type FormData = {
  name: string;
  sku: string;
  category: string;
  selling_price: string;
  current_stock: string;
  avg_cost: string;
  reorder_level: string;
};

const EMPTY: FormData = {
  name: "",
  sku: "",
  category: "",
  selling_price: "",
  current_stock: "0",
  avg_cost: "",
  reorder_level: "0",
};

function toForm(p: Product): FormData {
  return {
    name: p.name,
    sku: p.sku,
    category: p.category,
    selling_price: String(p.selling_price),
    current_stock: String(p.current_stock),
    avg_cost: String(p.avg_cost),
    reorder_level: String(p.reorder_level),
  };
}

interface Props {
  product: Product | null;
  settings: LoyaltySettings;
  onSaved: (product: Product) => void;
  onClose: () => void;
}

const inputCls =
  "mt-1 block w-full rounded-card border border-border bg-bg px-3 py-2 text-sm text-text tabular-nums placeholder:text-text-muted focus:border-brand-oxblood focus:outline-none focus:ring-1 focus:ring-brand-oxblood";

// ─── dev-only seed data ───────────────────────────────────────────────────

const DEV_NAMES = [
  "Silk crepe blouse",
  "Velvet midi dress",
  "Linen wide-leg trousers",
  "Cashmere turtleneck",
  "Leather crossbody bag",
  "Wool wrap coat",
  "Cotton midi skirt",
  "Satin slip dress",
  "Tweed blazer",
  "Embroidered scarf",
  "Suede ankle boots",
  "Printed chiffon blouse",
];

const DEV_CATEGORIES = [
  "Tops",
  "Dresses",
  "Bottoms",
  "Outerwear",
  "Accessories",
  "Footwear",
  "Knitwear",
];

function fakeProduct(): FormData {
  const name = DEV_NAMES[Math.floor(Math.random() * DEV_NAMES.length)];
  const price = Math.round((45 + Math.random() * 305) * 100) / 100;
  const cost = Math.round(price * (0.3 + Math.random() * 0.3) * 100) / 100;
  const stock = Math.floor(Math.random() * 35);
  const reorder = Math.floor(3 + Math.random() * 8);
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  const sku = `${initials}-${Math.floor(100 + Math.random() * 900)}`;

  return {
    name,
    sku,
    category: DEV_CATEGORIES[Math.floor(Math.random() * DEV_CATEGORIES.length)],
    selling_price: price.toFixed(2),
    avg_cost: cost.toFixed(2),
    current_stock: String(stock),
    reorder_level: String(reorder),
  };
}

export default function ProductForm({ product, settings, onSaved, onClose }: Props) {
  const [form, setForm] = useState<FormData>(product ? toForm(product) : EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();
  const baseCurrency = settings.base_currency as Currency;
  const rate = settings.usd_iqd_rate;

  function set(field: keyof FormData) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const payload = {
      name: form.name.trim(),
      sku: form.sku.trim().toUpperCase(),
      category: form.category.trim(),
      selling_price: parseFloat(form.selling_price),
      current_stock: parseInt(form.current_stock, 10),
      avg_cost: parseFloat(form.avg_cost || "0"),
      reorder_level: parseInt(form.reorder_level || "0", 10),
    };

    const query = product
      ? supabase.from("products").update(payload).eq("id", product.id).select().single()
      : supabase.from("products").insert(payload).select().single();

    const { data, error: err } = await query;
    setSaving(false);

    if (err) {
      setError(err.message);
      return;
    }

    onSaved(data as Product);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-text/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="relative w-full max-h-[92dvh] overflow-y-auto rounded-t-xl sm:rounded-xl bg-surface shadow-2xl sm:max-w-lg">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-surface px-6 py-4">
          <h2 className="font-display text-lg font-semibold text-brand-oxblood">
            {product ? "Edit product" : "Add product"}
          </h2>
          <div className="flex items-center gap-3">
            {process.env.NODE_ENV === "development" && (
              <button
                type="button"
                onClick={() => setForm(fakeProduct())}
                className="rounded border border-dashed border-text-muted/40 px-2 py-0.5 font-mono text-xs text-text-muted transition-colors hover:border-brand-rose hover:text-brand-rose"
                title="Fill with random test data (dev only)"
              >
                ⚡ fill
              </button>
            )}
            <button
              onClick={onClose}
              className="text-xl leading-none text-text-muted hover:text-text"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text">
                Name <span className="text-danger">*</span>
              </label>
              <input
                required
                value={form.name}
                onChange={set("name")}
                placeholder="Silk blouse"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text">
                SKU <span className="text-danger">*</span>
              </label>
              <input
                required
                value={form.sku}
                onChange={set("sku")}
                placeholder="BLK-001"
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text">
              Category <span className="text-danger">*</span>
            </label>
            <input
              required
              value={form.category}
              onChange={set("category")}
              placeholder="Tops"
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text">
                Selling price <span className="text-danger">*</span>
              </label>
              <CurrencyInput
                required
                min="0"
                placeholder="0"
                value={form.selling_price}
                onChange={(base) => setForm((prev) => ({ ...prev, selling_price: base }))}
                baseCurrency={baseCurrency}
                defaultRate={rate}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text">
                Avg cost
              </label>
              <CurrencyInput
                min="0"
                placeholder="0"
                value={form.avg_cost}
                onChange={(base) => setForm((prev) => ({ ...prev, avg_cost: base }))}
                baseCurrency={baseCurrency}
                defaultRate={rate}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text">
                Stock <span className="text-danger">*</span>
              </label>
              <input
                required
                type="number"
                min="0"
                step="1"
                value={form.current_stock}
                onChange={set("current_stock")}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text">
                Reorder level
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={form.reorder_level}
                onChange={set("reorder_level")}
                className={inputCls}
              />
            </div>
          </div>

          {error && (
            <p className="rounded-card bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-card border border-border px-4 py-2 text-sm font-medium text-text transition-colors hover:bg-blush"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-card bg-brand-oxblood px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-oxblood-deep disabled:opacity-50"
            >
              {saving ? "Saving…" : product ? "Save changes" : "Add product"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
