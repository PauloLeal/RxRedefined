// HTTP only: read the request, call the order module, write the response.
// Express 5 forwards errors thrown in async handlers to the error middleware.

const express = require('express');

function createOrdersRouter(orderModule) {
  const router = express.Router();

  router.get('/queue', async (req, res) => {
    const orders = await orderModule.getQueue({ status: req.query.status, now: new Date() });
    res.json({ orders });
  });

  router.post('/', async (req, res) => {
    const order = await orderModule.createOrder(req.body, new Date());
    res.status(201).json({ order });
  });

  const changeStatus = (action) => async (req, res) => {
    const order = await orderModule.changeStatus(Number(req.params.id), action);
    res.json({ order });
  };

  router.post('/:id/start', changeStatus('start'));
  router.post('/:id/ready', changeStatus('ready'));
  router.post('/:id/pickup', changeStatus('pickup'));
  router.post('/:id/cancel', changeStatus('cancel'));

  return router;
}

module.exports = { createOrdersRouter };
