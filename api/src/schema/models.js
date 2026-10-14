const { Sequelize, DataTypes } = require('sequelize');
const config = require('./config').development;

const sequelize = new Sequelize(config.database, config.username, config.password, config);

// The tables are created by migrations; these models only describe them.
const tableOptions = { underscored: true, timestamps: false };

const MenuItem = sequelize.define(
  'MenuItem',
  {
    name: { type: DataTypes.STRING, allowNull: false, unique: true },
    category: { type: DataTypes.STRING, allowNull: false },
    prep_time_minutes: { type: DataTypes.INTEGER, allowNull: false },
  },
  { ...tableOptions, tableName: 'menu_items' },
);

const Order = sequelize.define(
  'Order',
  {
    customer_name: { type: DataTypes.STRING, allowNull: false },
    type: { type: DataTypes.STRING, allowNull: false },
    placed_at: { type: DataTypes.DATE, allowNull: false },
    promised_at: { type: DataTypes.DATE, allowNull: true },
    is_vip: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'received' },
  },
  { ...tableOptions, tableName: 'orders' },
);

const OrderItem = sequelize.define(
  'OrderItem',
  {
    order_id: { type: DataTypes.INTEGER, allowNull: false },
    menu_item_id: { type: DataTypes.INTEGER, allowNull: false },
    quantity: { type: DataTypes.INTEGER, allowNull: false },
  },
  { ...tableOptions, tableName: 'order_items' },
);

Order.hasMany(OrderItem, { as: 'items', foreignKey: 'order_id' });
OrderItem.belongsTo(MenuItem, { as: 'menuItem', foreignKey: 'menu_item_id' });

module.exports = { sequelize, MenuItem, Order, OrderItem };
