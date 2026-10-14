// Menu use cases. Only a listing today (for the "New order" form); kept as a module
// so the endpoint never talks to a repository directly.

function createMenuModule(menuItemRepository) {
  async function listMenuItems() {
    return menuItemRepository.findAll();
  }

  return { listMenuItems };
}

module.exports = { createMenuModule };
