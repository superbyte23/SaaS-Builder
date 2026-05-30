# NexusPOS

**NexusPOS** is an open-source, multi-tenant SaaS Point-of-Sale platform built for Philippine retail businesses. It supports multiple business types (retail, grocery, pharmacy, restaurant, salon, and more), enforces Philippine VAT rules and government-mandated discount types (Senior Citizen, PWD, Solo Parent), and provides a complete back-office management suite alongside the cashier-facing POS terminal.

---

## Table of Contents

1. [Features](#features)
2. [Tech Stack](#tech-stack)
3. [Architecture Overview](#architecture-overview)
4. [Repository Structure](#repository-structure)
5. [Getting Started](#getting-started)
6. [Environment Variables](#environment-variables)
7. [Database Schema](#database-schema)
8. [API Reference](#api-reference)
9. [Philippine Discount & VAT Rules](#philippine-discount--vat-rules)
10. [User Roles & Permissions](#user-roles--permissions)
11. [Frontend Pages](#frontend-pages)
12. [Development Workflow](#development-workflow)
13. [Demo Data](#demo-data)
14. [Scripts Reference](#scripts-reference)

---

## Features

### Point of Sale (Cashier Terminal)
- Fast product search and category filtering
- Barcode/SKU lookup
- Cart management (add, remove, adjust quantity)
- **Philippine discount types** with correct VAT computation:
  - Senior Citizen (SC) — 20%, VAT-exempt (RA 9994)
  - Person with Disability (PWD) — 20%, VAT-exempt (RA 10754)
  - Solo Parent — 10% (RA 8972)
  - Custom percentage or fixed amount
- Government-mandated ID number capture for audit trail
- 12% VAT display (inclusive pricing model)
- Customer selection (walk-in or from customer database)
- Payment methods: Cash, Card, GCash/Maya (Mobile Wallet), Bank Transfer
- Received amount input with automatic change calculation
- Post-payment receipt dialog with full breakdown

### Back Office Management
| Module | Features |
|--------|----------|
| **Dashboard** | KPI cards (revenue, orders, customers), sales trend chart, top-selling products, recent transactions, low-stock alerts |
| **Products** | Full CRUD — name, price, cost, SKU, barcode, category, unit, VAT rate per item, reorder point |
| **Categories** | Full CRUD with color picker and emoji icons |
| **Inventory** | Stock level monitoring, low-stock alerts, add/remove stock adjustments with reason codes and audit trail |
| **Customers** | Full CRUD — contact details, order history, loyalty points, total spend |
| **Orders** | Transaction history with status, payment method, and itemized breakdown |
| **Suppliers** | Full CRUD — company, contact person, email, phone, address |
| **Employees** | Full CRUD — role assignment, branch assignment, password management |
| **Branches** | Full CRUD — multi-location support with per-branch tax rate, main branch protection |
| **Reports** | Sales reports (daily/weekly/monthly/yearly), inventory valuation report |
| **Settings** | Organization profile management |

### Multi-tenant Architecture
- Every data record belongs to an organization
- Branch-level scoping for users and inventory
- Supports multiple business types: `retail`, `grocery`, `pharmacy`, `restaurant`, `salon`, `hotel`, `hardware`, `bakery`, `clinic`, `laundry`, `other`

---

## Tech Stack

### Backend (`artifacts/api-server`)
| Technology | Version | Purpose |
|------------|---------|---------|
| **Node.js** | 24 | Runtime |
| **TypeScript** | ~5.9 | Type safety |
| **Express** | ^5.2 | HTTP server framework |
| **Drizzle ORM** | ^0.45 | Database ORM & query builder |
| **PostgreSQL** | 16+ | Primary database |
| **Zod** | ^3.25 (v4 API) | Request/response validation |
| **drizzle-zod** | — | Auto-generates Zod schemas from Drizzle tables |
| **Pino** | ^9.14 | Structured JSON logging |
| **pino-http** | ^10.5 | HTTP request/response logging middleware |
| **cors** | ^2.8 | Cross-Origin Resource Sharing |
| **cookie-parser** | ^1.4 | Cookie parsing middleware |
| **esbuild** | 0.27.3 | Fast TypeScript bundler (CJS output) |

### Frontend (`artifacts/pos`)
| Technology | Version | Purpose |
|------------|---------|---------|
| **React** | 19.1.0 | UI library |
| **Vite** | ^7.3 | Dev server & build tool |
| **TypeScript** | ~5.9 | Type safety |
| **TailwindCSS** | ^4.1 | Utility-first CSS |
| **Radix UI** | various | Accessible headless UI primitives |
| **shadcn/ui** | — | Component library built on Radix UI |
| **TanStack Query** | ^5.90 | Server state management & data fetching |
| **Wouter** | ^3.3 | Lightweight client-side routing |
| **Recharts** | ^2.15 | Charting library for dashboard graphs |
| **Lucide React** | ^0.545 | Icon library |
| **Framer Motion** | ^12.23 | Animations |
| **React Hook Form** | ^7.55 | Form state management |
| **date-fns** | ^3.6 | Date utilities |
| **next-themes** | ^0.4 | Dark/light mode support |
| **sonner** | ^2.0 | Toast notifications |

### Shared Libraries (`lib/`)
| Package | Purpose |
|---------|---------|
| `@workspace/db` | Drizzle schema definitions, migrations, database client |
| `@workspace/api-spec` | OpenAPI 3.0 specification (source of truth for the API contract) |
| `@workspace/api-zod` | Zod schemas auto-generated from the OpenAPI spec via Orval |
| `@workspace/api-client-react` | TanStack Query hooks auto-generated from the OpenAPI spec via Orval |

### Tooling
| Tool | Purpose |
|------|---------|
| **pnpm workspaces** | Monorepo package management |
| **Orval** | OpenAPI → TypeScript codegen (hooks + schemas) |
| **esbuild-plugin-pino** | Bundles Pino workers correctly for the server |

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│                    Browser / Preview                      │
│                                                           │
│   React + Vite SPA  (/pos)                               │
│   ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│   │  POS Page   │  │  Dashboard   │  │  Management   │  │
│   │  (Checkout) │  │  (Reports)   │  │  (CRUD Pages) │  │
│   └──────┬──────┘  └──────┬───────┘  └───────┬───────┘  │
│          │                │                   │          │
│          └────────────────┴───────────────────┘          │
│                     TanStack Query                        │
│              (auto-generated API hooks)                   │
└─────────────────────────┬────────────────────────────────┘
                          │ HTTP / REST
                  Replit Reverse Proxy
                          │
┌─────────────────────────▼────────────────────────────────┐
│               Express 5 API Server  (/api)                │
│                                                           │
│   Auth Middleware  →  Route Handlers  →  Zod Validation  │
│                              │                            │
│                       Drizzle ORM                         │
│                              │                            │
│                    PostgreSQL Database                     │
└──────────────────────────────────────────────────────────┘
```

### API-First Design
The API contract lives in a single OpenAPI 3.0 YAML spec (`lib/api-spec/openapi.yaml`). From it, two sets of artifacts are generated:
- **Zod schemas** (`lib/api-zod`) — used by the Express server for request validation
- **React Query hooks + TypeScript types** (`lib/api-client-react`) — used by the frontend

This means the frontend and backend are always in sync with the same types. Regenerate both with:
```bash
pnpm --filter @workspace/api-spec run codegen
```

### Authentication
- Sessions are stored in an **in-memory Map** on the server (cleared on restart in development)
- A Bearer token is issued on login and stored in `localStorage` as `nexuspos_token`
- The custom fetch wrapper in `lib/api-client-react/src/custom-fetch.ts` injects the token on every request
- Passwords are hashed using `scrypt` (Node.js built-in crypto): `salt:hash` format

### Multi-tenancy
- Every resource (products, customers, orders, etc.) is scoped to an `organizationId`
- The `requireAuth` middleware resolves the current user's organization and injects it into `req.user`
- Branch-level scoping applies to inventory and users

---

## Repository Structure

```
nexuspos/
├── artifacts/
│   ├── api-server/              # Express 5 backend
│   │   └── src/
│   │       ├── index.ts         # Entry point — Express app setup
│   │       ├── lib/
│   │       │   └── auth.ts      # Password hashing & session helpers
│   │       ├── middlewares/
│   │       │   └── auth.ts      # requireAuth middleware
│   │       └── routes/          # One file per resource
│   │           ├── auth.ts
│   │           ├── branches.ts
│   │           ├── categories.ts
│   │           ├── customers.ts
│   │           ├── dashboard.ts
│   │           ├── health.ts
│   │           ├── inventory.ts
│   │           ├── orders.ts
│   │           ├── organizations.ts
│   │           ├── products.ts
│   │           ├── reports.ts
│   │           ├── suppliers.ts
│   │           └── users.ts
│   │
│   └── pos/                     # React + Vite frontend SPA
│       └── src/
│           ├── components/
│           │   ├── layout/      # DashboardLayout, Sidebar, Topbar
│           │   └── ui/          # shadcn/ui component library
│           ├── lib/
│           │   └── auth.tsx     # AuthContext & useAuth hook
│           └── pages/
│               ├── login.tsx
│               ├── register.tsx
│               ├── dashboard.tsx
│               ├── pos.tsx      # POS cashier terminal
│               ├── products.tsx
│               ├── categories.tsx
│               ├── inventory.tsx
│               ├── customers.tsx
│               ├── orders.tsx
│               ├── suppliers.tsx
│               ├── employees.tsx
│               ├── branches.tsx
│               ├── reports.tsx
│               └── settings.tsx
│
├── lib/
│   ├── db/                      # Database layer
│   │   └── src/schema/          # Drizzle table definitions
│   │       ├── organizations.ts
│   │       ├── branches.ts
│   │       ├── users.ts
│   │       ├── categories.ts
│   │       ├── products.ts
│   │       ├── inventory.ts
│   │       ├── customers.ts
│   │       ├── orders.ts
│   │       └── suppliers.ts
│   │
│   ├── api-spec/                # OpenAPI 3.0 spec (source of truth)
│   │   └── openapi.yaml
│   │
│   ├── api-zod/                 # Generated Zod schemas (do not edit manually)
│   └── api-client-react/        # Generated TanStack Query hooks (do not edit manually)
│
├── pnpm-workspace.yaml          # Workspace config, catalog versions
├── tsconfig.base.json           # Shared TypeScript config
└── README.md
```

---

## Getting Started

### Prerequisites
- Node.js 20+
- pnpm 9+
- PostgreSQL 14+

### 1. Clone and install dependencies
```bash
git clone <repo-url>
cd nexuspos
pnpm install
```

### 2. Configure environment
Create a `.env` file in the root (or set these via your hosting provider):
```env
DATABASE_URL=postgresql://user:password@localhost:5432/nexuspos
SESSION_SECRET=your-super-secret-session-key
```

### 3. Set up the database
The database schema is managed by Drizzle ORM. All tables are created via migration:
```bash
pnpm --filter @workspace/db run push
```

> **Note:** On Replit, the PostgreSQL database is provisioned automatically and `DATABASE_URL` is pre-set. Do not run `push` if tables already exist — it may fail due to enum caching. Apply schema changes via raw SQL instead.

### 4. Start the development servers

**API Server** (port 8080):
```bash
pnpm --filter @workspace/api-server run dev
```

**Frontend** (port auto-assigned by Replit, typically 24730):
```bash
pnpm --filter @workspace/pos run dev
```

Both are available through the Replit reverse proxy at `localhost:80`.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `SESSION_SECRET` | Yes | Secret for session token signing |
| `PORT` | Auto | Injected by Replit workflows — do not hardcode |
| `NODE_ENV` | Auto | `development` or `production` |

---

## Database Schema

### `organizations`
| Column | Type | Description |
|--------|------|-------------|
| `id` | serial PK | |
| `name` | text | Business name |
| `slug` | text unique | URL-safe identifier |
| `business_type` | enum | retail, grocery, pharmacy, restaurant, salon, hotel, hardware, bakery, clinic, laundry, other |
| `plan` | enum | free, starter, professional, enterprise, trial |
| `status` | enum | active, suspended, trial |
| `currency` | text | Default: `PHP` |
| `timezone` | text | e.g. `Asia/Manila` |
| `tax_rate` | numeric | Organization-level default VAT rate |

### `branches`
| Column | Type | Description |
|--------|------|-------------|
| `id` | serial PK | |
| `organization_id` | FK → organizations | |
| `name` | text | Branch display name |
| `address` | text | |
| `phone` | text | |
| `email` | text | |
| `is_main` | boolean | Whether this is the head office |
| `status` | enum | active, inactive, suspended |
| `tax_rate` | numeric | Branch-level tax rate override |

### `users`
| Column | Type | Description |
|--------|------|-------------|
| `id` | serial PK | |
| `organization_id` | FK → organizations | |
| `branch_id` | FK → branches (nullable) | null = access to all branches |
| `name` | text | |
| `email` | text unique | Login credential |
| `password_hash` | text | `saltHex:hashHex` (scrypt) |
| `role` | enum | super_admin, owner, manager, cashier, inventory_staff, accountant, auditor |
| `user_status_val` | enum | active, inactive |
| `phone` | text | |

### `categories`
| Column | Type | Description |
|--------|------|-------------|
| `id` | serial PK | |
| `organization_id` | FK → organizations | |
| `name` | text | |
| `description` | text | |
| `color` | text | Hex color code |
| `icon` | text | Emoji or icon code |
| `sort_order` | integer | Display ordering |

### `products`
| Column | Type | Description |
|--------|------|-------------|
| `id` | serial PK | |
| `organization_id` | FK → organizations | |
| `category_id` | FK → categories | |
| `name` | text | |
| `description` | text | |
| `sku` | text | Stock Keeping Unit |
| `barcode` | text | EAN/UPC barcode |
| `price` | numeric | VAT-inclusive selling price |
| `cost_price` | numeric | Purchase cost |
| `unit` | text | piece, pack, kg, g, litre, ml, box, dozen, pair, set |
| `tax_rate` | numeric | Per-product VAT rate override |
| `reorder_point` | integer | Stock level that triggers low-stock alert |
| `track_inventory` | boolean | Whether to track stock quantity |
| `product_status_val` | enum | active, inactive, discontinued |
| `image` | text | Image URL |

### `inventory`
| Column | Type | Description |
|--------|------|-------------|
| `id` | serial PK | |
| `product_id` | FK → products | |
| `branch_id` | FK → branches | |
| `quantity` | integer | Current stock on hand |
| `reorder_point` | integer | Branch-level reorder threshold |

### `inventory_movements`
| Column | Type | Description |
|--------|------|-------------|
| `id` | serial PK | |
| `product_id` | FK → products | |
| `branch_id` | FK → branches | |
| `quantity` | integer | Positive = stock in, Negative = stock out |
| `reason` | enum | purchase, return, adjustment, damage, transfer, opening_stock, audit, sale |
| `reference_id` | integer | Associated order ID (for sales) |
| `notes` | text | Audit note |

### `customers`
| Column | Type | Description |
|--------|------|-------------|
| `id` | serial PK | |
| `organization_id` | FK → organizations | |
| `name` | text | |
| `email` | text | |
| `phone` | text | |
| `address` | text | |
| `loyalty_points` | integer | Accumulated loyalty points |
| `notes` | text | |

### `orders`
| Column | Type | Description |
|--------|------|-------------|
| `id` | serial PK | |
| `organization_id` | FK → organizations | |
| `branch_id` | FK → branches | |
| `customer_id` | FK → customers (nullable) | null = walk-in |
| `cashier_id` | FK → users | |
| `order_number` | text unique | Auto-generated e.g. `ORD-20260530-0001` |
| `order_status_val` | enum | draft, held, completed, refunded, voided |
| `payment_method_val` | enum | cash, card, bank_transfer, mobile_wallet, qr, store_credit, mixed |
| `subtotal` | numeric | Sum of line items |
| `discount_amount` | numeric | Total discount applied |
| `tax_amount` | numeric | VAT charged |
| `total` | numeric | Amount customer pays |
| `amount_paid` | numeric | Cash tendered |
| `change_amount` | numeric | Change returned |
| `notes` | text | Includes discount ID number for SC/PWD/Solo Parent |

### `order_items`
| Column | Type | Description |
|--------|------|-------------|
| `id` | serial PK | |
| `order_id` | FK → orders | |
| `product_id` | FK → products | |
| `quantity` | integer | |
| `unit_price` | numeric | Price at time of sale |
| `discount` | numeric | Item-level discount |
| `total_price` | numeric | `(unit_price × quantity) − discount` |

### `suppliers`
| Column | Type | Description |
|--------|------|-------------|
| `id` | serial PK | |
| `organization_id` | FK → organizations | |
| `name` | text | Company name |
| `contact_person` | text | |
| `email` | text | |
| `phone` | text | |
| `address` | text | |
| `notes` | text | Payment terms, etc. |

---

## API Reference

All endpoints are prefixed with `/api`. Protected endpoints require the `Authorization: Bearer <token>` header.

### Authentication

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/healthz` | No | Health check |
| `POST` | `/api/auth/register` | No | Register a new organization + owner account |
| `POST` | `/api/auth/login` | No | Login and receive a session token |
| `POST` | `/api/auth/logout` | Yes | Invalidate the current session |
| `GET` | `/api/auth/me` | Yes | Get the authenticated user's profile |

**POST /api/auth/register**
```json
{
  "name": "Jane Doe",
  "email": "jane@acme.com",
  "password": "secret123",
  "organizationName": "Acme Store",
  "businessType": "retail"
}
```

**POST /api/auth/login**
```json
{ "email": "jane@acme.com", "password": "secret123" }
```
Returns: `{ "token": "...", "user": { ... } }`

---

### Organizations

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/organizations` | List organizations (super_admin only) |
| `POST` | `/api/organizations` | Create organization |
| `GET` | `/api/organizations/:id` | Get organization detail |
| `PATCH` | `/api/organizations/:id` | Update organization profile |

---

### Branches

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/branches` | List branches for current org |
| `POST` | `/api/branches` | Create a branch |
| `GET` | `/api/branches/:id` | Get branch detail |
| `PATCH` | `/api/branches/:id` | Update branch |
| `DELETE` | `/api/branches/:id` | Delete branch (non-main only) |

---

### Users / Employees

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/users` | List users in current org |
| `POST` | `/api/users` | Create user (employee) |
| `GET` | `/api/users/:id` | Get user detail |
| `PATCH` | `/api/users/:id` | Update user |
| `DELETE` | `/api/users/:id` | Delete user |

---

### Categories

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/categories` | List categories |
| `POST` | `/api/categories` | Create category |
| `PATCH` | `/api/categories/:id` | Update category |
| `DELETE` | `/api/categories/:id` | Delete category |

---

### Products

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/products` | List products (supports `?search=`, `?categoryId=`, `?status=`) |
| `POST` | `/api/products` | Create product |
| `GET` | `/api/products/:id` | Get product detail |
| `PATCH` | `/api/products/:id` | Update product |
| `DELETE` | `/api/products/:id` | Delete product |
| `GET` | `/api/products/barcode/:barcode` | Lookup product by barcode |

---

### Inventory

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/inventory` | List inventory levels (supports `?branchId=`, `?lowStock=true`) |
| `POST` | `/api/inventory/adjust` | Adjust stock (add or remove) |
| `GET` | `/api/inventory/movements` | List inventory movement history |

**POST /api/inventory/adjust**
```json
{
  "productId": 5,
  "branchId": 1,
  "quantity": 50,
  "reason": "purchase",
  "notes": "Supplier delivery"
}
```
Use a negative `quantity` to remove stock.

---

### Customers

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/customers` | List customers (supports `?search=`) |
| `POST` | `/api/customers` | Create customer |
| `GET` | `/api/customers/:id` | Get customer + stats |
| `PATCH` | `/api/customers/:id` | Update customer |
| `DELETE` | `/api/customers/:id` | Delete customer |
| `GET` | `/api/customers/:id/orders` | Get customer order history |

---

### Orders

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/orders` | List orders (supports `?status=`, `?branchId=`, `?from=`, `?to=`) |
| `POST` | `/api/orders` | Create a new order (status: `draft`) |
| `GET` | `/api/orders/:id` | Get order with line items |
| `PATCH` | `/api/orders/:id` | Update order |
| `POST` | `/api/orders/:id/complete` | Complete order + process payment + deduct inventory |
| `POST` | `/api/orders/:id/refund` | Refund order + restore inventory |

**POST /api/orders**
```json
{
  "branchId": 1,
  "customerId": 3,
  "discountAmount": 50.00,
  "notes": "SC ID: 12345678",
  "items": [
    { "productId": 7, "quantity": 2, "unitPrice": 299.00 },
    { "productId": 12, "quantity": 1, "unitPrice": 150.00 }
  ]
}
```

**POST /api/orders/:id/complete**
```json
{
  "paymentMethod": "cash",
  "amountPaid": 1000.00
}
```

---

### Suppliers

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/suppliers` | List suppliers |
| `POST` | `/api/suppliers` | Create supplier |
| `PATCH` | `/api/suppliers/:id` | Update supplier |
| `DELETE` | `/api/suppliers/:id` | Delete supplier |

---

### Dashboard

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/dashboard/summary` | KPI summary (revenue, orders, customers, avg order) |
| `GET` | `/api/dashboard/sales-chart` | Sales trend data by day/week/month |
| `GET` | `/api/dashboard/top-products` | Best-selling products |
| `GET` | `/api/dashboard/recent-orders` | Latest transactions |
| `GET` | `/api/dashboard/low-stock` | Products below reorder point |

---

### Reports

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/reports/sales` | Sales report grouped by day/week/month/year |
| `GET` | `/api/reports/inventory-valuation` | Current stock value by product |

---

## Philippine Discount & VAT Rules

NexusPOS implements Philippine BIR-compliant tax and discount calculations.

### VAT (Value-Added Tax)
- Standard rate: **12%**
- Prices in the system are stored and displayed **VAT-inclusive**
- VAT is extracted from the inclusive price using: `VAT = price × (0.12 / 1.12)`

### Government-Mandated Discounts

#### Senior Citizen — 20% (Republic Act 9994)
Discount is applied on the **VAT-exclusive** price. The customer is fully VAT-exempt.

```
VAT-exclusive base = selling price ÷ 1.12
Discount amount    = VAT-exclusive base × 20%
Customer pays      = VAT-exclusive base × 80%
VAT charged        = ₱0.00  (store absorbs VAT)
```

**Example:** Item priced at ₱112.00
- VAT-exclusive: ₱112 ÷ 1.12 = ₱100.00
- SC 20% discount: ₱100 × 0.20 = ₱20.00
- Customer pays: ₱80.00 (no VAT)

#### PWD (Person with Disability) — 20% (Republic Act 10754)
Same formula as Senior Citizen. Both require capture of the government-issued ID number for BIR audit purposes.

#### Solo Parent — 10% (Republic Act 8972)
Discount is applied on the selling price. **VAT still applies** on the discounted amount.

```
Discount amount      = selling price × 10%
Discounted total     = selling price × 90%
VAT on discounted    = discounted total × (0.12 / 1.12)
Customer pays        = discounted total (VAT-inclusive)
```

#### Custom Discounts
- **Percentage (%)** — applied on the subtotal; VAT computed on discounted amount
- **Fixed amount (₱)** — deducted from subtotal; VAT computed on discounted amount

### ID Number Audit Trail
For SC, PWD, and Solo Parent discounts, the cashier is required to enter the beneficiary's government-issued ID number. This is stored in the `orders.notes` field (format: `"SC ID: 12345678"`) and is printed on the receipt.

---

## User Roles & Permissions

| Role | Description | Typical Permissions |
|------|-------------|---------------------|
| `super_admin` | Platform administrator | Full access across all organizations |
| `owner` | Business owner | Full access within their organization |
| `manager` | Store/branch manager | All operations except deleting org-level data |
| `cashier` | POS operator | Process sales, view products, view customers |
| `inventory_staff` | Warehouse staff | View and adjust inventory |
| `accountant` | Finance staff | View reports, orders, and financial data |
| `auditor` | Internal/external auditor | Read-only access to all data |

---

## Frontend Pages

| Route | Page | Description |
|-------|------|-------------|
| `/` | Login | Email + password sign-in |
| `/register` | Register | Create a new organization account |
| `/dashboard` | Dashboard | KPI overview, charts, alerts |
| `/pos` | POS Terminal | Cashier checkout with discount & payment |
| `/products` | Products | Product catalog CRUD |
| `/categories` | Categories | Category management with color & icon |
| `/inventory` | Inventory | Stock levels, adjustments, low-stock alerts |
| `/customers` | Customers | Customer database CRUD |
| `/orders` | Orders | Transaction history |
| `/employees` | Employees | Staff accounts & role management |
| `/branches` | Branches | Location management |
| `/suppliers` | Suppliers | Vendor management CRUD |
| `/reports` | Reports | Sales & inventory valuation reports |
| `/settings` | Settings | Organization profile |

---

## Development Workflow

### Regenerate API Client (after modifying OpenAPI spec)
```bash
pnpm --filter @workspace/api-spec run codegen
```
This updates both `lib/api-zod` and `lib/api-client-react`. **Never manually edit files in those packages.**

### Typecheck Everything
```bash
pnpm run typecheck
```

### Typecheck a Single Package
```bash
pnpm --filter @workspace/pos run typecheck
pnpm --filter @workspace/api-server run typecheck
```

### Build for Production
```bash
pnpm run build
```

### Adding a New API Endpoint
1. Add the endpoint to `lib/api-spec/openapi.yaml`
2. Run `pnpm --filter @workspace/api-spec run codegen`
3. Implement the route handler in `artifacts/api-server/src/routes/<resource>.ts`
4. Register the router in `artifacts/api-server/src/routes/index.ts`
5. Use the generated hook on the frontend (it will appear in `@workspace/api-client-react`)

### Adding a New Database Table
1. Create a schema file in `lib/db/src/schema/<table>.ts`
2. Export it from `lib/db/src/schema/index.ts`
3. Run `pnpm --filter @workspace/db run push` (dev only)
4. Update the OpenAPI spec and regenerate the client

### Logging
Use structured logging — **never `console.log` in server code**.
- Inside route handlers: `req.log.info(...)`, `req.log.error(...)`
- Outside request context: import the singleton `logger` from `lib/auth.ts`

---

## Demo Data

A demo organization is pre-seeded for immediate testing.

### Organization
**Demo Retail Co.** — retail business, Philippine peso (PHP), Asia/Manila timezone

### Branches
| Branch | Type |
|--------|------|
| Main Street Store | Main branch |
| Downtown Branch | Secondary branch |

### Demo Credentials
| Email | Password | Role | Branch |
|-------|----------|------|--------|
| `admin@demoretail.com` | `password123` | Owner | Main Street Store |
| `manager@demoretail.com` | `password123` | Manager | Downtown Branch |
| `cashier@demoretail.com` | `password123` | Cashier | Main Street Store |

### Seed Data
- **6 categories** (Electronics, Beverages, Snacks, Dairy, Personal Care, Household)
- **13 products** with pricing, SKUs, and inventory
- **8 customers** with order history and loyalty points
- **18 completed orders** totaling approximately ₱5,400 in revenue
- **5 suppliers**
- Inventory stocked across both branches

---

## Scripts Reference

| Command | Description |
|---------|-------------|
| `pnpm install` | Install all workspace dependencies |
| `pnpm run typecheck` | Full TypeScript check across all packages |
| `pnpm run build` | Typecheck + build all packages |
| `pnpm --filter @workspace/api-server run dev` | Start API server in development mode |
| `pnpm --filter @workspace/pos run dev` | Start frontend dev server |
| `pnpm --filter @workspace/api-spec run codegen` | Regenerate API client from OpenAPI spec |
| `pnpm --filter @workspace/db run push` | Push DB schema changes (dev only) |
| `pnpm --filter @workspace/<pkg> run typecheck` | Typecheck a specific package |

---

## License

MIT — see [LICENSE](LICENSE) for details.
