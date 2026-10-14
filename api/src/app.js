const express = require('express');
const { createOrdersRouter } = require('./endpoints/ordersEndpoint');
const { createMenuItemsRouter } = require('./endpoints/menuItemsEndpoint');
const { errorHandler } = require('./errors');

function createApp({ orderModule, menuModule }) {
  const app = express();
  app.use(express.json());

  app.use('/orders', createOrdersRouter(orderModule));
  app.use('/menu-items', createMenuItemsRouter(menuModule));

  app.use((req, res) => {
    res.status(404).json({ error: { code: 'ROUTE_NOT_FOUND', message: `${req.method} ${req.path} does not exist` } });
  });
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
