// HTTP only: lists the menu so the web app can build the "New order" form.

const express = require('express');

function createMenuItemsRouter(menuModule) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    const menuItems = await menuModule.listMenuItems();
    res.json({ menu_items: menuItems });
  });

  return router;
}

module.exports = { createMenuItemsRouter };
