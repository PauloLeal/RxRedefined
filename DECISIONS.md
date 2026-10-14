# Decisions

## 1. Scope

**Time spent:** about 1h10 of the 4-hour box, from 09:27 to about 10:40 BRT on 2026-10-14. That
covers everything, extras included. The timestamps are in `ai-logs/`.

I built everything the brief requires: the data model with migrations and a relative-date seed,
the priority queue, the state machine, the five endpoints, the Kitchen Display page, and the
required Jest tests. I also did all three extras: `POST /orders` with validation and tests, a
Vitest component test (empty state, and Cancel only on received orders), and a Playwright happy path.

Beyond the extras, I added two things that are not in the brief:

- **A "New order" UI.** The brief says no UI form is needed for `POST /orders`, but without one
  the feature can only be used with curl, which felt incomplete. A floating + button opens a
  dialog. It needed one small read-only endpoint, `GET /menu-items`, to fill the item picker.
- **Background auto-refresh every 5 seconds.** New orders created elsewhere appear without a page
  reload, and scores stay current as wait times grow.

I kept the code deliberately simple. There is no DI container, no class hierarchy and no
generic repository. The module takes its repository as a function argument, and that is the only
seam the tests need.

On top of the brief, I added a second compose file, `docker-compose-app.yml`. It runs the API and
web app in `node:22` containers, so the app runs with only Docker installed. `docker-compose.yml`
is exactly the Postgres-only file from section 9.3, and the four-command host flow still works.
Playwright runs on the host and reuses the apps if they are already running in Docker.

I also added a `request.http` file with a sample for every endpoint and error code, for manual
testing from VS Code.

What I cut: there are no API integration tests against a real Postgres, and Playwright does not
run inside Docker. Jest and Vitest run in either place, but the e2e tests run on the host only. A
browser image is large (about 2 GB), and the Docker setup exists to run the app, not to be a full
CI environment. I checked the HTTP layer and the SQL by running the
app and calling it with curl, and the Playwright test covers the full path once.

## 2. Layers

- **Endpoint** (`endpoints/`) reads `req`, calls the module and writes JSON. It contains no `if` about business rules.
- **Module** (`modules/`) holds every rule. `priority.js` has the scoring and the tie-break as pure
  functions. `orderStatus.js` has the transition table. `orderModule.js` holds the use cases
  (queue, status change, create) and turns a broken rule into an `AppError` with a stable code.
- **Repository** (`repositories/`) holds all Sequelize code. It returns plain objects, so
  the modules never see a Sequelize instance, and tests swap in an in-memory fake with the same functions.
- **Schema** holds the models, the migration and the seed. The migration also adds CHECK
  constraints, so the database rejects an invalid status, type or quantity even if a bug gets past the app.
- **UI** renders what the API returns, in the order it returns it.

The rule I refused to put in the UI: **which actions are valid for an order.** The obvious
approach is a `status → button` map in React, but that is a second copy of the state machine.
When the product team changes a transition, someone would update the server and forget the UI.
Instead the API returns `allowed_actions` for each order, computed from the same `TRANSITIONS`
table the server enforces. The UI only knows button labels. The score works the same way: the UI
has no scoring code at all, it only displays `score`.

The "New order" form follows the same idea. It does not validate. It sends what was typed, and
`POST /orders` either creates the order or returns `VALIDATION_ERROR`, which the dialog shows.
There is one set of validation rules, on the server, and the form cannot disagree with it. The
only calculation in the form is turning "promised in N minutes" into a timestamp, which is input
convenience, not a business rule.

The auto-refresh polls every 5 seconds without showing a progress bar, and pauses while the tab
is hidden. Every request gets a number, and only the newest one may update the table. Without
that, a slow response for the old filter could arrive after a filter change and overwrite the
new results.

## 3. Priority

`GET /orders/queue` loads the orders in the requested statuses together with their items and the
items' prep times. The module then calls `rankOrders(orders, now)` with `now = new Date()`, taken
once per request in the endpoint. `rankOrders` adds a `score` to each order with
`calculateScore(order, now)` and sorts with `compareOrders`: score descending, then `promised_at`
(earlier first, nulls last), then `placed_at`, then `id`. Nothing is stored, so the score is
always current. Tests pass a frozen `now` (`2026-06-15T12:00:00Z`) and never touch the clock.

