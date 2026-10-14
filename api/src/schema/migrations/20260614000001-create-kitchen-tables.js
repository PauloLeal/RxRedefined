'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('menu_items', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      name: { type: Sequelize.STRING, allowNull: false, unique: true },
      category: { type: Sequelize.STRING, allowNull: false },
      prep_time_minutes: { type: Sequelize.INTEGER, allowNull: false },
    });

    await queryInterface.createTable('orders', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      customer_name: { type: Sequelize.STRING, allowNull: false },
      type: { type: Sequelize.STRING, allowNull: false },
      placed_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      promised_at: { type: Sequelize.DATE, allowNull: true },
      is_vip: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      status: { type: Sequelize.STRING, allowNull: false, defaultValue: 'received' },
    });

    await queryInterface.createTable('order_items', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      order_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'orders', key: 'id' },
        onDelete: 'CASCADE',
      },
      menu_item_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'menu_items', key: 'id' },
      },
      quantity: { type: Sequelize.INTEGER, allowNull: false },
    });

    // Last line of defense: the database rejects values the data model forbids,
    // even if a bug in the app lets them through.
    await queryInterface.sequelize.query(`
      ALTER TABLE menu_items
        ADD CONSTRAINT menu_items_name_not_empty CHECK (name <> ''),
        ADD CONSTRAINT menu_items_category_check CHECK (category IN ('starter', 'main_course', 'dessert', 'drink')),
        ADD CONSTRAINT menu_items_prep_time_positive CHECK (prep_time_minutes > 0);
      ALTER TABLE orders
        ADD CONSTRAINT orders_customer_name_not_empty CHECK (customer_name <> ''),
        ADD CONSTRAINT orders_type_check CHECK (type IN ('dine_in', 'takeout', 'delivery')),
        ADD CONSTRAINT orders_status_check CHECK (status IN ('received', 'preparing', 'ready', 'picked_up', 'cancelled'));
      ALTER TABLE order_items
        ADD CONSTRAINT order_items_quantity_positive CHECK (quantity > 0);
    `);

    await queryInterface.addIndex('orders', ['status']);
    await queryInterface.addIndex('order_items', ['order_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('order_items');
    await queryInterface.dropTable('orders');
    await queryInterface.dropTable('menu_items');
  },
};
