# NAZGULL — Sales & Inventory Dashboard

## What this is

A responsive, mobile-first web app for a small online boutique to track
inventory, sales, purchases, and profit. Must work great on a phone browser.

## Tech stack

- Next.js (App Router) + TypeScript (strict)
- Tailwind CSS
- Supabase (Postgres) for database + auth
- Recharts for charts; react-simple-maps for the Iraq map
- Deploy on Vercel

## Conventions

- Functional components only; keep them small and focused.
- Never hard-code colors — use the design tokens below via the Tailwind theme.
- UI copy: plain, active voice, sentence case. Buttons say what they do.

## Data model

- products: name, sku, category, selling_price, current_stock, avg_cost,
  reorder_level, photo_url
- purchases: product_id, quantity, unit_cost, date, supplier
- sales: date, customer_name, city (Iraqi city) + sale_items
  (product_id, quantity, unit_price, cost_at_sale)
- expenses: category, amount, date, note

## Core logic

- Weighted-average cost on purchase:
  avg_cost = (current_stock*avg_cost + qty*unit_cost) / (current_stock + qty)
- On a sale, store cost_at_sale = product's avg_cost at that moment;
  COGS = qty \* cost_at_sale
- Gross profit = revenue − COGS; Net profit = gross profit − operating expenses
  (both over the selected date range)
- Gross margin = gross/revenue; Net margin = net/revenue
- Low stock when current_stock <= reorder_level

## Brand tokens

Fonts: Playfair Display (logo + headings, used sparingly), Inter (UI, body,
numbers — use tabular numerals).
--brand-oxblood:#4A1416; --brand-oxblood-deep:#2E0A0A; --brand-rose:#C98B92;
--bg:#FBF1F0; --blush:#F4DAD9; --surface:#FFFFFF; --border:#ECCFCD;
--text:#2B1A1B; --text-muted:#8A6E6F;
--success:#4E7C59; --warning:#B5792B; --danger:#B23A48;
Aesthetic: elegant boutique. Generous whitespace, rounded corners 8–12px,
hairline borders, blush page background, white cards, oxblood primary buttons.
Lists are stacked cards on mobile, tables on desktop.
