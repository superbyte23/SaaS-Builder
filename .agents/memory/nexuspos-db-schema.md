---
name: NexusPOS DB schema quirks
description: Non-obvious column names, enum issues, and drizzle-kit workarounds for the NexusPOS project
---

## Enum column names (non-standard)
Drizzle schema uses non-default column names for enum fields — use these exact names in raw SQL:
- `users.user_status_val` (maps to JS `status`)
- `users.role` (enum: `user_role`: super_admin, owner, manager, cashier, inventory_staff, accountant, auditor)
- `branches.branch_status_val` (maps to JS `status`, enum: active, inactive, suspended)
- `orders.order_status_val` (enum: draft, held, completed, refunded, voided)
- `orders.payment_method_val` (enum: cash, card, bank_transfer, mobile_wallet, qr, store_credit, mixed — NOT "mobile")
- `products.product_status_val` (enum: active, inactive, discontinued)
- `organizations.status` is `org_status` enum (active, suspended, trial)
- `organizations.plan` is `plan` enum (free, starter, professional, enterprise, trial)

## drizzle-kit push
`pnpm --filter @workspace/db run push` fails with "invalid input value for enum plan: trial" because drizzle-kit tries to re-set defaults on existing columns. All tables already exist — skip push, use raw SQL for schema changes.

**Why:** The plan enum had "trial" added via `ALTER TYPE plan ADD VALUE 'trial'` but drizzle-kit's cache/snapshot doesn't recognize it on subsequent push attempts.

**How to apply:** If schema changes are needed, apply them directly via `executeSql` or psql, not drizzle-kit push.

## Tables that exist
organizations, branches, users, categories, products, inventory, inventory_movements, customers, orders, order_items, suppliers
