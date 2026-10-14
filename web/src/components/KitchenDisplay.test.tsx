import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ApiError, fetchQueue, runOrderAction } from '../api';
import type { QueueOrder } from '../types';
import { KitchenDisplay, REFRESH_MS } from './KitchenDisplay';

vi.mock('../api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api')>()),
  fetchQueue: vi.fn(),
  runOrderAction: vi.fn(),
  fetchMenuItems: vi.fn().mockResolvedValue([]),
  createOrder: vi.fn(),
}));

const ORDER: QueueOrder = {
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
};

// Lets pending promises (the mocked API calls) resolve and re-render.
async function flush(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe('KitchenDisplay', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  test('a background refresh shows orders that arrived after the first load', async () => {
    vi.mocked(fetchQueue).mockResolvedValueOnce([]).mockResolvedValue([ORDER]);

    render(<KitchenDisplay />);
    await flush();
    expect(screen.getByText('No orders in the queue')).toBeInTheDocument();

    await flush(REFRESH_MS);

    expect(screen.getByRole('row', { name: /Ana/ })).toBeInTheDocument();
    expect(fetchQueue).toHaveBeenCalledTimes(2);
  });

  test('shows the API error on screen when a transition is rejected', async () => {
    vi.mocked(fetchQueue).mockResolvedValue([ORDER]);
    vi.mocked(runOrderAction).mockRejectedValue(
      new ApiError('INVALID_TRANSITION', 'Cannot change order status from "preparing" to "preparing"'),
    );

    render(<KitchenDisplay />);
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    await flush();

    expect(screen.getByRole('alert')).toHaveTextContent('INVALID_TRANSITION');
  });

  test('the + button opens the New order dialog', async () => {
    vi.mocked(fetchQueue).mockResolvedValue([]);

    render(<KitchenDisplay />);
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'New order' }));
    await flush();

    expect(screen.getByRole('dialog', { name: 'New order' })).toBeInTheDocument();
  });
});
