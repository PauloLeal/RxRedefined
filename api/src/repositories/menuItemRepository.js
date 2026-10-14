// Data access for menu items (read-only: they come from the seed).

const { MenuItem } = require('../schema/models');

async function findAll() {
  const rows = await MenuItem.findAll({ order: [['name', 'ASC']] });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    category: row.category,
    prep_time_minutes: row.prep_time_minutes,
  }));
}

module.exports = { findAll };
