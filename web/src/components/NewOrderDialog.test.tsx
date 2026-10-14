import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ApiError, createOrder, fetchMenuItems } from '../api';
import type { QueueOrder } from '../types';
import { NewOrderDialog } from './NewOrderDialog';

vi.mock('../api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api')>()),
  fetchMenuItems: vi.fn(),
  createOrder: vi.fn(),
}));

const MENU = [
  { id: 1, name: 'Caesar Salad', category: 'starter', prep_time_minutes: 10 },
  { id: 3, name: 'Grilled Salmon', category: 'main_course', prep_time_minutes: 20 },
];

async function renderDialog() {
  const onCreated = vi.fn();
  render(<NewOrderDialog open onClose={vi.fn()} onCreated={onCreated} />);
  await screen.findByRole('option', { name: 'Grilled Salmon' }); // menu loaded
  return { onCreated };
}

describe('NewOrderDialog', () => {
  beforeEach(() => {
    vi.mocked(fetchMenuItems).mockResolvedValue(MENU);
  });
  afterEach(() => {
    vi.resetAllMocks();
  });

  test('sends the form as a POST /orders payload and reports the created order', async () => {
    const created = { id: 11, customer_name: 'Marta' } as QueueOrder;
    vi.mocked(createOrder).mockResolvedValue(created);
    const { onCreated } = await renderDialog();

    fireEvent.change(screen.getByLabelText('Customer name'), { target: { value: 'Marta' } });
    fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'delivery' } });
    fireEvent.click(screen.getByLabelText('VIP'));
    fireEvent.change(screen.getByLabelText('Menu item'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create order' }));

    expect(await screen.findByRole('button', { name: 'Create order' })).toBeEnabled();
    expect(createOrder).toHaveBeenCalledWith({
      customer_name: 'Marta',
      type: 'delivery',
      is_vip: true,
      promised_at: null,
      items: [{ menu_item_id: 3, quantity: 2 }],
    });
    expect(onCreated).toHaveBeenCalledWith(created);
  });

  test('shows the API validation error inside the dialog', async () => {
    vi.mocked(createOrder).mockRejectedValue(
      new ApiError('VALIDATION_ERROR', 'customer_name must be a non-empty string'),
    );
    const { onCreated } = await renderDialog();

    fireEvent.click(screen.getByRole('button', { name: 'Create order' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'VALIDATION_ERROR: customer_name must be a non-empty string',
    );
    expect(onCreated).not.toHaveBeenCalled();
  });

  test('can add and remove item rows', async () => {
    await renderDialog();

    fireEvent.click(screen.getByRole('button', { name: 'Add item' }));
    expect(screen.getAllByLabelText('Menu item')).toHaveLength(2);

    fireEvent.click(screen.getAllByRole('button', { name: 'Remove' })[0]);
    expect(screen.getAllByLabelText('Menu item')).toHaveLength(1);
  });
});
