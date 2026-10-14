const { TRANSITIONS, canTransition, assertTransition, allowedActions } = require('../src/modules/orderStatus');
const { createOrderModule } = require('../src/modules/orderModule');
const { createFakeOrderRepository } = require('./fakeOrderRepository');

const NOW = new Date('2026-06-15T12:00:00Z');
const ALL_STATUSES = Object.keys(TRANSITIONS);

function makeOrder(id, status) {
  return {
    id,
    customer_name: `Customer ${id}`,
    type: 'dine_in',
    is_vip: false,
    status,
    placed_at: NOW,
    promised_at: null,
    items: [{ menu_item_id: 1, name: 'Soup', prep_time_minutes: 5, quantity: 1 }],
  };
}

describe('state machine rules', () => {
  const legal = [
    ['received', 'preparing'],
    ['received', 'cancelled'],
    ['preparing', 'ready'],
    ['ready', 'picked_up'],
  ];

  test.each(legal)('%s -> %s is allowed', (from, to) => {
    expect(() => assertTransition(from, to)).not.toThrow();
  });

  // Every other pair of statuses, including repeating the same status, is rejected.
  const illegal = ALL_STATUSES.flatMap((from) => ALL_STATUSES.map((to) => [from, to])).filter(
    ([from, to]) => !legal.some(([f, t]) => f === from && t === to),
  );

  test.each(illegal)('%s -> %s is rejected', (from, to) => {
    expect(canTransition(from, to)).toBe(false);
    expect(() => assertTransition(from, to)).toThrow(expect.objectContaining({ code: 'INVALID_TRANSITION', status: 409 }));
  });

  test('allowed actions follow the rules', () => {
    expect(allowedActions('received')).toEqual(['start', 'cancel']);
    expect(allowedActions('preparing')).toEqual(['ready']);
    expect(allowedActions('ready')).toEqual(['pickup']);
    expect(allowedActions('picked_up')).toEqual([]);
    expect(allowedActions('cancelled')).toEqual([]);
  });
});

describe('orderModule.changeStatus', () => {
  function setup(status) {
    const repository = createFakeOrderRepository([makeOrder(1, status)]);
    return { repository, orders: createOrderModule(repository) };
  }

  test.each([
    ['start', 'received', 'preparing'],
    ['cancel', 'received', 'cancelled'],
    ['ready', 'preparing', 'ready'],
    ['pickup', 'ready', 'picked_up'],
  ])('%s moves %s -> %s', async (action, from, to) => {
    const { repository, orders } = setup(from);

    const result = await orders.changeStatus(1, action);

    expect(result.status).toBe(to);
    expect(repository.orders[0].status).toBe(to);
  });

  test('skipping a step is rejected (received cannot jump to ready)', async () => {
    const { repository, orders } = setup('received');

    await expect(orders.changeStatus(1, 'ready')).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
    expect(repository.orders[0].status).toBe('received');
  });

  test('starting an order that is already preparing is an error, not a silent success', async () => {
    const { repository, orders } = setup('preparing');

    await expect(orders.changeStatus(1, 'start')).rejects.toMatchObject({ code: 'INVALID_TRANSITION', status: 409 });
    expect(repository.orders[0].status).toBe('preparing');
  });

  test.each(['start', 'ready', 'pickup', 'cancel'])('a cancelled order rejects %s', async (action) => {
    const { orders } = setup('cancelled');
    await expect(orders.changeStatus(1, action)).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
  });

  test.each(['start', 'ready', 'pickup', 'cancel'])('a picked-up order rejects %s', async (action) => {
    const { orders } = setup('picked_up');
    await expect(orders.changeStatus(1, action)).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
  });

  test('a preparing order cannot be cancelled', async () => {
    const { orders } = setup('preparing');
    await expect(orders.changeStatus(1, 'cancel')).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
  });

  test('an unknown order id returns ORDER_NOT_FOUND', async () => {
    const { orders } = setup('received');
    await expect(orders.changeStatus(999, 'start')).rejects.toMatchObject({ code: 'ORDER_NOT_FOUND', status: 404 });
    await expect(orders.changeStatus(NaN, 'start')).rejects.toMatchObject({ code: 'ORDER_NOT_FOUND' });
  });

  test('rejects when the status changed between the read and the write', async () => {
    const { repository, orders } = setup('received');
    // Simulate another request winning the race: the conditional update finds nothing to change.
    repository.updateStatus = async () => false;

    await expect(orders.changeStatus(1, 'start')).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
  });
});

describe('orderModule.getQueue', () => {
  const repository = createFakeOrderRepository([
    makeOrder(1, 'received'),
    makeOrder(2, 'preparing'),
    makeOrder(3, 'ready'),
    makeOrder(4, 'picked_up'),
    makeOrder(5, 'cancelled'),
  ]);
  const orders = createOrderModule(repository);

  test('the default queue only has received and preparing orders', async () => {
    const queue = await orders.getQueue({ now: NOW });
    expect(queue.map((o) => o.id).sort()).toEqual([1, 2]);
  });

  test('an order disappears from the default queue once cancelled or picked up', async () => {
    const repo = createFakeOrderRepository([makeOrder(1, 'received'), makeOrder(2, 'ready')]);
    const module = createOrderModule(repo);

    await module.changeStatus(1, 'cancel');
    await module.changeStatus(2, 'pickup');

    expect(await module.getQueue({ now: NOW })).toEqual([]);
  });

  test('filters by status', async () => {
    const queue = await orders.getQueue({ status: 'preparing', now: NOW });
    expect(queue.map((o) => o.id)).toEqual([2]);
  });

  test('each order carries its score and allowed actions', async () => {
    const [first] = await orders.getQueue({ status: 'received', now: NOW });
    expect(first.score).toBe(30);
    expect(first.minutes_waiting).toBe(0);
    expect(first.allowed_actions).toEqual(['start', 'cancel']);
  });

  test.each(['ready', 'cancelled', 'bogus'])('rejects status filter "%s"', async (status) => {
    await expect(orders.getQueue({ status, now: NOW })).rejects.toMatchObject({ code: 'INVALID_STATUS_FILTER', status: 400 });
  });
});
