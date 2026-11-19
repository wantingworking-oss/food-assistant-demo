import { createContext } from './context.js';
import { scoreConfiguration } from './requirements.js';
import { supplyErrors, constraintErrors, selectableConfigurations, configurationTotal } from './configurations.js';

const PRIORITY = ['EXCLUDED_INGREDIENT', 'UNKNOWN_INGREDIENTS', 'HARD_ATTRIBUTE', 'REPEAT'];
const compareId = (a, b) => a < b ? -1 : a > b ? 1 : 0;
export function compareCandidates(a, b) {
  for (let i = 0; i < 3; i++) if (a.scores[i] !== b.scores[i]) return b.scores[i] - a.scores[i];
  return a.total_fen - b.total_fen || a.eta_minutes - b.eta_minutes ||
    compareId(a.product_id, b.product_id) || compareId(a.configuration_id, b.configuration_id);
}

export function recommend(data, input) {
  const context = createContext(data, input);
  const result = { status: 'ready', ranked_product_ids: [], display_product_ids: [], items: {},
    exclusions: {}, flags: context.history.flags, history_record_ids: context.history.record_ids };
  if (context.history.blocked) return { ...result, status: 'needs_history_confirmation' };
  const candidates = [];
  for (const product of data.products.filter(item => item.kind === 'main')) {
    const supply = supplyErrors(product, context);
    if (supply.length) { result.exclusions[product.id] = supply; continue; }
    if (context.skipped.includes(product.id)) { result.exclusions[product.id] = ['SKIPPED']; continue; }
    const selected = selectableConfigurations(product, context);
    const valid = [], rejected = new Set();
    for (const configuration of selected.configurations) {
      const errors = constraintErrors(product, configuration, context);
      if (errors.length) { errors.forEach(error => rejected.add(error)); continue; }
      const matching = scoreConfiguration(configuration, context.requirements);
      const merchant = data.merchants.find(item => item.id === product.merchant_id);
      valid.push({ product_id: product.id, configuration_id: configuration.id,
        ...matching, total_fen: configurationTotal(product, configuration, context),
        eta_minutes: merchant.delivery[context.task.address_id].eta_minutes,
        selected_options: selected.selection, selection_source: selected.selection_source,
        missing_specs: selected.missing_specs,
        comparison_options: { ...configuration.option_values },
        unknown_attributes: Object.entries(configuration.attributes).filter(([, value]) => value === null).map(([key]) => key),
        ingredient_information_complete: configuration.ingredient_information_complete,
        canonical_main_dish_ids: [...product.canonical_main_dish_ids] });
    }
    if (!valid.length) {
      result.exclusions[product.id] = rejected.size ? PRIORITY.filter(code => rejected.has(code)) : ['NO_CONFIGURATION'];
      continue;
    }
    valid.sort(compareCandidates);
    candidates.push(valid[0]);
  }
  candidates.sort(compareCandidates);
  const shownDishes = new Set();
  for (const candidate of candidates) {
    result.items[candidate.product_id] = candidate;
    result.ranked_product_ids.push(candidate.product_id);
    if (result.display_product_ids.length < 3 && !candidate.canonical_main_dish_ids.some(id => shownDishes.has(id))) {
      result.display_product_ids.push(candidate.product_id);
      candidate.canonical_main_dish_ids.forEach(id => shownDishes.add(id));
    }
  }
  for (const id of result.ranked_product_ids) {
    if (result.display_product_ids.length === 3) break;
    if (!result.display_product_ids.includes(id)) result.display_product_ids.push(id);
  }
  if (!candidates.length) result.status = 'no_match';
  return result;
}
