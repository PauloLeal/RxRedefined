// Order status state machine. The single source of truth for which status changes are legal.
// To change a status rule, edit TRANSITIONS (and ACTIONS if a new endpoint is needed).

const { AppError } = require('../errors');

// from status -> statuses it may move to. Anything not listed is rejected.
const TRANSITIONS = {
  received: ['preparing', 'cancelled'],
  preparing: ['ready'],
  ready: ['picked_up'],
  picked_up: [],
  cancelled: [],
};

// API action (POST /orders/:id/<action>) -> target status
const ACTIONS = {
  start: 'preparing',
  ready: 'ready',
  pickup: 'picked_up',
  cancel: 'cancelled',
};

// Statuses shown in the default kitchen queue
const ACTIVE_STATUSES = ['received', 'preparing'];

function canTransition(from, to) {
  return (TRANSITIONS[from] || []).includes(to);
}

function assertTransition(from, to) {
  if (!canTransition(from, to)) {
    throw new AppError(409, 'INVALID_TRANSITION', `Cannot change order status from "${from}" to "${to}"`);
  }
}

// Actions the UI may offer for an order in this status. Lets the UI show buttons
// without keeping its own copy of the rules.
function allowedActions(status) {
  return Object.keys(ACTIONS).filter((action) => canTransition(status, ACTIONS[action]));
}

module.exports = {
  TRANSITIONS,
  ACTIONS,
  ACTIVE_STATUSES,
  canTransition,
  assertTransition,
  allowedActions,
};
