import { matches } from './requirements.js';

export function money(value) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('DATA_ERROR: missing or invalid price');
  return value;
}

export function supplyErrors(product, context) {
  const merchant = context.data.merchants.find(item => item.id === product.merchant_id);
  if (!merchant) throw new Error('DATA_ERROR: unknown merchant');
  const result = [];
  if (!merchant.open || !product.available || context.supply.unavailable_product_ids?.includes(product.id)) result.push('UNAVAILABLE');
  if (!merchant.delivery[context.task.address_id]?.available) result.push('UNDELIVERABLE');
  return result;
}

export function constraintErrors(product, configuration, context) {
  const { requirements, history } = context;
  const errors = [];
  if (configuration.ingredients.some(id => requirements.excluded.includes(id))) errors.push('EXCLUDED_INGREDIENT');
  if (requirements.excluded.length && configuration.ingredient_information_complete !== true) errors.push('UNKNOWN_INGREDIENTS');
  if (Object.entries(requirements.hard).some(([dimension, clauses]) =>
    clauses.some(accepted => !matches(dimension, configuration.attributes[dimension], accepted)))) errors.push('HARD_ATTRIBUTE');
  if (product.canonical_main_dish_ids.some(id => history.dish_ids.includes(id))) errors.push('REPEAT');
  return errors;
}

export function deliveryFee(merchantId, context) {
  const override = context.supply.delivery_fee_overrides;
  if (override && Object.hasOwn(override, merchantId)) return money(override[merchantId]);
  const merchant = context.data.merchants.find(item => item.id === merchantId);
  return money(merchant?.delivery[context.task.address_id]?.fee_fen);
}

export function configurationTotal(product, configuration, context) {
  return money(money(configuration.price_fen) + money(product.packaging_fee_fen_per_unit) + deliveryFee(product.merchant_id, context));
}

export function isCompleteConfiguration(product, configuration) {
  return product.spec_groups.every(group => group.option_ids.includes(configuration.option_values[group.id])) &&
    Object.keys(configuration.option_values).every(key => product.spec_groups.some(group => group.id === key));
}

export function selectableConfigurations(product, context) {
  const explicit = Object.hasOwn(context.selections, product.id);
  let selection = explicit ? context.selections[product.id] : product.default_selections;
  let source = explicit ? 'user' : 'default';
  const select = values => product.configurations.filter(configuration => isCompleteConfiguration(product, configuration) &&
    Object.entries(values).every(([key, value]) => configuration.option_values[key] === value));
  let configurations = select(selection);
  if (!explicit && Object.keys(selection).length && !configurations.some(configuration => !constraintErrors(product, configuration, context).length)) {
    selection = {};
    source = 'none';
    configurations = select(selection);
  }
  return { configurations, selection: { ...selection }, selection_source: source,
    missing_specs: product.spec_groups.filter(group => group.required && !Object.hasOwn(selection, group.id)).map(group => group.id) };
}
