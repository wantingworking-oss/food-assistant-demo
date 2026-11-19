import { createContext } from './context.js';
import { supplyErrors, constraintErrors, deliveryFee, money, isCompleteConfiguration } from './configurations.js';

const PRIORITY = ['EMPTY_CART', 'CROSS_MERCHANT', 'DATA_ERROR', 'NEEDS_HISTORY_CONFIRMATION',
  'UNAVAILABLE', 'UNDELIVERABLE', 'MISSING_SPEC', 'NO_CONFIGURATION',
  'EXCLUDED_INGREDIENT', 'UNKNOWN_INGREDIENTS', 'HARD_ATTRIBUTE', 'REPEAT'];

export function validateCart(data, input, lines) {
  const context = createContext(data, input);
  const errors = [];
  const add = (code, index = null) => errors.push({ code, line_index: index });
  const products = lines.map(line => data.products.find(product => product.id === line.product_id));
  if (!lines.length) add('EMPTY_CART');
  if (new Set(products.filter(Boolean).map(product => product.merchant_id)).size > 1) add('CROSS_MERCHANT');
  if (context.history.blocked) add('NEEDS_HISTORY_CONFIRMATION');
  let goods = 0, packaging = 0;
  lines.forEach((line, index) => {
    const product = products[index];
    if (!product || !Number.isSafeInteger(line.quantity) || line.quantity <= 0 || !['main', 'addon'].includes(line.role)) {
      add('DATA_ERROR', index); return;
    }
    supplyErrors(product, context).forEach(code => add(code, index));
    if (line.configuration_id === null || line.configuration_id === undefined) { add('MISSING_SPEC', index); return; }
    const configuration = product.configurations.find(item => item.id === line.configuration_id);
    if (!configuration || !isCompleteConfiguration(product, configuration)) { add('NO_CONFIGURATION', index); return; }
    constraintErrors(product, configuration, context).forEach(code => add(code, index));
    try {
      goods = money(goods + money(configuration.price_fen) * line.quantity);
      packaging = money(packaging + money(product.packaging_fee_fen_per_unit) * line.quantity);
    } catch { add('DATA_ERROR', index); }
  });
  let delivery = 0, total = 0;
  if (!errors.length) {
    try { delivery = deliveryFee(products[0].merchant_id, context); total = money(goods + packaging + delivery); }
    catch { add('DATA_ERROR'); }
  }
  errors.sort((a, b) => PRIORITY.indexOf(a.code) - PRIORITY.indexOf(b.code));
  return { valid: errors.length === 0, error_code: errors[0]?.code ?? null,
    amounts_fen: errors.length ? null : { goods, packaging, delivery, discount: 0, total },
    errors, flags: context.history.flags };
}
