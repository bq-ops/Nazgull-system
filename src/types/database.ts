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
