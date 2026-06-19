export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  selling_price: number;
  current_stock: number;
  avg_cost: number;
  reorder_level: number;
  created_at: string;
}

export interface Purchase {
  id: string;
  product_id: string;
  quantity: number;
  unit_cost: number;
  date: string;
  supplier: string | null;
  created_at: string;
}

export interface PurchaseWithProduct extends Purchase {
  products: { name: string; sku: string } | null;
}

export interface Customer {
  id: string;
  phone: string;
  name: string;
  city: string | null;
  created_at: string;
  total_orders: number;
  total_spent: number;
  points_balance: number;
  referral_code: string;
  referred_by: string | null;
  referral_rewarded: boolean;
}

export type SaleStatus = "pending" | "completed" | "returned";

export interface Sale {
  id: string;
  date: string;
  customer_id: string | null;
  city: string | null;
  channel: string | null;
  status: SaleStatus;
  points_earned: number;
  points_redeemed: number;
  discount_amount: number;
  referral_code_used: string | null;
  created_at: string;
}

export interface SaleWithDetails extends Sale {
  customers: { name: string; phone: string } | null;
  sale_items: {
    id: string;
    product_id: string | null;
    quantity: number;
    unit_price: number;
    cost_at_sale: number;
    line_type: string;
    bundle_components: { product_id: string; cost_at_sale: number }[] | null;
    products: { name: string; sku: string } | null;
  }[];
}

export interface Expense {
  id: string;
  category: string;
  amount: number;
  date: string;
  note: string | null;
  created_at: string;
}

export interface LoyaltySettings {
  id: number;
  earn_rate: number;
  redeem_value: number;
  referrer_bonus: number;
  new_customer_discount_pct: number;
  base_currency: string;
  usd_iqd_rate: number;
  display_currency: string;
  default_bundle_price: number;
  monthly_ad_budget: number;
}
