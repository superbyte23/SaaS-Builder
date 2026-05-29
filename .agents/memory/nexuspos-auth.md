---
name: NexusPOS auth flow
description: Password hashing format, session management, demo credentials, and role values
---

## Password hashing (auth.ts)
Format: `saltHex:hashHex`
- salt = `crypto.randomBytes(16).toString("hex")` — a 32-char hex STRING
- hash = `crypto.scryptSync(password, saltHex, 64).toString("hex")` — 128-char hex

**Critical:** The salt passed to scryptSync must be the hex string, NOT a Buffer. If seeding via SQL, generate the hash in Node.js using the same pattern, not via Buffer.

## Sessions
In-memory Map (server restart clears all sessions). Token stored in localStorage as `nexuspos_token`. Bearer token injected by `lib/api-client-react/src/custom-fetch.ts`.

## Demo credentials
- admin@demoretail.com / password123 (role: owner, org: Demo Retail Co., branch: Main Street Store)
- cashier@demoretail.com / password123 (role: cashier)
- manager@demoretail.com / password123 (role: manager, branch: Downtown Branch)

## User roles (user_role enum)
super_admin, owner, manager, cashier, inventory_staff, accountant, auditor
(Note: "admin" is NOT a valid value — use "owner" instead)

## api-client-react package.json exports
Must include `"./src/generated/api.schemas": "./src/generated/api.schemas.ts"` for deep imports used by the frontend (register.tsx, pos.tsx, auth.tsx).
