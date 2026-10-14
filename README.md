# Kitchen Display Queue

An internal tool for a restaurant kitchen: the expeditor sees every active order ranked by a
priority score and moves each order through its preparation stages.

- **API**: Node.js 22, Express 5, Sequelize 6 (migrations), PostgreSQL 16, Jest — `api/`
- **Web**: Vite, React 19, TypeScript, MUI 7, Vitest, Playwright — `web/`

| Service    | Port |
| ---------- | ---- |
| API        | 4000 |
| Web        | 5173 |
| PostgreSQL | 5433 (host) → 5432 (container) |

## Getting started

Prerequisites: **Docker**. Node 22 is only needed for option B and for the Playwright e2e test.

### Option A — Docker only (no Node on the host)

```bash
docker compose up -d                              # 1. Postgres (docker-compose.yml)
docker compose -f docker-compose-app.yml up       # 2. API + web in Node 22 containers
```

The API container runs `npm install`, the migrations and the seed every time it starts, so each
start gives fresh demo data with dates relative to now. Open http://localhost:5173.

Run the unit tests inside the containers (while they are running):

```bash
docker compose -f docker-compose-app.yml exec api npm test
docker compose -f docker-compose-app.yml exec web npm test
```

### Option B — Node 22 on the host

```bash
docker compose up -d     # 1. start Postgres
npm install              # 2. installs the root, api/ and web/ dependencies
npm run db:setup         # 3. runs migrations + seed
npm run dev              # 4. starts the API and the web app
```

Do not run both options at the same time: they use the same ports.

## Tests

```bash
npm test                 # Jest (api) + Vitest (web); no database needed
```

- `api/tests/priority.test.js`: the scoring formula, both caps, every promised-time bucket, and the tie-break. All use a frozen `now`.
- `api/tests/transitions.test.js`: every legal and illegal status change, and the queue contents. Uses an in-memory repository.
- `api/tests/createOrder.test.js`: `POST /orders` validation.
- `api/tests/menu.test.js`: the menu listing.
- `web/src/components/QueueTable.test.tsx`: the empty state, Cancel only for received orders, and rows kept in API order.
- `web/src/components/KitchenDisplay.test.tsx`: a background refresh shows a new order, a rejected transition shows an error, and the + button opens the dialog.
- `web/src/components/NewOrderDialog.test.tsx`: the form sends the right payload, an API validation error is shown, and item rows can be added and removed.
- `web/e2e/`: start a seeded order, and create an order through the + button.

### End-to-end (Playwright, runs on the host)

```bash
npm install                                   # once
npx --prefix web playwright install chromium  # once
npm run test:e2e
```

`npm run test:e2e` boots whatever is missing:

- If the apps are already running (from option A or B), Playwright reuses them.
- Otherwise it starts Postgres if it is not running (`docker compose up -d`, via
  `web/scripts/ensure-postgres.mjs`), re-seeds the database, and starts the API and web app.

If no `received` orders are left, run `npm run db:setup` (or restart the API container) to reset
the demo data.

## API

| Method | Path                  | Behavior |
| ------ | --------------------- | -------- |
| GET    | `/orders/queue`       | Active queue (`received` + `preparing`) sorted by score. `?status=received` or `?status=preparing` to filter. Each order includes `score`, `minutes_waiting` and `allowed_actions`. |
| POST   | `/orders/:id/start`   | `received` → `preparing` |
| POST   | `/orders/:id/ready`   | `preparing` → `ready` |
| POST   | `/orders/:id/pickup`  | `ready` → `picked_up` |
| POST   | `/orders/:id/cancel`  | `received` → `cancelled` |
| POST   | `/orders`             | Create an order: `{ customer_name, type, is_vip?, promised_at?, items: [{ menu_item_id, quantity }] }` |
| GET    | `/menu-items`         | The menu (feeds the "New order" form). |

`request.http` has a ready-to-send sample for every endpoint and every error code. Open it in
VS Code with the [REST Client](https://marketplace.visualstudio.com/items?itemName=humao.rest-client)
extension and click **Send Request**.

### Error codes

Every error response has the shape `{ "error": { "code": "...", "message": "..." } }`.

| Code                    | HTTP | When |
| ----------------------- | ---- | ---- |
| `INVALID_TRANSITION`    | 409  | The status change is not allowed from the current status. This includes repeating a step, skipping a step, changing a terminal order, or losing a race with another request. |
| `ORDER_NOT_FOUND`       | 404  | No order with that id (or the id is not a positive integer). |
| `INVALID_STATUS_FILTER` | 400  | `status` query parameter is not `received` or `preparing`. |
| `VALIDATION_ERROR`      | 400  | `POST /orders` body is invalid, or a `menu_item_id` does not exist. |
| `INVALID_JSON`          | 400  | Request body is not valid JSON. |
| `ROUTE_NOT_FOUND`       | 404  | Unknown path. |
| `INTERNAL_ERROR`        | 500  | Unexpected server error (details are logged, not returned). |

## UI

- The queue table with a filter (Active / Received / Preparing). Each row shows the actions the API allows for it, and errors appear in a red alert.
- **Auto-refresh** every 5 seconds, in the background (no progress bar). It picks up orders created elsewhere and keeps the scores current, and it pauses while the browser tab is hidden.
- **New order**: the floating **+** button opens a dialog (customer, type, VIP, "promised in N minutes", item rows). The API validates the order and any error is shown inside the dialog.
- The order of the rows is always the API's order: score, then the tie-break from section 5.2. The UI never sorts.

**Demo tip:** scores depend on the clock, so the seeded ties drift as time passes. To get fresh
demo data, restart the API container (`docker compose -f docker-compose-app.yml restart api`) or run `npm run db:setup`.

## Project layout

```
api/src/
  endpoints/                       HTTP only (orders, menu items)
  modules/priority.js              pure scoring + ranking (rules at the top of the file)
  modules/orderStatus.js           state machine (transition table)
  modules/orderValidation.js       POST /orders shape validation
  modules/orderModule.js           use cases: queue, status change, create
  modules/menuModule.js            menu listing
  repositories/                    Sequelize queries (orders, menu items)
  schema/                          models, migration, seed, DB config
web/src/
  components/KitchenDisplay.tsx    page: filter, auto-refresh, error message, + button
  components/QueueTable.tsx        the table
  components/NewOrderDialog.tsx    the "New order" form
  api.ts                           fetch wrapper
web/e2e/                           Playwright tests
web/scripts/ensure-postgres.mjs    starts Postgres for e2e if it is not running
request.http                       sample requests (VS Code REST Client)
ai-logs/                           AI conversation exports
```
