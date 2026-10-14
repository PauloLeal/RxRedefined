import { useCallback, useEffect, useRef, useState } from 'react';
import Alert from '@mui/material/Alert';
import Fab from '@mui/material/Fab';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import SvgIcon from '@mui/material/SvgIcon';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { ApiError, fetchQueue, runOrderAction } from '../api';
import type { OrderAction, QueueFilter, QueueOrder } from '../types';
import { NewOrderDialog } from './NewOrderDialog';
import { QueueTable } from './QueueTable';

// Background refresh: picks up new orders from other sources and keeps scores current.
export const REFRESH_MS = 5_000;

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return `${error.code}: ${error.message}`;
  return 'Unexpected error';
}

function formatClock(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function KitchenDisplay() {
  const [filter, setFilter] = useState<QueueFilter>('active');
  const [orders, setOrders] = useState<QueueOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyOrderId, setBusyOrderId] = useState<number | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Only the most recent request may update the table, so a slow response for an
  // old filter cannot overwrite a newer one.
  const latestRequest = useRef(0);

  const loadQueue = useCallback(async () => {
    const requestId = ++latestRequest.current;
    try {
      const result = await fetchQueue(filter);
      if (requestId !== latestRequest.current) return;
      setOrders(result);
      setLastUpdated(new Date());
    } catch (e) {
      if (requestId === latestRequest.current) setError(errorMessage(e));
    } finally {
      if (requestId === latestRequest.current) setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    setLoading(true);
    loadQueue();
    // Quiet refresh (no progress bar); skipped while the browser tab is hidden.
    const timer = setInterval(() => {
      if (!document.hidden) loadQueue();
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [loadQueue]);

  async function handleAction(order: QueueOrder, action: OrderAction) {
    setBusyOrderId(order.id);
    setError(null);
    try {
      await runOrderAction(order.id, action);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusyOrderId(null);
      // Always reload: the order moved, or someone else changed it and the screen is stale.
      await loadQueue();
    }
  }

  function handleCreated(order: QueueOrder) {
    setDialogOpen(false);
    setNotice(`Order #${order.id} for ${order.customer_name} created`);
    loadQueue();
  }

  return (
    <Stack spacing={2}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography variant="subtitle1" color="text.secondary">
          {orders.length} order{orders.length === 1 ? '' : 's'} · sorted by priority (highest first)
          {lastUpdated && ` · auto-refresh every ${REFRESH_MS / 1000}s, updated ${formatClock(lastUpdated)}`}
        </Typography>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={filter}
          onChange={(_event, value: QueueFilter | null) => value && setFilter(value)}
          aria-label="Filter by status"
        >
          <ToggleButton value="active">Active</ToggleButton>
          <ToggleButton value="received">Received</ToggleButton>
          <ToggleButton value="preparing">Preparing</ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Paper variant="outlined">
        {loading && <LinearProgress />}
        <QueueTable orders={orders} busyOrderId={busyOrderId} onAction={handleAction} />
      </Paper>

      <Fab
        color="primary"
        aria-label="New order"
        onClick={() => setDialogOpen(true)}
        sx={{ position: 'fixed', right: 24, bottom: 24 }}
      >
        <SvgIcon>
          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
        </SvgIcon>
      </Fab>

      <NewOrderDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onCreated={handleCreated} />

      <Snackbar
        open={notice !== null}
        autoHideDuration={4000}
        onClose={() => setNotice(null)}
        message={notice}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      />
    </Stack>
  );
}
