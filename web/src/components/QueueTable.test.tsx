import { render, screen, within } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import type { QueueOrder } from '../types';
import { QueueTable } from './QueueTable';

function makeOrder(overrides: Partial<QueueOrder>): QueueOrder {
  return {
    id: 1,
    customer_name: 'Ana',
    type: 'dine_in',
    is_vip: false,
    status: 'received',
    placed_at: '2026-06-15T11:25:00Z',
    promised_at: null,
    items: [{ menu_item_id: 1, name: 'Grilled Salmon', quantity: 2 }],
    score: 60,
    minutes_waiting: 35,
    allowed_actions: ['start', 'cancel'],
    ...overrides,
  };
}

describe('QueueTable', () => {
  test('shows an empty state when there are no orders', () => {
    render(<QueueTable orders={[]} busyOrderId={null} onAction={vi.fn()} />);

    expect(screen.getByText('No orders in the queue')).toBeInTheDocument();
  });

  test('shows the cancel button only for received orders', () => {
    const orders = [
      makeOrder({ id: 1, customer_name: 'Ana', status: 'received', allowed_actions: ['start', 'cancel'] }),
      makeOrder({ id: 2, customer_name: 'Bruno', status: 'preparing', allowed_actions: ['ready'] }),
    ];

    render(<QueueTable orders={orders} busyOrderId={null} onAction={vi.fn()} />);

    const receivedRow = screen.getByRole('row', { name: /Ana/ });
    const preparingRow = screen.getByRole('row', { name: /Bruno/ });
    expect(within(receivedRow).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(within(preparingRow).queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    expect(within(preparingRow).getByRole('button', { name: 'Mark ready' })).toBeInTheDocument();
  });

  test('renders orders in the order the API returned them', () => {
    const orders = [
      makeOrder({ id: 1, customer_name: 'Low', score: 10 }),
      makeOrder({ id: 2, customer_name: 'High', score: 90 }),
    ];

    render(<QueueTable orders={orders} busyOrderId={null} onAction={vi.fn()} />);

    const rows = screen.getAllByRole('row').slice(1); // skip the header row
    expect(rows.map((row) => within(row).getAllByRole('cell')[1].textContent)).toEqual(['Low', 'High']);
  });
});
