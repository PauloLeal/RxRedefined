const { calculateScore, rankOrders } = require('../src/modules/priority');

// Frozen clock: every test uses this `now`, never Date.now().
const NOW = new Date('2026-06-15T12:00:00Z');
const minutesAgo = (minutes) => new Date(NOW.getTime() - minutes * 60 * 1000);
const minutesFromNow = (minutes) => new Date(NOW.getTime() + minutes * 60 * 1000);

// A baseline order worth exactly 30 points (dine_in, nothing else), so each test
// changes one input and checks one component.
function makeOrder(overrides = {}) {
  return {
    id: 1,
    type: 'dine_in',
    is_vip: false,
    placed_at: NOW,
    promised_at: null,
    items: [{ prep_time_minutes: 5, quantity: 1 }],
    ...overrides,
  };
}

describe('calculateScore: spec worked examples', () => {
  const exampleA = makeOrder({
    id: 1,
    placed_at: new Date('2026-06-15T11:25:00Z'),
    items: [
      { prep_time_minutes: 20, quantity: 2 }, // Grilled Salmon
      { prep_time_minutes: 10, quantity: 1 }, // Caesar Salad
    ],
  });
  const exampleB = makeOrder({
    id: 2,
    type: 'delivery',
    is_vip: true,
    placed_at: new Date('2026-06-15T11:50:00Z'),
    promised_at: new Date('2026-06-15T12:20:00Z'),
    items: [{ prep_time_minutes: 12, quantity: 1 }], // Margherita Pizza
  });

  test('example A scores 60', () => {
    expect(calculateScore(exampleA, NOW)).toBe(60);
  });

  test('example B scores 60', () => {
    expect(calculateScore(exampleB, NOW)).toBe(60);
  });

  test('B ranks above A on the promised_at tie-break', () => {
    const ranked = rankOrders([exampleA, exampleB], NOW);
    expect(ranked.map((o) => o.id)).toEqual([2, 1]);
    expect(ranked.map((o) => o.score)).toEqual([60, 60]);
  });
});

describe('calculateScore: order type and VIP', () => {
  test.each([
    ['dine_in', 30],
    ['takeout', 20],
    ['delivery', 10],
  ])('%s base is %i points', (type, points) => {
    expect(calculateScore(makeOrder({ type }), NOW)).toBe(points);
  });

  test('VIP adds 20 points', () => {
    expect(calculateScore(makeOrder({ is_vip: true }), NOW)).toBe(50);
  });
});

describe('calculateScore: wait time', () => {
  test('uses whole minutes: 9m50s is 9 minutes, so 0 points', () => {
    const placedAt = new Date(NOW.getTime() - (9 * 60 + 50) * 1000);
    expect(calculateScore(makeOrder({ placed_at: placedAt }), NOW)).toBe(30);
  });

  test('10 minutes gives 5 points', () => {
    expect(calculateScore(makeOrder({ placed_at: minutesAgo(10) }), NOW)).toBe(35);
  });

  test('reaches the 40 point cap at 80 minutes', () => {
    expect(calculateScore(makeOrder({ placed_at: minutesAgo(80) }), NOW)).toBe(70);
  });

  test('is capped at 40 points for very old orders', () => {
    expect(calculateScore(makeOrder({ placed_at: minutesAgo(600) }), NOW)).toBe(70);
  });
});

describe('calculateScore: complexity', () => {
  test('14 prep minutes gives 0 points', () => {
    const items = [{ prep_time_minutes: 7, quantity: 2 }];
    expect(calculateScore(makeOrder({ items }), NOW)).toBe(30);
  });

  test('uses prep_time * quantity: 3 x 5 = 15 minutes gives 5 points', () => {
    const items = [{ prep_time_minutes: 5, quantity: 3 }];
    expect(calculateScore(makeOrder({ items }), NOW)).toBe(35);
  });

  test('is capped at 20 points', () => {
    const items = [{ prep_time_minutes: 45, quantity: 4 }]; // 180 min -> 60 raw points
    expect(calculateScore(makeOrder({ items }), NOW)).toBe(50);
  });
});

describe('calculateScore: promised time buckets', () => {
  test.each([
    ['null', null, 0],
    ['in 10 minutes', minutesFromNow(10), 25],
    ['exactly 30 minutes away', minutesFromNow(30), 25],
    ['30m30s away (just past the 30 minute bucket)', minutesFromNow(30.5), 15],
    ['in 45 minutes', minutesFromNow(45), 15],
    ['exactly 60 minutes away', minutesFromNow(60), 15],
    ['in 61 minutes', minutesFromNow(61), 0],
    ['in 3 hours', minutesFromNow(180), 0],
    ['already overdue', minutesAgo(5), 25],
  ])('%s gives %i points', (_label, promisedAt, points) => {
    expect(calculateScore(makeOrder({ promised_at: promisedAt }), NOW)).toBe(30 + points);
  });
});

describe('rankOrders', () => {
  test('a delivery VIP with a tight promise beats a dine_in non-VIP', () => {
    const dineIn = makeOrder({ id: 1, type: 'dine_in' }); // 30
    const deliveryVip = makeOrder({
      id: 2,
      type: 'delivery',
      is_vip: true,
      promised_at: minutesFromNow(15),
    }); // 10 + 20 + 25 = 55

    const ranked = rankOrders([dineIn, deliveryVip], NOW);

    expect(ranked.map((o) => o.id)).toEqual([2, 1]);
  });

  test('sorts by score, highest first', () => {
    const low = makeOrder({ id: 1, type: 'delivery' });
    const high = makeOrder({ id: 2, type: 'dine_in', is_vip: true });
    const mid = makeOrder({ id: 3, type: 'takeout' });

    expect(rankOrders([low, high, mid], NOW).map((o) => o.score)).toEqual([50, 20, 10]);
  });

  describe('tie-break on equal scores', () => {
    // All three promises are beyond 60 minutes, so they add 0 points and scores stay equal.
    test('earlier promised_at first, null last', () => {
      const noPromise = makeOrder({ id: 1, promised_at: null });
      const later = makeOrder({ id: 2, promised_at: minutesFromNow(120) });
      const earlier = makeOrder({ id: 3, promised_at: minutesFromNow(90) });

      expect(rankOrders([noPromise, later, earlier], NOW).map((o) => o.id)).toEqual([3, 2, 1]);
    });

    test('then earlier placed_at first', () => {
      // 1 and 2 minutes ago both give 0 wait points
      const newer = makeOrder({ id: 1, placed_at: minutesAgo(1) });
      const older = makeOrder({ id: 2, placed_at: minutesAgo(2) });

      expect(rankOrders([newer, older], NOW).map((o) => o.id)).toEqual([2, 1]);
    });

    test('then smaller id first', () => {
      const orders = [makeOrder({ id: 9 }), makeOrder({ id: 4 }), makeOrder({ id: 7 })];

      expect(rankOrders(orders, NOW).map((o) => o.id)).toEqual([4, 7, 9]);
    });
  });

  test('does not mutate the input array', () => {
    const orders = [makeOrder({ id: 2 }), makeOrder({ id: 1 })];
    rankOrders(orders, NOW);
    expect(orders.map((o) => o.id)).toEqual([2, 1]);
    expect(orders[0].score).toBeUndefined();
  });
});
