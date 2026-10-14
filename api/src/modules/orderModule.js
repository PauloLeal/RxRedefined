// Order use cases: the queue, status changes and order creation.
// The repository is passed in, so tests can use an in-memory fake instead of Postgres.

const { AppError } = require('../errors');
const { rankOrders, minutesWaiting } = require('./priority');
const { ACTIONS, ACTIVE_STATUSES, assertTransition, allowedActions } = require('./orderStatus');
const { validateNewOrder } = require('./orderValidation');

function orderNotFound(id) {
  return new AppError(404, 'ORDER_NOT_FOUND', `Order ${id} not found`);
}

function createOrderModule(repository) {
  // status: undefined for the default active queue, or one of ACTIVE_STATUSES to filter
  async function getQueue({ status, now }) {
    if (status !== undefined && !ACTIVE_STATUSES.includes(status)) {
      throw new AppError(400, 'INVALID_STATUS_FILTER', `status must be one of: ${ACTIVE_STATUSES.join(', ')}`);
    }
    const statuses = status === undefined ? ACTIVE_STATUSES : [status];

    const orders = await repository.findByStatuses(statuses);

    return rankOrders(orders, now).map((order) => ({
      ...order,
      minutes_waiting: minutesWaiting(order.placed_at, now),
      allowed_actions: allowedActions(order.status),
    }));
  }

  // action: one of the keys of ACTIONS (start, ready, pickup, cancel)
  async function changeStatus(id, action) {
    const nextStatus = ACTIONS[action];
    if (!nextStatus) {
      throw new AppError(400, 'UNKNOWN_ACTION', `Unknown action "${action}"`);
    }
    if (!Number.isInteger(id) || id <= 0) {
      throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found: id must be a positive integer');
    }

    const order = await repository.findById(id);
    if (!order) {
      throw orderNotFound(id);
    }

    assertTransition(order.status, nextStatus);

    // The update only succeeds if the status is still the one we checked.
    // If someone else changed it in between, we reject instead of overwriting.
    const updated = await repository.updateStatus(id, order.status, nextStatus);
    if (!updated) {
      throw new AppError(409, 'INVALID_TRANSITION', `Order ${id} was changed by someone else, reload and try again`);
    }

    return { ...order, status: nextStatus, allowed_actions: allowedActions(nextStatus) };
  }

  async function createOrder(input, now) {
    const errors = validateNewOrder(input);
    if (errors.length > 0) {
      throw new AppError(400, 'VALIDATION_ERROR', errors.join('; '));
    }

    const menuItemIds = [...new Set(input.items.map((item) => item.menu_item_id))];
    const existingIds = await repository.findExistingMenuItemIds(menuItemIds);
    const missingIds = menuItemIds.filter((id) => !existingIds.includes(id));
    if (missingIds.length > 0) {
      throw new AppError(400, 'VALIDATION_ERROR', `menu_item_id does not exist: ${missingIds.join(', ')}`);
    }

    const id = await repository.create(
      {
        customer_name: input.customer_name.trim(),
        type: input.type,
        is_vip: input.is_vip ?? false,
        promised_at: input.promised_at ? new Date(input.promised_at) : null,
        placed_at: now,
        status: 'received',
      },
      input.items.map(({ menu_item_id, quantity }) => ({ menu_item_id, quantity })),
    );

    return repository.findById(id);
  }

  return { getQueue, changeStatus, createOrder };
}

module.exports = { createOrderModule };
