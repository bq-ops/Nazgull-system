"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Product } from "@/types/database";
import ProductForm from "./ProductForm";

// ─── helpers ───────────────────────────────────────────────────────────────

function isLow(p: Product) {
  return p.current_stock <= p.reorder_level;
}

function margin(price: number, cost: number): string {
  if (price === 0) return "—";
  return (((price - cost) / price) * 100).toFixed(1) + "%";
}

function fmt(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ─── mobile card ────────────────────────────────────────────────────────────

function ProductCard({
  product,
  onEdit,
  onDelete,
  confirming,
  deleting,
  onConfirm,
  onCancelDelete,
}: {
  product: Product;
  onEdit: () => void;
  onDelete: () => void;
  confirming: boolean;
  deleting: boolean;
  onConfirm: () => void;
  onCancelDelete: () => void;
}) {
  const low = isLow(product);

  return (
    <div
      className={`rounded-card border bg-surface p-4 transition-colors ${
        low ? "border-warning/40 bg-warning/5" : "border-border"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium text-text">{product.name}</p>
          <p className="text-xs text-text-muted">
            {product.sku} · {product.category}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3 text-sm">
          <button
            onClick={onEdit}
            className="font-medium text-brand-oxblood hover:text-brand-oxblood-deep"
          >
            Edit
          </button>
          {confirming ? (
            <>
              <button
                onClick={onConfirm}
                disabled={deleting}
                className="font-medium text-danger disabled:opacity-50"
              >
                {deleting ? "…" : "Delete?"}
              </button>
              <button onClick={onCancelDelete} className="text-text-muted">
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={onDelete}
              className="text-text-muted hover:text-danger"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
        <div>
          <p className="text-xs text-text-muted">Cost</p>
          <p className="tabular-nums font-medium text-text">
            {fmt(product.avg_cost)}
          </p>
        </div>
        <div>
          <p className="text-xs text-text-muted">Price</p>
          <p className="tabular-nums font-medium text-text">
            {fmt(product.selling_price)}
          </p>
        </div>
        <div>
          <p className="text-xs text-text-muted">Margin</p>
          <p className="tabular-nums font-medium text-text">
            {margin(product.selling_price, product.avg_cost)}
          </p>
        </div>
      </div>

      <div className="mt-3">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
            low
              ? "bg-warning/15 text-warning"
              : "bg-blush text-text-muted"
          }`}
        >
          {low && <span aria-hidden>▲</span>}
          {product.current_stock} in stock
          {low && ` · reorder at ${product.reorder_level}`}
        </span>
      </div>
    </div>
  );
}

// ─── main client component ──────────────────────────────────────────────────

interface Props {
  initialProducts: Product[];
}

export default function ProductsClient({ initialProducts }: Props) {
  const [products, setProducts] = useState(initialProducts);
  const [formOpen, setFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const supabase = useMemo(() => createClient(), []);
  const lowCount = products.filter(isLow).length;

  function openAdd() {
    setEditingProduct(null);
    setFormOpen(true);
  }

  function openEdit(p: Product) {
    setEditingProduct(p);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingProduct(null);
  }

  function handleSaved(saved: Product) {
    setProducts((prev) => {
      const exists = prev.some((p) => p.id === saved.id);
      const updated = exists
        ? prev.map((p) => (p.id === saved.id ? saved : p))
        : [...prev, saved];
      return updated.sort((a, b) => a.name.localeCompare(b.name));
    });
    closeForm();
  }

  async function handleDelete(id: string) {
    setDeleting(true);
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (!error) setProducts((prev) => prev.filter((p) => p.id !== id));
    setDeleting(false);
    setConfirmDeleteId(null);
  }

  return (
    <div className="min-h-screen bg-bg">
      {/* ── Header ── */}
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 md:px-8">
          <div>
            <h1 className="font-display text-2xl font-bold text-brand-oxblood">
              Products
            </h1>
            <p className="mt-0.5 text-sm text-text-muted">
              {products.length} item{products.length !== 1 ? "s" : ""}
              {lowCount > 0 && (
                <span className="ml-2 text-warning">
                  · {lowCount} low stock
                </span>
              )}
            </p>
          </div>
          <button
            onClick={openAdd}
            className="rounded-card bg-brand-oxblood px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-oxblood-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-oxblood focus-visible:ring-offset-2"
          >
            Add product
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 md:px-8">
        {products.length === 0 ? (
          <div className="rounded-lg border border-border bg-surface px-6 py-16 text-center">
            <p className="text-text-muted">
              No products yet. Add your first product to get started.
            </p>
          </div>
        ) : (
          <>
            {/* ── Mobile: stacked cards ── */}
            <div className="flex flex-col gap-3 md:hidden">
              {products.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  onEdit={() => openEdit(p)}
                  onDelete={() => setConfirmDeleteId(p.id)}
                  confirming={confirmDeleteId === p.id}
                  deleting={deleting}
                  onConfirm={() => handleDelete(p.id)}
                  onCancelDelete={() => setConfirmDeleteId(null)}
                />
              ))}
            </div>

            {/* ── Desktop: table ── */}
            <div className="hidden overflow-hidden rounded-lg border border-border bg-surface md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-blush/30">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">
                      Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">
                      Category
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-text-muted">
                      Cost
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-text-muted">
                      Price
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-text-muted">
                      Margin
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-text-muted">
                      Stock
                    </th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => {
                    const low = isLow(p);
                    return (
                      <tr
                        key={p.id}
                        className={`border-b border-border last:border-0 transition-colors ${
                          low ? "bg-warning/5" : "hover:bg-blush/20"
                        }`}
                      >
                        <td className="px-4 py-3">
                          <span className="font-medium text-text">{p.name}</span>
                          <br />
                          <span className="text-xs text-text-muted">{p.sku}</span>
                        </td>
                        <td className="px-4 py-3 text-text-muted">
                          {p.category}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-text">
                          {fmt(p.avg_cost)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-text">
                          {fmt(p.selling_price)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-text">
                          {margin(p.selling_price, p.avg_cost)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span
                            className={`tabular-nums font-medium ${
                              low ? "text-warning" : "text-text"
                            }`}
                          >
                            {p.current_stock}
                          </span>
                          {low && (
                            <span className="ml-1.5 text-xs font-medium text-warning">
                              Low
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-4">
                            <button
                              onClick={() => openEdit(p)}
                              className="font-medium text-brand-oxblood hover:text-brand-oxblood-deep"
                            >
                              Edit
                            </button>
                            {confirmDeleteId === p.id ? (
                              <>
                                <button
                                  onClick={() => handleDelete(p.id)}
                                  disabled={deleting}
                                  className="font-medium text-danger disabled:opacity-50"
                                >
                                  {deleting ? "Deleting…" : "Confirm delete"}
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="text-text-muted hover:text-text"
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => setConfirmDeleteId(p.id)}
                                className="text-text-muted hover:text-danger"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>

      {formOpen && (
        <ProductForm
          product={editingProduct}
          onSaved={handleSaved}
          onClose={closeForm}
        />
      )}
    </div>
  );
}
