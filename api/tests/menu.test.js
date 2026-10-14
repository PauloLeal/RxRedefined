const { createMenuModule } = require('../src/modules/menuModule');

describe('menuModule.listMenuItems', () => {
  test('returns the menu items from the repository', async () => {
    const items = [{ id: 1, name: 'Caesar Salad', category: 'starter', prep_time_minutes: 10 }];
    const menu = createMenuModule({ findAll: async () => items });

    expect(await menu.listMenuItems()).toEqual(items);
  });
});
