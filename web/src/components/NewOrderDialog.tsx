import { useEffect, useState, type FormEvent } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { ApiError, createOrder, fetchMenuItems } from '../api';
import type { MenuItemOption, NewOrderInput, OrderType, QueueOrder } from '../types';

// Form state keeps raw input strings; the API is the one that validates them.
interface ItemRow {
  menuItemId: string;
  quantity: string;
}

const EMPTY_ROW: ItemRow = { menuItemId: '', quantity: '1' };

function toPayload(
  customerName: string,
  type: OrderType,
  isVip: boolean,
  promisedInMinutes: string,
  items: ItemRow[],
): NewOrderInput {
  return {
    customer_name: customerName,
    type,
    is_vip: isVip,
    promised_at:
      promisedInMinutes.trim() === ''
        ? null
        : new Date(Date.now() + Number(promisedInMinutes) * 60_000).toISOString(),
    items: items.map((row) => ({ menu_item_id: Number(row.menuItemId), quantity: Number(row.quantity) })),
  };
}

interface NewOrderDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (order: QueueOrder) => void;
}

export function NewOrderDialog({ open, onClose, onCreated }: NewOrderDialogProps) {
  const [menuItems, setMenuItems] = useState<MenuItemOption[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [type, setType] = useState<OrderType>('dine_in');
  const [isVip, setIsVip] = useState(false);
  const [promisedInMinutes, setPromisedInMinutes] = useState('');
  const [items, setItems] = useState<ItemRow[]>([EMPTY_ROW]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Fresh, empty form every time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setCustomerName('');
    setType('dine_in');
    setIsVip(false);
    setPromisedInMinutes('');
    setItems([EMPTY_ROW]);
    setError(null);
    fetchMenuItems()
      .then(setMenuItems)
      .catch(() => setError('Could not load the menu'));
  }, [open]);

  function updateRow(index: number, change: Partial<ItemRow>) {
    setItems((rows) => rows.map((row, i) => (i === index ? { ...row, ...change } : row)));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const order = await createOrder(toPayload(customerName, type, isVip, promisedInMinutes, items));
      onCreated(order);
    } catch (e) {
      setError(e instanceof ApiError ? `${e.code}: ${e.message}` : 'Unexpected error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <form onSubmit={handleSubmit} noValidate>
        <DialogTitle>New order</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}

            <TextField
              id="new-order-customer"
              label="Customer name"
              size="small"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              autoFocus
            />

            <Stack direction="row" spacing={2} alignItems="center">
              <TextField
                id="new-order-type"
                label="Type"
                size="small"
                select
                slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
                value={type}
                onChange={(e) => setType(e.target.value as OrderType)}
                sx={{ minWidth: 140 }}
              >
                <option value="dine_in">Dine-in</option>
                <option value="takeout">Takeout</option>
                <option value="delivery">Delivery</option>
              </TextField>
              <TextField
                id="new-order-promised"
                label="Promised in (minutes)"
                size="small"
                type="number"
                value={promisedInMinutes}
                onChange={(e) => setPromisedInMinutes(e.target.value)}
                helperText="Leave empty for no promised time"
              />
              <FormControlLabel
                control={<Checkbox checked={isVip} onChange={(e) => setIsVip(e.target.checked)} />}
                label="VIP"
              />
            </Stack>

            <Typography variant="subtitle2">Items</Typography>
            {items.map((row, index) => (
              <Stack key={index} direction="row" spacing={1} alignItems="center">
                <TextField
                  id={`new-order-item-${index}`}
                  label="Menu item"
                  size="small"
                  select
                  slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
                  value={row.menuItemId}
                  onChange={(e) => updateRow(index, { menuItemId: e.target.value })}
                  sx={{ flex: 1 }}
                >
                  <option value="">Choose…</option>
                  {menuItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </TextField>
                <TextField
                  id={`new-order-quantity-${index}`}
                  label="Quantity"
                  size="small"
                  type="number"
                  value={row.quantity}
                  onChange={(e) => updateRow(index, { quantity: e.target.value })}
                  sx={{ width: 100 }}
                />
                <Button
                  size="small"
                  color="inherit"
                  disabled={items.length === 1}
                  onClick={() => setItems((rows) => rows.filter((_, i) => i !== index))}
                >
                  Remove
                </Button>
              </Stack>
            ))}
            <Button size="small" onClick={() => setItems((rows) => [...rows, EMPTY_ROW])} sx={{ alignSelf: 'flex-start' }}>
              Add item
            </Button>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Close</Button>
          <Button type="submit" variant="contained" disabled={submitting}>
            Create order
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
