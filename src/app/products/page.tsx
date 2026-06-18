import { createClient } from "@/lib/supabase/server";
import type { Product } from "@/types/database";
import ProductsClient from "./ProductsClient";

export const metadata = { title: "Products — Nazgull" };

export default async function ProductsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("*")
    .order("name");

  return <ProductsClient initialProducts={(data as Product[]) ?? []} />;
}
