// Domain inputs contain already-effective requirements. UI/AI proposals must go
// through confirmation before removing restrictions or creating exceptions.
export const DIMENSIONS = ['spiciness', 'cuisine', 'oil', 'fried', 'staple', 'portion'];
export const REPEAT_RULES = ['allow', 'yesterday_same_meal', 'previous_meal'];

export function matches(dimension, value, accepted) {
  if (value === null || value === undefined) return false;
  return accepted.some(wanted => wanted === value ||
    (dimension === 'oil' && wanted === 'low' && value === 'none') ||
    (dimension === 'staple' && wanted === 'any' && ['rice', 'noodle'].includes(value)));
}

export function mergeRequirements(profile, current = {}, exceptions = {}) {
  const long = profile.long_term;
  const excluded = new Set(long.excluded_ingredients.filter(id =>
    !(exceptions.ingredients ?? []).includes(id)));
  for (const id of current.excluded_ingredients ?? []) excluded.add(id);
  // Keep separate hard clauses: a current requirement never silently overwrites
  // a long-term restriction. Confirmed exceptions only exempt the named values.
  const hard = {};
  for (const dimension of DIMENSIONS) {
    const clauses = [];
    const baseline = long.hard_attributes?.[dimension];
    const exempted = exceptions.hard_attributes?.[dimension];
    if (baseline && !(exempted && baseline.every(value => exempted.includes(value)))) clauses.push(baseline);
    if (current.hard_attributes?.[dimension]) clauses.push(current.hard_attributes[dimension]);
    if (clauses.length) hard[dimension] = clauses;
  }
  const layers = [current.soft_preferences ?? {}, long.soft_preferences ?? {}, profile.historical_soft_preferences ?? {}];
  const preferences = {};
  for (const dimension of DIMENSIONS) {
    if (hard[dimension]) continue;
    const source = layers.findIndex(layer => Object.hasOwn(layer, dimension));
    if (source >= 0) preferences[dimension] = { source, values: [...layers[source][dimension]] };
  }
  const repeat = current.repeat_rule ?? long.repeat_rule ?? 'allow';
  if (!REPEAT_RULES.includes(repeat)) throw new Error('DATA_ERROR: unknown repeat rule');
  return { excluded: [...excluded], hard, preferences, repeat_rule: repeat };
}

export function scoreConfiguration(configuration, requirements) {
  const scores = [0, 0, 0];
  const matched = [], unmatched = [];
  for (const [dimension, preference] of Object.entries(requirements.preferences)) {
    const entry = { dimension, source: preference.source, accepted: preference.values,
      actual: configuration.attributes[dimension] };
    if (matches(dimension, entry.actual, preference.values)) {
      scores[preference.source]++;
      matched.push(entry);
    } else unmatched.push(entry);
  }
  return { scores, matched, unmatched };
}
