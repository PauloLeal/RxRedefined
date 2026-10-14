import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import type { OrderAction, OrderStatus, OrderType, QueueOrder } from '../types';

// Display labels only. Which actions an order has comes from the API (`allowed_actions`),
// so the UI never decides what a legal status change is.
const ACTION_LABELS: Record<OrderAction, string> = {
  start: 'Start',
  ready: 'Mark ready',
  pickup: 'Picked up',
  cancel: 'Cancel',
};

const TYPE_LABELS: Record<OrderType, string> = {
  dine_in: 'Dine-in',
  takeout: 'Takeout',
  delivery: 'Delivery',
};

const STATUS_COLORS: Record<OrderStatus, 'default' | 'info' | 'warning' | 'success' | 'error'> = {
  received: 'info',
  preparing: 'warning',
  ready: 'success',
  picked_up: 'default',
  cancelled: 'error',
};

// Fixed width, sized for the widest case ("Start" + "Cancel"), so the columns do not shift
// when the visible rows only have one button (e.g. the Preparing filter).
const ACTIONS_CELL_SX = { width: 190, minWidth: 190 };

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatItems(order: QueueOrder): string {
  return order.items.map((item) => `${item.quantity}× ${item.name}`).join(', ');
}

interface QueueTableProps {
  orders: QueueOrder[];
  busyOrderId: number | null;
  onAction: (order: QueueOrder, action: OrderAction) => void;
}

export function QueueTable({ orders, busyOrderId, onAction }: QueueTableProps) {
  return (
    <TableContainer>
      <Table size="small" stickyHeader aria-label="Order queue">
        <TableHead>
          <TableRow>
            <TableCell align="right">Score</TableCell>
            <TableCell>Customer</TableCell>
            <TableCell>Type</TableCell>
            <TableCell>Items</TableCell>
            <TableCell align="right">Waiting</TableCell>
            <TableCell>Promised</TableCell>
            <TableCell>VIP</TableCell>
            <TableCell>Status</TableCell>
            <TableCell sx={ACTIONS_CELL_SX}>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {orders.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} align="center" sx={{ py: 6 }}>
                <Typography color="text.secondary">No orders in the queue</Typography>
              </TableCell>
            </TableRow>
          ) : (
            orders.map((order) => (
              <TableRow key={order.id} hover>
                <TableCell align="right" sx={{ fontWeight: 600 }}>
                  {order.score}
                </TableCell>
                <TableCell>{order.customer_name}</TableCell>
                <TableCell>{TYPE_LABELS[order.type]}</TableCell>
                <TableCell>{formatItems(order)}</TableCell>
                <TableCell align="right">{order.minutes_waiting} min</TableCell>
                <TableCell>{formatTime(order.promised_at)}</TableCell>
                <TableCell>{order.is_vip && <Chip label="VIP" color="secondary" size="small" />}</TableCell>
                <TableCell>
                  <Chip label={order.status} color={STATUS_COLORS[order.status]} size="small" variant="outlined" />
                </TableCell>
                <TableCell sx={ACTIONS_CELL_SX}>
                  <Stack direction="row" spacing={1}>
                    {order.allowed_actions.map((action) => (
                      <Button
                        key={action}
                        size="small"
                        variant={action === 'cancel' ? 'outlined' : 'contained'}
                        color={action === 'cancel' ? 'error' : 'primary'}
                        disabled={busyOrderId === order.id}
                        onClick={() => onAction(order, action)}
                      >
                        {ACTION_LABELS[action]}
                      </Button>
                    ))}
                  </Stack>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
