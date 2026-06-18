/**
 * Development seed script — wipes and repopulates the database with
 * realistic boutique test data.
 *
 * Run:  npm run seed
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn("Warning: SUPABASE_SERVICE_ROLE_KEY not set — falling back to anon key (will fail if RLS is enabled)");
}

const db = createClient(url, key, {
  auth: { persistSession: false },
});

// ─── helpers ─────────────────────────────────────────────────────────────────

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

// ─── seed data ───────────────────────────────────────────────────────────────

const PRODUCTS = [
  { name: "Silk crepe blouse",       sku: "SCB-001", category: "Tops",        selling_price: 89,  avg_cost: 31,  current_stock: 14, reorder_level: 5 },
  { name: "Velvet midi dress",        sku: "VMD-001", category: "Dresses",     selling_price: 185, avg_cost: 67,  current_stock: 8,  reorder_level: 4 },
  { name: "Linen wide-leg trousers",  sku: "LWT-001", category: "Bottoms",     selling_price: 110, avg_cost: 42,  current_stock: 3,  reorder_level: 5 },
  { name: "Cashmere turtleneck",      sku: "CTN-001", category: "Knitwear",    selling_price: 220, avg_cost: 94,  current_stock: 6,  reorder_level: 3 },
  { name: "Leather crossbody bag",    sku: "LCB-001", category: "Accessories", selling_price: 145, avg_cost: 54,  current_stock: 2,  reorder_level: 3 },
  { name: "Wool wrap coat",           sku: "WWC-001", category: "Outerwear",   selling_price: 350, avg_cost: 138, current_stock: 4,  reorder_level: 2 },
  { name: "Cotton midi skirt",        sku: "CMS-001", category: "Bottoms",     selling_price: 75,  avg_cost: 27,  current_stock: 18, reorder_level: 6 },
  { name: "Satin slip dress",         sku: "SSD-001", category: "Dresses",     selling_price: 130, avg_cost: 47,  current_stock: 0,  reorder_level: 4 },
  { name: "Tweed blazer",             sku: "TWB-001", category: "Outerwear",   selling_price: 275, avg_cost: 109, current_stock: 5,  reorder_level: 2 },
  { name: "Embroidered scarf",        sku: "EMS-001", category: "Accessories", selling_price: 55,  avg_cost: 17,  current_stock: 22, reorder_level: 8 },
  { name: "Printed chiffon blouse",   sku: "PCB-001", category: "Tops",        selling_price: 95,  avg_cost: 36,  current_stock: 11, reorder_level: 5 },
  { name: "Suede ankle boots",        sku: "SAB-001", category: "Footwear",    selling_price: 195, avg_cost: 82,  current_stock: 7,  reorder_level: 3 },
] as const;

const IRAQI_CITIES = [
  "Baghdad", "Basra", "Mosul", "Erbil", "Sulaymaniyah",
  "Najaf", "Karbala", "Kirkuk", "Nasiriyah", "Duhok",
];

const CUSTOMER_NAMES = [
  "Noor Al-Rashid", "Lina Haddad", "Sara Mahmoud", "Dina Karimi",
  "Reem Al-Obeidi", "Maya Saleh", "Hana Jawad", "Layla Mustafa",
  "Sana Al-Zubaidi", "Fatima Khalil", "Rana Ibrahim", "Amal Hassan",
];

const SUPPLIERS = [
  "Milan Textile Co.", "Istanbul Fashion Hub", "Dubai Fabric House",
  "Beirut Style Imports", "Cairo Silk Traders",
];

const EXPENSE_CATEGORIES = ["Rent", "Utilities", "Marketing", "Packaging", "Shipping", "Insurance"];

// ─── wipe ─────────────────────────────────────────────────────────────────────

async function wipe() {
  // Delete in FK-safe order
  await db.from("sale_items").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await db.from("sales").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await db.from("purchases").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await db.from("expenses").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await db.from("products").delete().neq("id", "00000000-0000-0000-0000-000000000000");
}

// ─── seed ─────────────────────────────────────────────────────────────────────

async function seed() {
  console.log("Wiping existing data…");
  await wipe();

  // 1. Products
  console.log("Seeding products…");
  const { data: products, error: prodErr } = await db
    .from("products")
    .insert(PRODUCTS.map((p) => ({ ...p })))
    .select();

  if (prodErr || !products) {
    console.error("Products failed:", prodErr?.message);
    process.exit(1);
  }

  // 2. Purchases (60 days of history)
  console.log("Seeding purchases…");
  const purchases = products.flatMap((p) =>
    Array.from({ length: randInt(2, 5) }, () => ({
      product_id: p.id,
      quantity: randInt(5, 25),
      unit_cost: +(p.avg_cost * (0.9 + Math.random() * 0.2)).toFixed(2),
      date: daysAgo(randInt(1, 60)),
      supplier: pick(SUPPLIERS),
    }))
  );

  const { error: purchErr } = await db.from("purchases").insert(purchases);
  if (purchErr) console.warn("Purchases warning:", purchErr.message);

  // 3. Sales + sale_items (45 days of history)
  console.log("Seeding sales…");
  for (let i = 0; i < 40; i++) {
    const { data: sale, error: saleErr } = await db
      .from("sales")
      .insert({
        date: daysAgo(randInt(0, 45)),
        customer_name: pick(CUSTOMER_NAMES),
        city: pick(IRAQI_CITIES),
      })
      .select()
      .single();

    if (saleErr || !sale) continue;

    const itemCount = randInt(1, 3);
    const shuffled = [...products].sort(() => Math.random() - 0.5).slice(0, itemCount);

    const items = shuffled.map((p) => ({
      sale_id: sale.id,
      product_id: p.id,
      quantity: randInt(1, 3),
      unit_price: p.selling_price,
      cost_at_sale: p.avg_cost,
    }));

    const { error: itemErr } = await db.from("sale_items").insert(items);
    if (itemErr) console.warn(`Sale items warning (sale ${i}):`, itemErr.message);
  }

  // 4. Expenses (last 3 months)
  console.log("Seeding expenses…");
  const expenses = [
    // Fixed monthly costs
    ...[-90, -60, -30, 0].flatMap((offset) => [
      { category: "Rent",      amount: 1500, date: daysAgo(Math.abs(offset) + 1), note: "Monthly showroom rent" },
      { category: "Utilities", amount: randInt(90, 140), date: daysAgo(Math.abs(offset) + 15), note: null },
    ]),
    // Variable
    { category: "Marketing", amount: 450,  date: daysAgo(50), note: "Instagram ads — April" },
    { category: "Marketing", amount: 380,  date: daysAgo(20), note: "Instagram ads — May" },
    { category: "Packaging", amount: 85,   date: daysAgo(55), note: "Shopping bags and tissue paper" },
    { category: "Packaging", amount: 110,  date: daysAgo(18), note: "Ribbon and boxes restock" },
    { category: "Shipping",  amount: 65,   date: daysAgo(10), note: null },
    { category: "Insurance", amount: 200,  date: daysAgo(85), note: "Quarterly premium" },
  ];

  const { error: expErr } = await db.from("expenses").insert(expenses);
  if (expErr) console.warn("Expenses warning:", expErr.message);

  console.log("Done. Seeded:");
  console.log(`  ${products.length} products`);
  console.log(`  ${purchases.length} purchases`);
  console.log("  40 sales");
  console.log(`  ${expenses.length} expenses`);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
