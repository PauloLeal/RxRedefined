// Shape validation for POST /orders. Pure: returns a list of error messages (empty = valid).
// Whether the menu items exist is checked in the order module, because it needs the database.

const ORDER_TYPES = ['dine_in', 'takeout', 'delivery'];

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function validateNewOrder(input) {
  if (input == null || typeof input !== 'object' || Array.isArray(input)) {
    return ['body must be a JSON object'];
  }

  const errors = [];

  if (typeof input.customer_name !== 'string' || input.customer_name.trim() === '') {
    errors.push('customer_name must be a non-empty string');
  }
  if (!ORDER_TYPES.includes(input.type)) {
    errors.push(`type must be one of: ${ORDER_TYPES.join(', ')}`);
  }
  if (input.is_vip !== undefined && typeof input.is_vip !== 'boolean') {
    errors.push('is_vip must be a boolean');
  }
  if (input.promised_at != null && (typeof input.promised_at !== 'string' || Number.isNaN(Date.parse(input.promised_at)))) {
    errors.push('promised_at must be an ISO 8601 timestamp or null');
  }

  if (!Array.isArray(input.items) || input.items.length === 0) {
    errors.push('items must be a non-empty array');
  } else {
    input.items.forEach((item, index) => {
      if (!isPositiveInteger(item?.menu_item_id)) {
        errors.push(`items[${index}].menu_item_id must be a positive integer`);
      }
      if (!isPositiveInteger(item?.quantity)) {
        errors.push(`items[${index}].quantity must be a positive integer`);
      }
    });
  }

  return errors;
}

module.exports = { ORDER_TYPES, validateNewOrder };
