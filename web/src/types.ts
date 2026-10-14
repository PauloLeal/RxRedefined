// Shapes returned by the API (see api/src/modules/orderModule.js).

export type OrderType = 'dine_in' | 'takeout' | 'delivery';
export type OrderStatus = 'received' | 'preparing' | 'ready' | 'picked_up' | 'cancelled';
export type OrderAction = 'start' | 'ready' | 'pickup' | 'cancel';

// 'active' = the default queue (no status filter sent to the API)
export type QueueFilter = 'active' | 'received' | 'preparing';

export interface OrderItem {
  menu_item_id: number;
  name: string;
  quantity: number;
}

export interface MenuItemOption {
  id: number;
  name: string;
  category: string;
  prep_time_minutes: number;
}

// Body of POST /orders
export interface NewOrderInput {
  customer_name: string;
  type: OrderType;
  is_vip: boolean;
  promised_at: string | null;
  items: { menu_item_id: number; quantity: number }[];
}

export interface QueueOrder {
  id: number;
  customer_name: string;
  type: OrderType;
  is_vip: boolean;
  status: OrderStatus;
  placed_at: string;
  promised_at: string | null;
  items: OrderItem[];
  score: number;
  minutes_waiting: number;
  allowed_actions: OrderAction[];
}
