'use strict';

// Demo data. Every date is relative to the moment the seed runs, so the demo never goes stale.
// Running it again wipes the tables and starts fresh (sequelize-cli does not record seeds).
// Scores in the comments are as of seed time; they drift as the clock moves.

const MINUTE = 60 * 1000;

const MENU_ITEMS = [
  { name: 'Caesar Salad', category: 'starter', prep_time_minutes: 10 },
  { name: 'Tomato Soup', category: 'starter', prep_time_minutes: 8 },
  { name: 'Grilled Salmon', category: 'main_course', prep_time_minutes: 20 },
  { name: 'Margherita Pizza', category: 'main_course', prep_time_minutes: 12 },
  { name: 'Beef Burger', category: 'main_course', prep_time_minutes: 15 },
  { name: 'Slow-Roasted Lamb', category: 'main_course', prep_time_minutes: 45 },
  { name: 'Chocolate Cake', category: 'dessert', prep_time_minutes: 5 },
  { name: 'Lemonade', category: 'drink', prep_time_minutes: 2 },
];

function buildOrders(now) {
  const minutesAgo = (minutes) => new Date(now - minutes * MINUTE);
  const minutesFromNow = (minutes) => new Date(now + minutes * MINUTE);

  return [
    // Wait-time cap: 120 min waiting = 60 raw points, capped at 40. Score 30 + 40 = 70.
    {
      customer_name: 'Elena', type: 'dine_in', is_vip: false, status: 'received',
      placed_at: minutesAgo(120), promised_at: null,
      items: [['Tomato Soup', 1]],
    },
    // Complexity cap: 2x45 + 5 = 95 prep min = 30 raw points, capped at 20. VIP.
    // Score 30 + 20 + 5 (12 min wait) + 20 = 75.
    {
      customer_name: 'Felipe', type: 'dine_in', is_vip: true, status: 'preparing',
      placed_at: minutesAgo(12), promised_at: null,
      items: [['Slow-Roasted Lamb', 2], ['Chocolate Cake', 1]],
    },
    // Spec example A. Score 60.
    {
      customer_name: 'Ana', type: 'dine_in', is_vip: false, status: 'received',
      placed_at: minutesAgo(35), promised_at: null,
      items: [['Grilled Salmon', 2], ['Caesar Salad', 1]],
    },
    // Spec example B: delivery VIP with a tight promise ties dine_in Ana at 60 and ranks above her.
    {
      customer_name: 'Bruno', type: 'delivery', is_vip: true, status: 'received',
      placed_at: minutesAgo(10), promised_at: minutesFromNow(20),
      items: [['Margherita Pizza', 1]],
    },
    // Tie on score broken by promised_at: Carla and Diego both score 50
    // (20 type + 10 wait + 15 promise + 5 complexity); Diego is promised earlier, so he ranks first.
    {
      customer_name: 'Carla', type: 'takeout', is_vip: false, status: 'received',
      placed_at: minutesAgo(25), promised_at: minutesFromNow(50),
      items: [['Beef Burger', 1], ['Lemonade', 1]],
    },
    {
      customer_name: 'Diego', type: 'takeout', is_vip: false, status: 'received',
      placed_at: minutesAgo(25), promised_at: minutesFromNow(40),
      items: [['Beef Burger', 1], ['Lemonade', 1]],
    },
    // Promise far away (0 points). Score 10 + 5 = 15.
    {
      customer_name: 'Gabriel', type: 'delivery', is_vip: false, status: 'preparing',
      placed_at: minutesAgo(15), promised_at: minutesFromNow(90),
      items: [['Margherita Pizza', 1], ['Lemonade', 1]],
    },
    // Not in the active queue: ready, picked_up, cancelled.
    {
      customer_name: 'Hugo', type: 'takeout', is_vip: true, status: 'ready',
      placed_at: minutesAgo(30), promised_at: minutesFromNow(5),
      items: [['Beef Burger', 2]],
    },
    {
      customer_name: 'Iris', type: 'dine_in', is_vip: false, status: 'picked_up',
      placed_at: minutesAgo(90), promised_at: null,
      items: [['Caesar Salad', 1], ['Chocolate Cake', 1]],
    },
    {
      customer_name: 'Joao', type: 'takeout', is_vip: false, status: 'cancelled',
      placed_at: minutesAgo(45), promised_at: minutesFromNow(15),
      items: [['Margherita Pizza', 2]],
    },
  ];
}

module.exports = {
  async up(queryInterface) {
    const now = Date.now();
    await queryInterface.sequelize.query('TRUNCATE order_items, orders, menu_items RESTART IDENTITY CASCADE');

    const menuItems = await queryInterface.bulkInsert('menu_items', MENU_ITEMS, { returning: true });
    const menuItemIdByName = Object.fromEntries(menuItems.map((item) => [item.name, item.id]));

    for (const { items, ...order } of buildOrders(now)) {
      const [created] = await queryInterface.bulkInsert('orders', [order], { returning: true });
      await queryInterface.bulkInsert(
        'order_items',
        items.map(([name, quantity]) => ({
          order_id: created.id,
          menu_item_id: menuItemIdByName[name],
          quantity,
        })),
      );
    }
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('TRUNCATE order_items, orders, menu_items RESTART IDENTITY CASCADE');
  },
};