All the weights live in one `PRIORITY_RULES` object at the top of `priority.js`, so changing the
ranking usually means editing one value.

Edge cases that were easy to get wrong:

- **Whole minutes.** Wait time uses floored whole minutes, so 9m50s counts as 9 minutes and
  scores 0 points, not 5. Rounding the minutes, or flooring only once at the end of the formula,
  gives the wrong answer. There is a test for exactly this case.
- **The gap between "within 30" and "31–60".** A promise 30m30s away fits neither bucket if you
  read the brief literally. I compare exact (unfloored) minutes: up to 30 gives 25 points, up to
  60 gives 15, so 30m30s gives 15.
- **Overdue promises.** A `promised_at` in the past counts as "within 30 minutes" and gives 25
  points. A late order should not lose priority for being late.
- **`promised_at` on dine-in orders.** The brief says the promise is "relevant for delivery and
  takeout". I read that as "usually set for", not "forbidden for", so the API accepts a promise on
  any order type and scores it the same way. A dine-in table promised "mains in 20 minutes" is a
  real promise too, and rejecting it would mean an extra rule with no clear product reason. If the
  product decides otherwise, the change is one check in `orderValidation.js`.

## 4. Transitions

The state machine is the `TRANSITIONS` table in `api/src/modules/orderStatus.js`. The server
enforces it in `orderModule.changeStatus`, which every transition endpoint goes through:

1. Load the order. If it does not exist, return `ORDER_NOT_FOUND` (404).
2. Call `assertTransition(current, target)`. An illegal change returns `INVALID_TRANSITION` (409).
3. Write with a **conditional update** (`UPDATE ... WHERE id = ? AND status = <the status we checked>`).
   If no row changed, another request moved the order between our read and our write, so we
   return `INVALID_TRANSITION` instead of overwriting it.

Starting an order that is already `preparing` returns
`409 {"error":{"code":"INVALID_TRANSITION","message":"Cannot change order status from \"preparing\" to \"preparing\""}}`
and nothing in the database changes. The UI shows that message in a red alert above the table
and reloads the queue, because the screen was evidently stale.

## 5. AI

I used Claude Code for this exercise. The full conversation is in `ai-logs/`.

**Kept:** "make the status update conditional: `WHERE id = ? AND status = <expected from>`. If
0 rows update, return INVALID_TRANSITION." A plain read → check → update has a gap: two
expeditors clicking Start at the same moment would both pass the check. The
conditional update closes the gap with one extra `where` field and no locks or transactions.
`transitions.test.js` covers it by simulating a lost race.

**Rejected:** for my requirement that the only command should be `docker compose up`, the AI
proposed a `docker-compose.override.yml`, which Docker merges automatically. That would make
`docker compose up -d` (step 1 of the brief) quietly start the API and web app too. That breaks
section 9.3, and the reviewer's `npm run dev` would then fail on ports already in use. I chose an
explicit `docker-compose-app.yml` instead: the brief's flow stays exactly as written, and the
Docker-only flow is one extra, visible `-f` flag.

**Also rewritten:** the AI first suggested skipping Playwright because running browsers inside
Docker is heavy. I kept the test and moved it to the host instead. `reuseExistingServer` lets it
work against either the Docker-hosted apps or apps it starts itself.

**Pushed back by the AI, and I agreed:** at one point I asked to order the table by Waiting,
Promised and VIP. The AI flagged that section 8 requires the sort order to come from the API, and
that the UI must show rows in that order, so sorting in React would break that rule. After
re-reading section 5, I kept the ranking as specified. Waiting and Promised already take part as
the 5.2 tie-breaks after the score, and VIP counts through its +20 points. To be sure the ranking
was correct, I had the AI write an independent script that recomputes every score from the raw
fields and checks the live API order. It matched in all three views.

## 6. Next

1. **Status history with timestamps and the person who made each change.** Add an
   `order_status_events` table written in the same transaction as the status change. A real
   kitchen needs to answer "why was this order late?" and "who cancelled it?". It also unlocks
   ranking by time spent in `preparing`, a likely next product request.
2. **Push updates to every screen.** Several screens (expeditor, line cooks, pass) must agree
   instantly. Today each screen polls every 5 seconds: that costs one query per screen every 5
   seconds even when nothing changed, and a screen can still be up to 5 seconds stale. I would
   push changes to the screens (Server-Sent Events) and keep the conditional update as the
   safety net.
