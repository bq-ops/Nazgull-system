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

## Loyalty (points + referral)

Customers identified by phone number (social/COD selling, no logins).

Tables:

- customers: id, phone (unique), name, city, created_at, total_orders,
  total_spent, points_balance, referral_code (unique), referred_by, referral_rewarded
- points_transactions: id, customer_id, type (earn|redeem|referral_bonus|adjust),
  points (+/-), sale_id, note, created_at (balance = sum of points)
  Sales additions: customer_id, status (pending|completed|returned),
  points_earned, points_redeemed, discount_amount, referral_code_used
  Settings (one editable row): earn_rate, redeem_value, referrer_bonus,
  new_customer_discount_pct

Rules:

- Points/referral bonuses awarded only when sale.status = completed; returned orders reverse them.
- Earn: points_earned = floor(order_total \* earn_rate), on completion.
- Redeem: discount = points_redeemed \* redeem_value, capped at order total;
  cannot redeem more than balance; record a redeem transaction.
- Referral: new customer enters a code on first order -> referred_by set + new_customer_discount_pct off;
  when that first order completes, referrer gets referrer_bonus points once (guard with referral_rewarded).
