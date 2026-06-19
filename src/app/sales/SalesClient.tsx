"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  Customer,
  LoyaltySettings,
  Product,
  SaleStatus,
  SaleWithDetails,
} from "@/types/database";
import CustomerLookup from "./CustomerLookup";
import CurrencyInput from "@/components/CurrencyInput";
import { formatMoney, type Currency } from "@/lib/currency";

// ─── helpers ─────────────────────────────────────────────────────────────────

function today() { return new Date().toISOString().slice(0, 10); }

function fmtDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function saleSubtotal(s: SaleWithDetails) {
  return s.sale_items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0);
}
function salePaid(s: SaleWithDetails) {
  return saleSubtotal(s) - s.discount_amount;
}

// ─── dev autofill ─────────────────────────────────────────────────────────────

const DEV_STATUSES: SaleStatus[] = ["completed", "completed", "completed", "pending"];

function fakeItems(products: Product[]): LineItem[] {
  const n = Math.floor(1 + Math.random() * 3);
  return [...products].sort(() => Math.random() - 0.5).slice(0, n).map((p) => ({
    line_type: "single" as const,
    product_id: p.id,
    quantity: String(Math.floor(1 + Math.random() * 3)),
    unit_price: String(p.selling_price),
    bundle_products: [],
    bundle_price: "",
  }));
}

// ─── types ───────────────────────────────────────────────────────────────────

const CHANNELS = ["Instagram", "Facebook", "WhatsApp", "Walk-in", "Referral", "Other"] as const;
type Channel = (typeof CHANNELS)[number];

type LineItem = {
  line_type: "single" | "bundle";
  // single fields
  product_id: string;
  quantity: string;
  unit_price: string;
  // bundle fields
  bundle_products: string[];
  bundle_price: string;
};

const EMPTY_ITEM: LineItem = {
  line_type: "single",
  product_id: "",
  quantity: "1",
  unit_price: "",
  bundle_products: [],
  bundle_price: "",
};

const selectCls =
  "block w-full rounded-card border border-border bg-bg px-3 py-2 text-sm text-text focus:border-brand-oxblood focus:outline-none focus:ring-1 focus:ring-brand-oxblood";
const inputCls = selectCls + " tabular-nums";

