const { createOrderModule } = require('../src/modules/orderModule');
const { createFakeOrderRepository } = require('./fakeOrderRepository');

const NOW = new Date('2026-06-15T12:00:00Z');
const MENU_ITEM_IDS = [1, 2];

function validInput(overrides = {}) {
  return {
    customer_name: 'Marta',
    type: 'takeout',
    is_vip: false,
    promised_at: '2026-06-15T12:30:00Z',
    items: [{ menu_item_id: 1, quantity: 2 }],
    ...overrides,
  };
}

function setup() {
  const repository = createFakeOrderRepository([], MENU_ITEM_IDS);
  return { repository, orders: createOrderModule(repository) };
}

describe('orderModule.createOrder', () => {
  test('creates a received order placed at now', async () => {
    const { repository, orders } = setup();

    const order = await orders.createOrder(validInput(), NOW);

    expect(order).toMatchObject({ id: 1, status: 'received', placed_at: NOW, customer_name: 'Marta' });
    expect(repository.orders).toHaveLength(1);
  });

  test.each([
    ['empty items', { items: [] }, 'items must be a non-empty array'],
    ['missing items', { items: undefined }, 'items must be a non-empty array'],
    ['zero quantity', { items: [{ menu_item_id: 1, quantity: 0 }] }, 'items[0].quantity must be a positive integer'],
    ['decimal quantity', { items: [{ menu_item_id: 1, quantity: 1.5 }] }, 'items[0].quantity must be a positive integer'],
    ['text menu_item_id', { items: [{ menu_item_id: '1', quantity: 1 }] }, 'items[0].menu_item_id must be a positive integer'],
    ['empty customer_name', { customer_name: '  ' }, 'customer_name must be a non-empty string'],
    ['unknown type', { type: 'drive_thru' }, 'type must be one of'],
    ['bad promised_at', { promised_at: 'tomorrow' }, 'promised_at must be an ISO 8601 timestamp'],
  ])('rejects %s with VALIDATION_ERROR', async (_label, overrides, message) => {
    const { repository, orders } = setup();

    const error = await orders.createOrder(validInput(overrides), NOW).catch((e) => e);

    expect(error).toMatchObject({ status: 400, code: 'VALIDATION_ERROR' });
    expect(error.message).toContain(message);
    expect(repository.orders).toHaveLength(0);
  });

  test('rejects a menu_item_id that does not exist', async () => {
    const { repository, orders } = setup();

    const input = validInput({ items: [{ menu_item_id: 1, quantity: 1 }, { menu_item_id: 99, quantity: 1 }] });

    await expect(orders.createOrder(input, NOW)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'menu_item_id does not exist: 99',
    });
    expect(repository.orders).toHaveLength(0);
  });
});
