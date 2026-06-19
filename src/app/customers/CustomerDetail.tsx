"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Customer, LoyaltySettings } from "@/types/database";
import { formatMoney, type Currency } from "@/lib/currency";

interface SaleRow {
  id: string;
  date: string;
  status: string;
  points_earned: number;
  points_redeemed: number;
  discount_amount: number;
  sale_items: { quantity: number; unit_price: number }[];
}

interface PointsRow {
  id: string;
  type: string;
  points: number;
  note: string | null;
  sale_id: string | null;
  created_at: string;
}

const TYPE_LABELS: Record<string, string> = {
  earn:           "Sale reward",
  redeem:         "Redemption",
  referral_bonus: "Referral bonus",
  adjust:         "Adjustment",
};

const STATUS_CLS: Record<string, string> = {
  completed: "bg-success/10 text-success",
  pending:   "bg-warning/10 text-warning",
  returned:  "bg-danger/10 text-danger",
};

function fmtDate(s: string) {
  return new Date(s + "T00:00:00").toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function fmtTs(s: string) {
  return new Date(s).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

interface Props {
  customer: Customer | null;
  settings: LoyaltySettings;
  onClose: () => void;
}

export default function CustomerDetail({ customer, settings, onClose }: Props) {
  const supabase = useMemo(() => createClient(), []);

  const baseCurrency = settings.base_currency as Currency;
  const dispCurrency = settings.display_currency as Currency;
  const rate = settings.usd_iqd_rate;
  function fmt(n: number) {
    return formatMoney(n, dispCurrency, baseCurrency, rate);
  }
  const [sales,   setSales]   = useState<SaleRow[]>([]);
  const [points,  setPoints]  = useState<PointsRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!customer) { setSales([]); setPoints([]); return; }
    setLoading(true);

    Promise.all([
      supabase
        .from("sales")
        .select(
          "id, date, status, points_earned, points_redeemed, discount_amount, sale_items(quantity, unit_price)",
        )
        .eq("customer_id", customer.id)
        .order("date", { ascending: false }),
      supabase
        .from("points_transactions")
        .select("id, type, points, note, sale_id, created_at")
        .eq("customer_id", customer.id)
        .order("created_at", { ascending: false }),
    ]).then(([sRes, pRes]) => {
      setSales((sRes.data ?? []) as unknown as SaleRow[]);
      setPoints((pRes.data ?? []) as PointsRow[]);
      setLoading(false);
    });
  }, [customer?.id, supabase]);

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden={!customer}
        onClick={onClose}
        className={
          "fixed inset-0 z-40 bg-text/30 backdrop-blur-sm transition-opacity duration-200 " +
          (customer ? "opacity-100" : "pointer-events-none opacity-0")
        }
      />

      {/* Drawer */}
      <aside
        aria-label="Customer details"
        className={
          "fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col overflow-hidden border-l border-border bg-surface shadow-2xl transition-transform duration-200 ease-in-out md:w-[480px] " +
          (customer ? "translate-x-0" : "translate-x-full")
        }
      >
        {customer && (
          <>
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h2 className="font-display text-lg font-bold text-brand-oxblood">
                  {customer.name}
                </h2>
                <p className="mt-0.5 text-xs text-text-muted">{customer.phone}</p>
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                className="rounded-card p-1.5 text-text-muted transition-colors hover:bg-blush hover:text-text"
              >
                <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                  <path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* Info */}
              <div className="space-y-1 border-b border-border px-5 py-4 text-sm">
                {customer.city && (
                  <p className="text-text-muted">
                    City: <span className="text-text">{customer.city}</span>
                  </p>
                )}
                <p className="text-text-muted">
                  Referral code:{" "}
                  <span className="font-mono text-sm font-semibold tracking-wider text-brand-oxblood">
                    {customer.referral_code}
                  </span>
                </p>
                {customer.referred_by && (
                  <p className="text-text-muted">
                    Referred by:{" "}
                    <span className="font-mono text-sm text-text">{customer.referred_by}</span>
                  </p>
                )}
                <p className="text-text-muted">
                  Member since:{" "}
                  <span className="text-text">{fmtDate(customer.created_at.slice(0, 10))}</span>
                </p>
              </div>

              {/* Mini stats */}
              <div className="grid grid-cols-3 divide-x divide-border border-b border-border">
                {[
                  { label: "Orders",   value: String(customer.total_orders) },
                  { label: "Spent",    value: fmt(customer.total_spent) },
                  { label: "Points",   value: customer.points_balance.toLocaleString() },
                ].map(({ label, value }) => (
                  <div key={label} className="py-4 text-center">
                    <p className="text-xs text-text-muted">{label}</p>
                    <p className="mt-1 font-display text-xl font-semibold tabular-nums text-brand-oxblood">
                      {value}
                    </p>
                  </div>
                ))}
              </div>

              {loading && (
                <p className="px-5 py-8 text-sm text-text-muted">Loading…</p>
              )}

              {!loading && (
                <>
                  {/* Order history */}
                  <div className="border-b border-border">
                    <p className="border-b border-border px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-text-muted">
                      Order history
                      <span className="ml-1.5 font-normal">({sales.length})</span>
                    </p>
                    {sales.length === 0 ? (
                      <p className="px-5 py-4 text-sm text-text-muted">No orders yet.</p>
                    ) : (
                      <div className="divide-y divide-border">
                        {sales.map((s) => {
                          const itemTotal = s.sale_items.reduce(
                            (sum, i) => sum + i.quantity * i.unit_price, 0,
                          );
                          const total = itemTotal - s.discount_amount;
                          return (
                            <div key={s.id} className="flex items-center gap-3 px-5 py-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-text">{fmtDate(s.date)}</p>
                                {s.discount_amount > 0 && (
                                  <p className="text-xs text-text-muted">
                                    {fmt(s.discount_amount)} discount
                                  </p>
                                )}
                              </div>
                              <span
                                className={
                                  "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize " +
                                  (STATUS_CLS[s.status] ?? "bg-bg text-text-muted")
                                }
                              >
                                {s.status}
                              </span>
                              <span className="shrink-0 tabular-nums text-sm font-medium text-text">
                                {fmt(total)}
                              </span>
                              {s.status === "completed" && s.points_earned > 0 && (
                                <span className="shrink-0 text-xs text-success">
                                  +{s.points_earned} pts
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Points history */}
                  <div>
                    <p className="border-b border-border px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-text-muted">
                      Points history
                      <span className="ml-1.5 font-normal">({points.length})</span>
                    </p>
                    {points.length === 0 ? (
                      <p className="px-5 py-4 text-sm text-text-muted">
                        No points transactions yet.
                      </p>
                    ) : (
                      <div className="divide-y divide-border">
                        {points.map((p) => (
                          <div key={p.id} className="flex items-center gap-3 px-5 py-3">
                            <span
                              className={
                                "w-20 shrink-0 text-right tabular-nums text-sm font-semibold " +
                                (p.points >= 0 ? "text-success" : "text-danger")
                              }
                            >
                              {p.points >= 0 ? "+" : ""}{p.points} pts
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-text">
                                {TYPE_LABELS[p.type] ?? p.type}
                              </p>
                              {p.note && (
                                <p className="truncate text-xs text-text-muted">{p.note}</p>
                              )}
                            </div>
                            <span className="shrink-0 text-xs text-text-muted">
                              {fmtTs(p.created_at)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </aside>
    </>
  );
}
