"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Customer } from "@/types/database";

// ─── helpers ─────────────────────────────────────────────────────────────────

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function genCode() {
  return Array.from({ length: 6 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join("");
}

function fmtDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

const IRAQI_CITIES = [
  "Baghdad", "Basra", "Mosul", "Erbil", "Sulaymaniyah",
  "Najaf", "Karbala", "Kirkuk", "Nasiriyah", "Duhok",
];

type RecentOrder = { id: string; date: string; total: number; status: string };

type View = "idle" | "searching" | "found" | "not_found" | "creating";

const inputCls =
  "mt-1 block w-full rounded-card border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-brand-oxblood focus:outline-none focus:ring-1 focus:ring-brand-oxblood";

interface Props {
  customer: Customer | null;
  onCustomerSet: (c: Customer | null) => void;
}

export default function CustomerLookup({ customer, onCustomerSet }: Props) {
  const [phone, setPhone] = useState("");
  const [view, setView] = useState<View>("idle");
  const [found, setFound] = useState<Customer | null>(null);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [newName, setNewName] = useState("");
  const [newCity, setNewCity] = useState("");
  const [generatedCode] = useState(genCode);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const supabase = useMemo(() => createClient(), []);

  async function lookUp() {
    const trimmed = phone.trim();
    if (!trimmed) return;
    setView("searching");

    const { data: cust } = await supabase
      .from("customers")
      .select("*")
      .eq("phone", trimmed)
      .maybeSingle();

    if (!cust) {
      setView("not_found");
      return;
    }

    setFound(cust as Customer);
    setView("found");

    // Fetch recent sales for this customer
    const { data: sales } = await supabase
      .from("sales")
      .select("id, date, status, sale_items(quantity, unit_price)")
      .eq("customer_id", cust.id)
      .order("date", { ascending: false })
      .limit(5);

    if (sales) {
      const orders = (sales as unknown as {
        id: string; date: string; status: string;
        sale_items: { quantity: number; unit_price: number }[];
      }[]).map((s) => ({
        id: s.id,
        date: s.date,
        status: s.status,
        total: s.sale_items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0),
      }));
      setRecentOrders(orders);
    }
  }

  async function createCustomer() {
    if (!newName.trim()) return;
    setCreating(true);
    setCreateError(null);

    // Retry up to 10 times on referral_code collision (23505).
    // Collisions are rare but possible with a 6-char code space.
    for (let attempt = 0; attempt < 10; attempt++) {
      const code = attempt === 0 ? generatedCode : genCode();

      const { data, error } = await supabase
        .from("customers")
        .insert({
          phone: phone.trim(),
          name: newName.trim(),
          city: newCity.trim() || null,
          referral_code: code,
        })
        .select()
        .single();

      if (!error) {
        setCreating(false);
        const newCust = data as Customer;
        setFound(newCust);
        setView("found");
        setRecentOrders([]);
        onCustomerSet(newCust);
        return;
      }

      // Unique violation on referral_code → try a different code
      if (error.code === "23505" && error.message.includes("referral_code")) {
        continue;
      }

      // Any other error — surface it immediately
      setCreating(false);
      setCreateError(error.message);
      return;
    }

    setCreating(false);
    setCreateError("Could not generate a unique referral code — please try again.");
  }

  function reset() {
    setPhone("");
    setView("idle");
    setFound(null);
    setRecentOrders([]);
    onCustomerSet(null);
  }

  // Already selected — show a summary card with a "Change" button
  if (customer) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-card border border-border bg-blush/40 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate font-medium text-text">{customer.name}</p>
          <p className="text-xs text-text-muted">
            {customer.phone}
            {customer.city ? ` · ${customer.city}` : ""}
            {" · "}
            <span className="font-medium text-brand-oxblood">
              {customer.points_balance} pts
            </span>
          </p>
        </div>
        <button
          type="button"
          onClick={reset}
          className="shrink-0 text-sm text-text-muted hover:text-text"
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Phone input row */}
      <div className="flex gap-2">
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), lookUp())}
          placeholder="Customer phone number"
          className="flex-1 rounded-card border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-brand-oxblood focus:outline-none focus:ring-1 focus:ring-brand-oxblood"
        />
        <button
          type="button"
          onClick={lookUp}
          disabled={!phone.trim() || view === "searching"}
          className="rounded-card border border-border bg-surface px-3 py-2 text-sm font-medium text-text transition-colors hover:bg-blush disabled:opacity-40"
        >
          {view === "searching" ? "…" : "Look up"}
        </button>
      </div>

      {/* Found: customer card + recent orders */}
      {view === "found" && found && (
        <div className="rounded-card border border-border bg-surface p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-medium text-text">{found.name}</p>
              <p className="text-sm text-text-muted">
                {found.city ?? "—"} · {found.total_orders} order{found.total_orders !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="tabular-nums font-semibold text-brand-oxblood">
                {found.points_balance} pts
              </p>
              <p className="text-xs text-text-muted">
                Code: {found.referral_code}
              </p>
            </div>
          </div>

          {recentOrders.length > 0 && (
            <div className="border-t border-border pt-3 space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                Recent orders
              </p>
              {recentOrders.map((o) => (
                <div key={o.id} className="flex items-center justify-between text-sm">
                  <span className="text-text-muted">{fmtDate(o.date)}</span>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={o.status} />
                    <span className="tabular-nums text-text font-medium">
                      {o.total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="pt-1 flex gap-2">
            <button
              type="button"
              onClick={() => onCustomerSet(found)}
              className="flex-1 rounded-card bg-brand-oxblood py-2 text-sm font-medium text-white transition-colors hover:bg-brand-oxblood-deep"
            >
              Use this customer
            </button>
            <button
              type="button"
              onClick={reset}
              className="rounded-card border border-border px-3 py-2 text-sm text-text-muted hover:bg-blush"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Not found: create form */}
      {view === "not_found" && (
        <div className="rounded-card border border-dashed border-border bg-surface p-4 space-y-3">
          <p className="text-sm text-text-muted">
            No customer found for <span className="font-medium text-text">{phone}</span>. Create one?
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text">Name *</label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Full name"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text">City</label>
              <select
                value={newCity}
                onChange={(e) => setNewCity(e.target.value)}
                className={inputCls}
              >
                <option value="">Select…</option>
                {IRAQI_CITIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-text">Referral code (auto-generated)</label>
            <input
              readOnly
              value={generatedCode}
              className="mt-1 block w-full rounded-card border border-border bg-blush/30 px-3 py-2 font-mono text-sm tracking-widest text-text-muted"
            />
          </div>

          {createError && (
            <p className="text-sm text-danger">{createError}</p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={createCustomer}
              disabled={creating || !newName.trim()}
              className="flex-1 rounded-card bg-brand-oxblood py-2 text-sm font-medium text-white transition-colors hover:bg-brand-oxblood-deep disabled:opacity-50"
            >
              {creating ? "Creating…" : "Create customer"}
            </button>
            <button
              type="button"
              onClick={reset}
              className="rounded-card border border-border px-3 py-2 text-sm text-text-muted hover:bg-blush"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    completed: "bg-success/10 text-success",
    pending:   "bg-warning/10 text-warning",
    returned:  "bg-danger/10  text-danger",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] ?? "bg-blush text-text-muted"}`}>
      {status}
    </span>
  );
}
