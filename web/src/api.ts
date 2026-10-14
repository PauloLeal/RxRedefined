import type { MenuItemOption, NewOrderInput, OrderAction, QueueFilter, QueueOrder } from './types';

export class ApiError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, init);
  } catch {
    throw new ApiError('NETWORK_ERROR', 'Could not reach the API');
  }

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(body?.error?.code ?? 'HTTP_ERROR', body?.error?.message ?? `Request failed (${response.status})`);
  }
  return body as T;
}

export async function fetchQueue(filter: QueueFilter): Promise<QueueOrder[]> {
  const query = filter === 'active' ? '' : `?status=${filter}`;
  const { orders } = await request<{ orders: QueueOrder[] }>(`/orders/queue${query}`);
  return orders;
}

export async function runOrderAction(orderId: number, action: OrderAction): Promise<void> {
  await request(`/orders/${orderId}/${action}`, { method: 'POST' });
}

export async function fetchMenuItems(): Promise<MenuItemOption[]> {
  const { menu_items } = await request<{ menu_items: MenuItemOption[] }>('/menu-items');
  return menu_items;
}

export async function createOrder(input: NewOrderInput): Promise<QueueOrder> {
  const { order } = await request<{ order: QueueOrder }>('/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return order;
}
