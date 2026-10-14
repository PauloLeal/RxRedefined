// Data access for orders. All Sequelize code lives here; it returns plain objects
// so the modules never depend on Sequelize.

const { sequelize, MenuItem, Order, OrderItem } = require('../schema/models');

const ORDER_INCLUDE = [
  { model: OrderItem, as: 'items', include: [{ model: MenuItem, as: 'menuItem' }] },
];

function toPlainOrder(row) {
  return {
    id: row.id,
    customer_name: row.customer_name,
    type: row.type,
    is_vip: row.is_vip,
    status: row.status,
    placed_at: row.placed_at,
    promised_at: row.promised_at,
    items: row.items.map((item) => ({
      menu_item_id: item.menu_item_id,
      name: item.menuItem.name,
      quantity: item.quantity,
      prep_time_minutes: item.menuItem.prep_time_minutes,
    })),
  };
}

async function findByStatuses(statuses) {
  const rows = await Order.findAll({ where: { status: statuses }, include: ORDER_INCLUDE });
  return rows.map(toPlainOrder);
}

async function findById(id) {
  const row = await Order.findByPk(id, { include: ORDER_INCLUDE });
  return row ? toPlainOrder(row) : null;
}

// Conditional update: only changes the row if it still has `fromStatus`.
// Returns false when another request changed the status first.
async function updateStatus(id, fromStatus, toStatus) {
  const [updatedCount] = await Order.update({ status: toStatus }, { where: { id, status: fromStatus } });
  return updatedCount === 1;
}

async function findExistingMenuItemIds(ids) {
  const rows = await MenuItem.findAll({ where: { id: ids }, attributes: ['id'] });
  return rows.map((row) => row.id);
}

// Creates the order and its items in one transaction. Returns the new order id.
async function create(order, items) {
  return sequelize.transaction(async (transaction) => {
    const created = await Order.create(order, { transaction });
    await OrderItem.bulkCreate(
      items.map((item) => ({ ...item, order_id: created.id })),
      { transaction },
    );
    return created.id;
  });
}

module.exports = { findByStatuses, findById, updateStatus, findExistingMenuItemIds, create };
