// Wires the real pieces together: repositories -> modules -> HTTP app.
const { createApp } = require('./app');
const { createOrderModule } = require('./modules/orderModule');
const { createMenuModule } = require('./modules/menuModule');
const orderRepository = require('./repositories/orderRepository');
const menuItemRepository = require('./repositories/menuItemRepository');

const PORT = Number(process.env.PORT || 4000);

const app = createApp({
  orderModule: createOrderModule(orderRepository),
  menuModule: createMenuModule(menuItemRepository),
});

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
