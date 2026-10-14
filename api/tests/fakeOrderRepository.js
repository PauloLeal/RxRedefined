// In-memory stand-in for src/repositories/orderRepository.js, with the same functions.
// Lets module tests run without Postgres and without mocking Sequelize.
function createFakeOrderRepository(initialOrders = [], menuItemIds = []) {
  const orders = initialOrders.map((order) => ({ ...order }));

  return {
    orders,

    async findByStatuses(statuses) {
      return orders.filter((order) => statuses.includes(order.status)).map((order) => ({ ...order }));
    },

    async findById(id) {
      const order = orders.find((o) => o.id === id);
      return order ? { ...order } : null;
    },

    async updateStatus(id, fromStatus, toStatus) {
      const order = orders.find((o) => o.id === id && o.status === fromStatus);
      if (!order) return false;
      order.status = toStatus;
      return true;
    },

    async findExistingMenuItemIds(ids) {
      return ids.filter((id) => menuItemIds.includes(id));
    },

    async create(order, items) {
      const id = orders.length + 1;
      orders.push({ id, ...order, items });
      return id;
    },
  };
}

module.exports = { createFakeOrderRepository };
