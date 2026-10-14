// Priority scoring. Pure functions: no database, no clock. The caller passes `now`.
// To change the ranking, edit the rules below (or the tie-break in compareOrders).

const MINUTE_MS = 60 * 1000;

const PRIORITY_RULES = {
  typePoints: { dine_in: 30, takeout: 20, delivery: 10 },
  vipPoints: 20,
  // floor(minutes_waiting / 10) * 5, at most 40
  waitTime: { everyMinutes: 10, points: 5, max: 40 },
  // floor(total_prep_minutes / 15) * 5, at most 20
  complexity: { everyMinutes: 15, points: 5, max: 20 },
  // Checked in order; the first bucket the promise falls into wins. Overdue promises count as "within 30".
  promisedTime: [
    { withinMinutes: 30, points: 25 },
    { withinMinutes: 60, points: 15 },
  ],
};

function toMs(date) {
  return new Date(date).getTime();
}

// Whole minutes since the order was placed, floored (9m50s -> 9).
function minutesWaiting(placedAt, now) {
  const minutes = Math.floor((toMs(now) - toMs(placedAt)) / MINUTE_MS);
  return Math.max(0, minutes);
}

function totalPrepMinutes(items) {
  return items.reduce((sum, item) => sum + item.prep_time_minutes * item.quantity, 0);
}

function steppedPoints(value, { everyMinutes, points, max }) {
  return Math.min(max, Math.floor(value / everyMinutes) * points);
}

function promisedTimePoints(promisedAt, now) {
  if (promisedAt == null) return 0;
  // Exact (not floored) minutes, so 30m30s is "more than 30" and falls into the next bucket.
  const minutesUntilPromise = (toMs(promisedAt) - toMs(now)) / MINUTE_MS;
  const bucket = PRIORITY_RULES.promisedTime.find((b) => minutesUntilPromise <= b.withinMinutes);
  return bucket ? bucket.points : 0;
}

// order: { type, is_vip, placed_at, promised_at, items: [{ prep_time_minutes, quantity }] }
function calculateScore(order, now) {
  return (
    PRIORITY_RULES.typePoints[order.type] +
    (order.is_vip ? PRIORITY_RULES.vipPoints : 0) +
    steppedPoints(minutesWaiting(order.placed_at, now), PRIORITY_RULES.waitTime) +
    promisedTimePoints(order.promised_at, now) +
    steppedPoints(totalPrepMinutes(order.items), PRIORITY_RULES.complexity)
  );
}

// Orders that already carry a `score`. Highest score first, then the tie-break rules.
function compareOrders(a, b) {
  if (a.score !== b.score) return b.score - a.score;

  // 1. Earlier promised_at first, null last
  if (a.promised_at == null && b.promised_at != null) return 1;
  if (a.promised_at != null && b.promised_at == null) return -1;
  if (a.promised_at != null && b.promised_at != null) {
    const diff = toMs(a.promised_at) - toMs(b.promised_at);
    if (diff !== 0) return diff;
  }

  // 2. Earlier placed_at first
  const placedDiff = toMs(a.placed_at) - toMs(b.placed_at);
  if (placedDiff !== 0) return placedDiff;

  // 3. Smaller id first
  return a.id - b.id;
}

// Returns a new array: each order with its `score`, sorted by priority.
function rankOrders(orders, now) {
  return orders
    .map((order) => ({ ...order, score: calculateScore(order, now) }))
    .sort(compareOrders);
}

module.exports = {
  PRIORITY_RULES,
  calculateScore,
  compareOrders,
  rankOrders,
  minutesWaiting,
};