// ─── status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    completed: "bg-success/10 text-success",
    pending:   "bg-warning/10 text-warning",
    returned:  "bg-danger/10  text-danger",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${styles[status] ?? "bg-blush text-text-muted"}`}>
      {status}
    </span>
  );
}

// ─── history card (mobile) ────────────────────────────────────────────────────

function HistoryCard({
  sale,
  fmt,
  onReturn, confirmingReturn, returning, onConfirmReturn, onCancelReturn,
  onComplete, completing,
  onDelete, confirmingDelete, deleting, onConfirmDelete, onCancelDelete,
}: {
  sale: SaleWithDetails;
  fmt: (n: number) => string;
  onReturn: () => void; confirmingReturn: boolean; returning: boolean;
  onConfirmReturn: () => void; onCancelReturn: () => void;
  onComplete: () => void; completing: boolean;
  onDelete: () => void; confirmingDelete: boolean; deleting: boolean;
  onConfirmDelete: () => void; onCancelDelete: () => void;
}) {
  const paid = salePaid(sale);
  return (
    <div className="rounded-card border border-border bg-surface p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium text-text">
            {sale.customers?.name ?? "Walk-in"}
          </p>
          <p className="text-xs text-text-muted">
            {fmtDate(sale.date)}{sale.city ? ` · ${sale.city}` : ""}{sale.channel ? ` · ${sale.channel}` : ""}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="tabular-nums font-semibold text-text">{fmt(paid)}</p>
          <StatusBadge status={sale.status} />
        </div>
      </div>

      <div className="space-y-0.5">
        {sale.sale_items.map((item, i) => (
          item.line_type === "bundle" ? (
            <p key={i} className="text-xs text-text-muted">
              <span className="font-medium text-brand-oxblood/70">Bundle</span>
              {item.bundle_components && ` (${item.bundle_components.length} products)`}
              {" @ "}{fmt(item.unit_price)}
            </p>
          ) : (
            <p key={i} className="text-xs text-text-muted">
              {item.products?.name ?? "—"} × {item.quantity} @ {fmt(item.unit_price)}
            </p>
          )
        ))}
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-2 text-xs text-brand-rose">
          {sale.points_earned > 0 && <span>+{sale.points_earned} pts earned</span>}
          {sale.points_redeemed > 0 && <span>−{sale.points_redeemed} pts redeemed</span>}
          {sale.discount_amount > 0 && <span>{fmt(sale.discount_amount)} off</span>}
        </div>

        {sale.status === "completed" && (
          confirmingReturn ? (
            <div className="flex gap-2 text-sm">
              <button onClick={onConfirmReturn} disabled={returning}
                className="font-medium text-danger disabled:opacity-50">
                {returning ? "…" : "Confirm return"}
              </button>
              <button onClick={onCancelReturn} className="text-text-muted">Cancel</button>
            </div>
          ) : (
            <button onClick={onReturn} className="text-xs text-text-muted hover:text-danger">
              Return
            </button>
          )
        )}

        {sale.status === "pending" && (
          confirmingDelete ? (
            <div className="flex gap-2 text-sm">
              <button onClick={onConfirmDelete} disabled={deleting}
                className="font-medium text-danger disabled:opacity-50">
                {deleting ? "…" : "Confirm delete"}
              </button>
              <button onClick={onCancelDelete} className="text-text-muted">Cancel</button>
            </div>
          ) : (
            <div className="flex gap-3">
              <button onClick={onComplete} disabled={completing}
                className="text-xs font-medium text-success hover:text-success/80 disabled:opacity-50">
                {completing ? "…" : "Complete"}
              </button>
              <button onClick={onDelete} className="text-xs text-text-muted hover:text-danger">
                Delete
              </button>
            </div>
          )
        )}
      </div>
    </div>
  );
}

// ─── main ────────────────────────────────────────────────────────────────────

interface Props {
  initialProducts: Product[];
  initialHistory: SaleWithDetails[];
  settings: LoyaltySettings;
}

export default function SalesClient({ initialProducts, initialHistory, settings }: Props) {
  const baseCurrency = settings.base_currency as Currency;
  const dispCurrency = settings.display_currency as Currency;
  const rate = settings.usd_iqd_rate;
  function fmt(n: number) {
    return formatMoney(n, dispCurrency, baseCurrency, rate);
  }

  // ── form state ──
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [date, setDate] = useState(today());
  const [status, setStatus] = useState<SaleStatus>("pending");
  const [channel, setChannel] = useState<Channel>("Instagram");
  const [items, setItems] = useState<LineItem[]>([{ ...EMPTY_ITEM }]);

  // ── loyalty state ──
  const [pointsToRedeem, setPointsToRedeem] = useState(0);
  const [referralCode, setReferralCode] = useState("");
  const [referrer, setReferrer] = useState<{ id: string; name: string } | null>(null);
  const [lookingUpCode, setLookingUpCode] = useState(false);
  const [referralError, setReferralError] = useState<string | null>(null);

  // ── submission / history ──
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState(initialHistory);
  const [confirmReturnId, setConfirmReturnId] = useState<string | null>(null);
  const [returning, setReturning] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const supabase = useMemo(() => createClient(), []);

  // Reset loyalty inputs when customer changes
  useEffect(() => {
    setPointsToRedeem(0);
    setReferralCode("");
    setReferrer(null);
    setReferralError(null);
  }, [customer?.id]);

  // ── derived loyalty values ──

  const subtotal = items.reduce((sum, item) => {
    if (item.line_type === "bundle") {
      return sum + parseFloat(item.bundle_price || "0");
    }
    return sum + parseInt(item.quantity || "0", 10) * parseFloat(item.unit_price || "0");
  }, 0);

  const isFirstOrder = !!customer && customer.total_orders === 0 && customer.referred_by === null;

  // Points: cannot exceed balance or make discount exceed subtotal
  const maxRedeemablePoints = customer && subtotal > 0
    ? Math.min(customer.points_balance, Math.floor(subtotal / settings.redeem_value))
    : 0;
  const safeRedeem = Math.min(pointsToRedeem, maxRedeemablePoints);
  const redemptionDiscount = safeRedeem * settings.redeem_value;

  // Referral: % off subtotal, only on first order with a valid code
  const referralDiscount = isFirstOrder && referrer
    ? subtotal * (settings.new_customer_discount_pct / 100)
    : 0;

  const totalDiscount = Math.min(redemptionDiscount + referralDiscount, subtotal);
  const orderTotal = subtotal - totalDiscount;
  const pointsEarned = status === "completed" ? Math.floor(orderTotal * settings.earn_rate) : 0;

  // Aggregate quantities per product and warn when exceeding current_stock
  const stockWarnings = useMemo(() => {
    const qtyMap = new Map<string, number>();
    for (const item of items) {
      if (item.line_type === "bundle") {
        for (const pid of item.bundle_products) {
          qtyMap.set(pid, (qtyMap.get(pid) ?? 0) + 1);
        }
      } else {
        if (!item.product_id) continue;
        const qty = parseInt(item.quantity || "0", 10);
        if (qty > 0) qtyMap.set(item.product_id, (qtyMap.get(item.product_id) ?? 0) + qty);
      }
    }
    return [...qtyMap.entries()].flatMap(([id, qty]) => {
      const p = initialProducts.find((p) => p.id === id);
      return p && qty > p.current_stock
        ? [`${p.name}: only ${p.current_stock} in stock (selling ${qty})`]
        : [];
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  // ── line item helpers ──

  function updateItem(idx: number, patch: Partial<LineItem>) {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== idx) return item;
        const next = { ...item, ...patch };
        if (patch.product_id && item.line_type === "single") {
          const p = initialProducts.find((p) => p.id === patch.product_id);
          if (p) next.unit_price = String(p.selling_price);
        }
        return next;
      })
    );
  }

  function switchLineType(idx: number, newType: "single" | "bundle") {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== idx) return item;
        return newType === "single"
          ? { ...item, line_type: "single", bundle_products: [], bundle_price: "" }
          : {
              ...item,
              line_type: "bundle",
              product_id: "",
              quantity: "1",
              unit_price: "",
              bundle_price: settings.default_bundle_price > 0
                ? String(settings.default_bundle_price)
                : "",
            };
      }),
    );
  }

  function addBundleProduct(idx: number, productId: string) {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== idx || item.bundle_products.includes(productId)) return item;
        return { ...item, bundle_products: [...item.bundle_products, productId] };
      }),
    );
  }

  function removeBundleProduct(idx: number, productId: string) {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== idx) return item;
        return { ...item, bundle_products: item.bundle_products.filter((pid) => pid !== productId) };
      }),
    );
  }

  function addItem() { setItems((prev) => [...prev, { ...EMPTY_ITEM }]); }
  function removeItem(idx: number) {
    setItems((prev) => prev.length === 1 ? prev : prev.filter((_, i) => i !== idx));
  }

  // ── referral code lookup ──

  async function checkReferralCode() {
    if (!referralCode.trim() || !customer) return;
    setLookingUpCode(true);
    setReferralError(null);

    const { data } = await supabase
      .from("customers")
      .select("id, name")
      .eq("referral_code", referralCode.trim().toUpperCase())
      .neq("id", customer.id)
      .maybeSingle();

    setLookingUpCode(false);
    if (data) {
      setReferrer({ id: data.id, name: data.name });
    } else {
      setReferrer(null);
      setReferralError("Code not found.");
    }
  }

  // ── submit sale ──

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validItems = items.filter((i) => {
      if (i.line_type === "bundle") {
        return i.bundle_products.length > 0 && parseFloat(i.bundle_price) > 0;
      }
      return i.product_id && parseInt(i.quantity, 10) > 0 && parseFloat(i.unit_price) >= 0;
    });
    if (!validItems.length) { setError("Add at least one item."); return; }

    setError(null);
    setSaving(true);

    // Snapshot avg_costs — collect all product IDs (singles + bundle components)
    const allProductIds = new Set<string>();
    for (const item of validItems) {
      if (item.line_type === "single") allProductIds.add(item.product_id);
      else item.bundle_products.forEach((pid) => allProductIds.add(pid));
    }
    const { data: freshProds } = await supabase
      .from("products")
      .select("id, avg_cost")
      .in("id", [...allProductIds]);
    const costMap = Object.fromEntries(
      (freshProds ?? []).map((p: { id: string; avg_cost: number }) => [p.id, p.avg_cost]),
    );

    // Insert sale
    const { data: sale, error: saleErr } = await supabase
      .from("sales")
      .insert({
        date,
        customer_id: customer?.id ?? null,
        city: customer?.city ?? null,
        channel,
        status,
        points_earned: pointsEarned,
        points_redeemed: safeRedeem,
        discount_amount: totalDiscount,
        referral_code_used: isFirstOrder && referrer ? referralCode.trim().toUpperCase() : null,
      })
      .select("id")
      .single();

    if (saleErr || !sale) {
      setError(saleErr?.message ?? "Failed to create sale");
      setSaving(false);
      return;
    }

    // Build sale_items rows
    const saleItemRows = validItems.map((i) => {
      if (i.line_type === "single") {
        return {
          sale_id: sale.id,
          product_id: i.product_id,
          quantity: parseInt(i.quantity, 10),
          unit_price: parseFloat(i.unit_price),
          cost_at_sale: costMap[i.product_id] ?? 0,
          line_type: "single",
          bundle_components: null,
        };
      }
      const components = i.bundle_products.map((pid) => ({
        product_id: pid,
        cost_at_sale: costMap[pid] ?? 0,
      }));
      return {
        sale_id: sale.id,
        product_id: null,
        quantity: 1,
        unit_price: parseFloat(i.bundle_price),
        cost_at_sale: components.reduce((s, c) => s + c.cost_at_sale, 0),
        line_type: "bundle",
        bundle_components: components,
      };
    });

    // Insert sale_items
    const { error: itemsErr } = await supabase.from("sale_items").insert(saleItemRows);
    if (itemsErr) { setError(itemsErr.message); setSaving(false); return; }

    // Decrement stock — singles by qty, bundle components by 1 each
    {
      const qtyMap = new Map<string, number>();
      for (const item of validItems) {
        if (item.line_type === "single") {
          qtyMap.set(item.product_id, (qtyMap.get(item.product_id) ?? 0) + parseInt(item.quantity, 10));
        } else {
          for (const pid of item.bundle_products) {
            qtyMap.set(pid, (qtyMap.get(pid) ?? 0) + 1);
          }
        }
      }
      const stockFetches = await Promise.all(
        [...qtyMap.keys()].map((id) =>
          supabase.from("products").select("id, current_stock").eq("id", id).single()
        )
      );
      await Promise.all(
        stockFetches.map(({ data: p }) => {
          if (!p) return;
          const sold = qtyMap.get(p.id) ?? 0;
          return supabase
            .from("products")
            .update({ current_stock: Math.max(0, p.current_stock - sold) })
            .eq("id", p.id);
        })
      );
    }

    // Loyalty ops (only when customer is linked)
    if (customer) {
      const txns: object[] = [];
      let balanceDelta = 0;

      if (status === "completed") {
        if (pointsEarned > 0) {
          txns.push({ customer_id: customer.id, type: "earn", points: pointsEarned, sale_id: sale.id, note: null });
          balanceDelta += pointsEarned;
        }
        if (safeRedeem > 0) {
          txns.push({ customer_id: customer.id, type: "redeem", points: -safeRedeem, sale_id: sale.id, note: null });
          balanceDelta -= safeRedeem;
        }
      }

      const customerUpdate: Record<string, unknown> = {
        points_balance: customer.points_balance + balanceDelta,
        total_orders: customer.total_orders + (status === "completed" ? 1 : 0),
        total_spent: customer.total_spent + (status === "completed" ? orderTotal : 0),
      };

      // Referral: set referred_by regardless of status; award bonus only on completion
      if (isFirstOrder && referrer) {
        customerUpdate.referred_by = referrer.id;
      }

      const ops: PromiseLike<unknown>[] = [
        supabase.from("customers").update(customerUpdate).eq("id", customer.id),
      ];
      if (txns.length) ops.push(supabase.from("points_transactions").insert(txns));

      await Promise.all(ops);

      // Referral bonus for referrer — only on completion, only once
      if (status === "completed" && isFirstOrder && referrer) {
        const { data: referrerRow } = await supabase
          .from("customers")
          .select("points_balance")
          .eq("id", referrer.id)
          .single();

        if (referrerRow) {
          await Promise.all([
            supabase.from("points_transactions").insert({
              customer_id: referrer.id,
              type: "referral_bonus",
              points: settings.referrer_bonus,
              sale_id: sale.id,
              note: `Referral — ${customer.name} joined`,
            }),
            supabase.from("customers").update({
              points_balance: referrerRow.points_balance + settings.referrer_bonus,
            }).eq("id", referrer.id),
            // Guard: mark referral as rewarded
            supabase.from("customers").update({ referral_rewarded: true }).eq("id", customer.id),
          ]);
        }
      }
    }

    // Fetch the full sale for history
    const { data: fullSale } = await supabase
      .from("sales")
      .select(`
        id, date, city, channel, status, points_earned, points_redeemed,
        discount_amount, referral_code_used, customer_id, created_at,
        customers(name, phone),
        sale_items(id, product_id, quantity, unit_price, cost_at_sale, line_type, bundle_components, products(name, sku))
      `)
      .eq("id", sale.id)
      .single();

    if (fullSale) setHistory((prev) => [fullSale as unknown as SaleWithDetails, ...prev]);

    // Reset form
    setCustomer(null);
    setItems([{ ...EMPTY_ITEM }]);
    setDate(today());
    setStatus("completed");
    setChannel("Instagram");
    setSaving(false);
  }

  // ── return a completed sale ──

  async function handleReturn(sale: SaleWithDetails) {
    setReturning(true);
    const paid = salePaid(sale);

    await supabase.from("sales").update({ status: "returned" }).eq("id", sale.id);

    // Restore stock for every line item (bundles restore 1 unit per component)
    {
      const qtyMap = new Map<string, number>();
      for (const item of sale.sale_items) {
        if (item.line_type === "bundle" && item.bundle_components) {
          for (const comp of item.bundle_components) {
            qtyMap.set(comp.product_id, (qtyMap.get(comp.product_id) ?? 0) + 1);
          }
        } else if (item.product_id) {
          qtyMap.set(item.product_id, (qtyMap.get(item.product_id) ?? 0) + item.quantity);
        }
      }
      const stockFetches = await Promise.all(
        [...qtyMap.keys()].map((id) =>
          supabase.from("products").select("id, current_stock").eq("id", id).single()
        )
      );
      await Promise.all(
        stockFetches.map(({ data: p }) => {
          if (!p) return;
          return supabase
            .from("products")
            .update({ current_stock: p.current_stock + (qtyMap.get(p.id) ?? 0) })
            .eq("id", p.id);
        })
      );
    }

    if (sale.customer_id) {
      const { data: cust } = await supabase
        .from("customers")
        .select("points_balance, total_orders, total_spent, referred_by, referral_rewarded")
        .eq("id", sale.customer_id)
        .single();

      if (cust) {
        const reversals: object[] = [];
        let balanceDelta = 0;

        if (sale.points_earned > 0) {
          reversals.push({ customer_id: sale.customer_id, type: "earn", points: -sale.points_earned, sale_id: sale.id, note: "Reversal — returned" });
          balanceDelta -= sale.points_earned;
        }
        if (sale.points_redeemed > 0) {
          reversals.push({ customer_id: sale.customer_id, type: "redeem", points: sale.points_redeemed, sale_id: sale.id, note: "Reversal — returned" });
          balanceDelta += sale.points_redeemed;
        }

        const isFirstOrder = cust.total_orders === 1; // this was their only/first order
        const shouldReverseReferral =
          isFirstOrder && cust.referred_by && cust.referral_rewarded && sale.referral_code_used;

        const customerPatch: Record<string, unknown> = {
          points_balance: Math.max(0, cust.points_balance + balanceDelta),
          total_orders: Math.max(0, cust.total_orders - 1),
          total_spent: Math.max(0, Number(cust.total_spent) - paid),
        };
        if (shouldReverseReferral) customerPatch.referral_rewarded = false;

        const ops: PromiseLike<unknown>[] = [
          supabase.from("customers").update(customerPatch).eq("id", sale.customer_id),
        ];
        if (reversals.length) ops.push(supabase.from("points_transactions").insert(reversals));
        await Promise.all(ops);

        // Reverse referrer bonus
        if (shouldReverseReferral && cust.referred_by) {
          const { data: ref } = await supabase
            .from("customers").select("points_balance").eq("id", cust.referred_by).single();
          if (ref) {
            await Promise.all([
              supabase.from("points_transactions").insert({
                customer_id: cust.referred_by,
                type: "referral_bonus",
                points: -settings.referrer_bonus,
                sale_id: sale.id,
                note: "Reversal — referred order returned",
              }),
              supabase.from("customers").update({
                points_balance: Math.max(0, ref.points_balance - settings.referrer_bonus),
              }).eq("id", cust.referred_by),
            ]);
          }
        }
      }
    }

    setHistory((prev) =>
      prev.map((s) => s.id === sale.id ? { ...s, status: "returned" as SaleStatus } : s)
    );
    setConfirmReturnId(null);
    setReturning(false);
  }

  // ── complete a pending sale ──

  async function handleComplete(sale: SaleWithDetails) {
    setCompleting(true);
    const subtotal = sale.sale_items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0);
    const orderTotal = subtotal - sale.discount_amount;
    const pointsEarned = Math.floor(orderTotal * settings.earn_rate);

    await supabase.from("sales").update({ status: "completed", points_earned: pointsEarned }).eq("id", sale.id);

    if (sale.customer_id) {
      const { data: cust } = await supabase
        .from("customers")
        .select("points_balance, total_orders, total_spent, referred_by, referral_rewarded, name")
        .eq("id", sale.customer_id)
        .single();

      if (cust) {
        const txns: object[] = [];
        let balanceDelta = 0;

        if (pointsEarned > 0) {
          txns.push({ customer_id: sale.customer_id, type: "earn", points: pointsEarned, sale_id: sale.id, note: null });
          balanceDelta += pointsEarned;
        }
        if (sale.points_redeemed > 0) {
          txns.push({ customer_id: sale.customer_id, type: "redeem", points: -sale.points_redeemed, sale_id: sale.id, note: null });
          balanceDelta -= sale.points_redeemed;
        }

        const ops: PromiseLike<unknown>[] = [
          supabase.from("customers").update({
            points_balance: cust.points_balance + balanceDelta,
            total_orders: cust.total_orders + 1,
            total_spent: Number(cust.total_spent) + orderTotal,
          }).eq("id", sale.customer_id),
        ];
        if (txns.length) ops.push(supabase.from("points_transactions").insert(txns));
        await Promise.all(ops);

        // Referral bonus — first order only, once
        if (sale.referral_code_used && cust.referred_by && !cust.referral_rewarded) {
          const { data: ref } = await supabase
            .from("customers").select("points_balance").eq("id", cust.referred_by).single();
          if (ref) {
            await Promise.all([
              supabase.from("points_transactions").insert({
                customer_id: cust.referred_by,
                type: "referral_bonus",
                points: settings.referrer_bonus,
                sale_id: sale.id,
                note: `Referral — ${sale.customers?.name ?? "customer"} joined`,
              }),
              supabase.from("customers").update({
                points_balance: ref.points_balance + settings.referrer_bonus,
              }).eq("id", cust.referred_by),
              supabase.from("customers").update({ referral_rewarded: true }).eq("id", sale.customer_id),
            ]);
          }
        }
      }
    }

    setHistory((prev) =>
      prev.map((s) =>
        s.id === sale.id ? { ...s, status: "completed" as SaleStatus, points_earned: pointsEarned } : s,
      ),
    );
    setCompleting(false);
  }

  // ── delete a pending sale ──

  async function handleDelete(sale: SaleWithDetails) {
    setDeleting(true);

    // Restore stock decremented at sale creation
    const qtyMap = new Map<string, number>();
    for (const item of sale.sale_items) {
      if (item.line_type === "bundle" && item.bundle_components) {
        for (const comp of item.bundle_components) {
          qtyMap.set(comp.product_id, (qtyMap.get(comp.product_id) ?? 0) + 1);
        }
      } else if (item.product_id) {
        qtyMap.set(item.product_id, (qtyMap.get(item.product_id) ?? 0) + item.quantity);
      }
    }
    const stockFetches = await Promise.all(
      [...qtyMap.keys()].map((id) =>
        supabase.from("products").select("id, current_stock").eq("id", id).single(),
      ),
    );
    await Promise.all(
      stockFetches.map(({ data: p }) => {
        if (!p) return;
        return supabase
          .from("products")
          .update({ current_stock: p.current_stock + (qtyMap.get(p.id) ?? 0) })
          .eq("id", p.id);
      }),
    );

    await supabase.from("sales").delete().eq("id", sale.id);

    setHistory((prev) => prev.filter((s) => s.id !== sale.id));
    setConfirmDeleteId(null);
    setDeleting(false);
  }

  // ── render ──

  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto max-w-5xl px-4 py-4 md:px-8">
          <h1 className="font-display text-2xl font-bold text-brand-oxblood">Sales</h1>
          <p className="mt-0.5 text-sm text-text-muted">
            Record a sale, link to a customer, and track loyalty points.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 px-4 py-6 md:px-8">
        {/* ── Sale form ── */}
        <section className="mx-auto max-w-2xl rounded-lg border border-border bg-surface">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="font-display text-base font-semibold text-brand-oxblood">Record sale</h2>
            {process.env.NODE_ENV === "development" && (
              <button
                type="button"
                onClick={() => {
                  setItems(fakeItems(initialProducts));
                  setStatus(DEV_STATUSES[Math.floor(Math.random() * DEV_STATUSES.length)]);
                  setChannel(CHANNELS[Math.floor(Math.random() * CHANNELS.length)]);
                }}
                className="rounded border border-dashed border-text-muted/40 px-2 py-0.5 font-mono text-xs text-text-muted transition-colors hover:border-brand-rose hover:text-brand-rose"
                title="Fill with random test data (dev only)"
              >
                ⚡ fill
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-5 p-5">
            {/* Customer lookup */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text">Customer</label>
              <CustomerLookup customer={customer} onCustomerSet={setCustomer} />
            </div>

            {/* Items */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm font-medium text-text">
                  Items <span className="text-danger">*</span>
                </label>
                <button type="button" onClick={addItem}
                  className="text-sm font-medium text-brand-oxblood hover:text-brand-oxblood-deep">
                  + Add item
                </button>
              </div>
              <div className="space-y-3">
                {items.map((item, idx) => (
                  <div key={idx} className="space-y-1.5">
                    {/* Type toggle + remove */}
                    <div className="flex items-center gap-2">
                      <div className="flex overflow-hidden rounded-card border border-border text-xs">
                        {(["single", "bundle"] as const).map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => switchLineType(idx, t)}
                            className={
                              "px-2.5 py-1 capitalize transition-colors " +
                              (item.line_type === t
                                ? "bg-brand-oxblood text-white"
                                : "bg-surface text-text-muted hover:bg-blush/60")
                            }
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        disabled={items.length === 1}
                        className="ml-auto pb-0.5 text-lg leading-none text-text-muted hover:text-danger disabled:opacity-30"
                      >
                        ×
                      </button>
                    </div>

                    {item.line_type === "single" ? (
                      <div className="flex items-end gap-2">
                        <div className="flex-1 min-w-0">
                          <select
                            value={item.product_id}
                            onChange={(e) => updateItem(idx, { product_id: e.target.value })}
                            className={selectCls}
                          >
                            <option value="">Product…</option>
                            {initialProducts.map((p) => (
                              <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                            ))}
                          </select>
                        </div>
                        <input
                          type="number" min="1" step="1"
                          value={item.quantity} placeholder="Qty"
                          onChange={(e) => updateItem(idx, { quantity: e.target.value })}
                          className="w-16 rounded-card border border-border bg-bg px-2 py-2 text-center text-sm tabular-nums text-text focus:border-brand-oxblood focus:outline-none focus:ring-1 focus:ring-brand-oxblood"
                        />
                        <div className="w-36">
                          <CurrencyInput
                            value={item.unit_price}
                            onChange={(base) => updateItem(idx, { unit_price: base })}
                            baseCurrency={baseCurrency}
                            defaultRate={rate}
                            placeholder="Price"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-card border border-border bg-blush/10 p-3 space-y-2.5">
                        {/* Product chips */}
                        <div>
                          <p className="mb-1.5 text-xs font-medium text-text-muted">
                            Products in bundle
                            {item.bundle_products.length > 0 && (
                              <span className="ml-1 font-normal">
                                ({item.bundle_products.length})
                              </span>
                            )}
                          </p>
                          {item.bundle_products.length > 0 && (
                            <div className="mb-2 flex flex-wrap gap-1.5">
                              {item.bundle_products.map((pid) => {
                                const p = initialProducts.find((p) => p.id === pid);
                                return (
                                  <span
                                    key={pid}
                                    className="inline-flex items-center gap-1 rounded-full bg-brand-oxblood/10 px-2.5 py-0.5 text-xs font-medium text-brand-oxblood"
                                  >
                                    {p?.name ?? pid}
                                    <button
                                      type="button"
                                      onClick={() => removeBundleProduct(idx, pid)}
                                      className="ml-0.5 leading-none text-brand-oxblood/50 hover:text-danger"
                                    >
                                      ×
                                    </button>
                                  </span>
                                );
                              })}
                            </div>
                          )}
                          <select
                            value=""
                            onChange={(e) => {
                              if (e.target.value) {
                                addBundleProduct(idx, e.target.value);
                                e.currentTarget.value = "";
                              }
                            }}
                            className={selectCls}
                          >
                            <option value="">+ Add product to bundle…</option>
                            {initialProducts
                              .filter((p) => !item.bundle_products.includes(p.id))
                              .map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name} ({p.sku}) — cost {fmt(p.avg_cost)}
                                </option>
                              ))}
                          </select>
                        </div>

                        {/* Bundle price */}
                        <div>
                          <p className="mb-1 text-xs font-medium text-text-muted">Bundle price</p>
                          <CurrencyInput
                            value={item.bundle_price}
                            onChange={(base) => updateItem(idx, { bundle_price: base })}
                            baseCurrency={baseCurrency}
                            defaultRate={rate}
                            placeholder="Bundle price"
                          />
                        </div>

                        {/* COGS preview */}
                        {item.bundle_products.length > 0 && (
                          <p className="text-xs text-text-muted">
                            {(() => {
                              const cogs = item.bundle_products.reduce((sum, pid) => {
                                const p = initialProducts.find((p) => p.id === pid);
                                return sum + (p?.avg_cost ?? 0);
                              }, 0);
                              const price = parseFloat(item.bundle_price || "0");
                              const margin = price > 0 ? ((price - cogs) / price * 100).toFixed(1) : null;
                              return (
                                <>
                                  COGS: <span className="font-medium text-text">{fmt(cogs)}</span>
                                  {margin !== null && (
                                    <> · Est. margin: <span className={`font-medium ${parseFloat(margin) >= 0 ? "text-success" : "text-danger"}`}>{margin}%</span></>
                                  )}
                                </>
                              );
                            })()}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Points redemption */}
            {customer && customer.points_balance > 0 && subtotal > 0 && (
              <div className="rounded-card border border-border bg-blush/20 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-text">Redeem points</p>
                  <p className="text-xs text-text-muted">
                    Balance: <span className="font-medium text-text">{customer.points_balance} pts</span>
                    {" · "}Max: <span className="font-medium text-text">{maxRedeemablePoints} pts</span>
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="0"
                    max={maxRedeemablePoints}
                    step="1"
                    value={pointsToRedeem || ""}
                    onChange={(e) => setPointsToRedeem(Math.max(0, parseInt(e.target.value || "0", 10)))}
                    placeholder="0"
                    className="w-28 rounded-card border border-border bg-bg px-3 py-1.5 text-sm tabular-nums text-text focus:border-brand-oxblood focus:outline-none focus:ring-1 focus:ring-brand-oxblood"
                  />
                  {safeRedeem > 0 && (
                    <p className="text-sm text-text-muted">
                      → <span className="font-medium text-text">{fmt(redemptionDiscount)} off</span>
                    </p>
                  )}
                  {pointsToRedeem > maxRedeemablePoints && (
                    <p className="text-sm text-warning">Capped at {maxRedeemablePoints}</p>
                  )}
                </div>
              </div>
            )}

            {/* Referral code */}
            {isFirstOrder && (
              <div className="rounded-card border border-border bg-blush/20 p-4 space-y-2">
                <p className="text-sm font-medium text-text">Referral code</p>
                <p className="text-xs text-text-muted">
                  First order — enter a referral code for {settings.new_customer_discount_pct}% off.
                </p>
                <div className="flex gap-2">
                  <input
                    value={referralCode}
                    onChange={(e) => {
                      setReferralCode(e.target.value.toUpperCase());
                      setReferrer(null);
                      setReferralError(null);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), checkReferralCode())}
                    placeholder="e.g. NAZ4X9R"
                    maxLength={10}
                    className="flex-1 rounded-card border border-border bg-bg px-3 py-2 font-mono text-sm tracking-widest text-text uppercase focus:border-brand-oxblood focus:outline-none focus:ring-1 focus:ring-brand-oxblood"
                  />
                  <button
                    type="button"
                    onClick={checkReferralCode}
                    disabled={!referralCode.trim() || lookingUpCode}
                    className="rounded-card border border-border bg-surface px-3 py-2 text-sm text-text transition-colors hover:bg-blush disabled:opacity-40"
                  >
                    {lookingUpCode ? "…" : "Apply"}
                  </button>
                </div>
                {referrer && (
                  <p className="text-sm text-success">
                    ✓ Referred by {referrer.name} — {settings.new_customer_discount_pct}% off applied
                  </p>
                )}
                {referralError && <p className="text-sm text-danger">{referralError}</p>}
              </div>
            )}

            {/* Date + Status + Channel */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <div>
                <label className="block text-sm font-medium text-text">Date</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-text">Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value as SaleStatus)} className={selectCls}>
                  <option value="completed">Completed</option>
                  <option value="pending">Pending</option>
                  <option value="returned">Returned</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-text">Channel</label>
                <select value={channel} onChange={(e) => setChannel(e.target.value as Channel)} className={selectCls}>
                  {CHANNELS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Stock warnings */}
            {stockWarnings.length > 0 && (
              <div className="rounded-card bg-warning/10 px-3 py-2 space-y-0.5">
                {stockWarnings.map((w) => (
                  <p key={w} className="text-sm text-warning">⚠ {w}</p>
                ))}
              </div>
            )}

            {/* Order summary */}
            {subtotal > 0 && (
              <div className="rounded-card bg-blush/40 px-4 py-3 space-y-1.5 text-sm">
                <Row label="Subtotal" value={fmt(subtotal)} />
                {referralDiscount > 0 && (
                  <Row label={`Welcome discount (${settings.new_customer_discount_pct}%)`} value={`−${fmt(referralDiscount)}`} className="text-success" />
                )}
                {redemptionDiscount > 0 && (
                  <Row label={`Points redeemed (${safeRedeem})`} value={`−${fmt(redemptionDiscount)}`} className="text-brand-rose" />
                )}
                {totalDiscount > 0 && (
                  <Row label="Total paid" value={fmt(orderTotal)} bold />
                )}
                {status === "completed" && pointsEarned > 0 && (
                  <Row label="Points earned" value={`+${pointsEarned} pts`} className="text-brand-rose" />
                )}
              </div>
            )}

            {error && (
              <p className="rounded-card bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
            )}

            <div className="flex justify-end">
              <button type="submit" disabled={saving}
                className="rounded-card bg-brand-oxblood px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-oxblood-deep disabled:opacity-50">
                {saving ? "Saving…" : "Record sale"}
              </button>
            </div>
          </form>
        </section>

        {/* ── History ── */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-muted">
            Recent sales{history.length > 0 && ` · ${history.length}`}
          </h2>

          {history.length === 0 ? (
            <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-border bg-surface">
              <p className="text-sm text-text-muted">No sales recorded yet.</p>
            </div>
          ) : (
            <>
              {/* Mobile: cards */}
              <div className="flex flex-col gap-3 md:hidden">
                {history.map((s) => (
                  <HistoryCard
                    key={s.id}
                    sale={s}
                    fmt={fmt}
                    onReturn={() => setConfirmReturnId(s.id)}
                    confirmingReturn={confirmReturnId === s.id}
                    returning={returning}
                    onConfirmReturn={() => handleReturn(s)}
                    onCancelReturn={() => setConfirmReturnId(null)}
                    onComplete={() => handleComplete(s)}
                    completing={completing}
                    onDelete={() => setConfirmDeleteId(s.id)}
                    confirmingDelete={confirmDeleteId === s.id}
                    deleting={deleting}
                    onConfirmDelete={() => handleDelete(s)}
                    onCancelDelete={() => setConfirmDeleteId(null)}
                  />
                ))}
              </div>

              {/* Desktop: table */}
              <div className="hidden overflow-x-auto rounded-lg border border-border bg-surface md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-blush/30">
                      {["Date", "Customer", "Channel", "Items", "Discount", "Total", "Points", "Status", ""].map((h) => (
                        <th key={h} className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-text-muted ${
                          ["Discount", "Total", "Points"].includes(h) ? "text-right" : "text-left"
                        }`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((s) => {
                      const paid = salePaid(s);
                      return (
                        <tr key={s.id}
                          className={`border-b border-border last:border-0 transition-colors ${
                            s.status === "returned" ? "opacity-60" : "hover:bg-blush/20"
                          }`}>
                          <td className="whitespace-nowrap px-4 py-3 text-text-muted">{fmtDate(s.date)}</td>
                          <td className="px-4 py-3">
                            <span className="font-medium text-text">{s.customers?.name ?? "Walk-in"}</span>
                            {s.city && <span className="ml-1 text-xs text-text-muted">· {s.city}</span>}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm text-text-muted">
                            {s.channel ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-text-muted">
                            {s.sale_items.map((item, i) => (
                              item.line_type === "bundle" ? (
                                <span key={i} className="block text-xs">
                                  <span className="font-medium text-brand-oxblood/70">Bundle</span>
                                  {item.bundle_components && ` ×${item.bundle_components.length}`}
                                </span>
                              ) : (
                                <span key={i} className="block text-xs">
                                  {item.products?.name ?? "—"} ×{item.quantity}
                                </span>
                              )
                            ))}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-text-muted">
                            {s.discount_amount > 0 ? `−${fmt(s.discount_amount)}` : "—"}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums font-medium text-text">{fmt(paid)}</td>
                          <td className="px-4 py-3 text-right tabular-nums text-brand-rose">
                            {s.points_earned > 0 ? `+${s.points_earned}` : "—"}
                          </td>
                          <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                          <td className="px-4 py-3 text-right">
                            {s.status === "completed" && (
                              confirmReturnId === s.id ? (
                                <div className="flex items-center justify-end gap-2">
                                  <button onClick={() => handleReturn(s)} disabled={returning}
                                    className="text-sm font-medium text-danger disabled:opacity-50">
                                    {returning ? "…" : "Confirm"}
                                  </button>
                                  <button onClick={() => setConfirmReturnId(null)}
                                    className="text-sm text-text-muted">Cancel</button>
                                </div>
                              ) : (
                                <button onClick={() => setConfirmReturnId(s.id)}
                                  className="text-sm text-text-muted hover:text-danger">
                                  Return
                                </button>
                              )
                            )}
                            {s.status === "pending" && (
                              confirmDeleteId === s.id ? (
                                <div className="flex items-center justify-end gap-2">
                                  <button onClick={() => handleDelete(s)} disabled={deleting}
                                    className="text-sm font-medium text-danger disabled:opacity-50">
                                    {deleting ? "…" : "Confirm delete"}
                                  </button>
                                  <button onClick={() => setConfirmDeleteId(null)}
                                    className="text-sm text-text-muted">Cancel</button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-end gap-3">
                                  <button onClick={() => handleComplete(s)} disabled={completing}
                                    className="text-sm font-medium text-success hover:text-success/80 disabled:opacity-50">
                                    {completing ? "…" : "Complete"}
                                  </button>
                                  <button onClick={() => setConfirmDeleteId(s.id)}
                                    className="text-sm text-text-muted hover:text-danger">
                                    Delete
                                  </button>
                                </div>
                              )
                            )}
                          </td>
                        </tr>
                      );
                    })}
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

// ─── small layout helper ──────────────────────────────────────────────────────

function Row({ label, value, bold, className }: {
  label: string; value: string; bold?: boolean; className?: string;
}) {
  return (
    <div className="flex justify-between">
      <span className="text-text-muted">{label}</span>
      <span className={`tabular-nums ${bold ? "font-semibold text-text" : ""} ${className ?? ""}`}>
        {value}
      </span>
    </div>
  );
}
