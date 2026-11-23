import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { recommend } from '../src/domain/recommend.js';
import { validateCart } from '../src/domain/cart.js';
import { fromSetup } from './fixture-adapter.js';
const load = async name => JSON.parse(await readFile(new URL(`../fixtures/${name}`, import.meta.url), 'utf8'));
const original = await load('mock-data.json');
const expected = await load('expected-results.json');
const revised = await load('recommendation-policy-v2.json');

for (const item of expected.recommendation_cases) test(`${item.id} ${item.title}`, () => {
  const data = structuredClone(original), input = fromSetup(data, item.setup);
  const before = JSON.stringify({ data, input });
  // Only R02/R16 ranking expectations changed with the new product requirement;
  // original prices, constraints, scores and source fixtures remain unchanged.
  const result = recommend(data, input), e = {...item.expected,...revised.recommendation_cases[item.id]};
  assert.equal(result.status, e.status);
  assert.deepEqual(result.ranked_product_ids, e.ranked_product_ids);
  assert.deepEqual(result.display_product_ids, e.display_product_ids);
  assert.deepEqual(result.flags, e.flags);
  for (const [id, value] of Object.entries(e.configuration_ids)) assert.equal(result.items[id].configuration_id, value, `${id} config`);
  for (const [id, value] of Object.entries(e.totals_fen)) assert.equal(result.items[id].total_fen, value, `${id} total`);
  for (const [id, value] of Object.entries(e.scores)) assert.deepEqual(result.items[id].scores, value, `${id} scores`);
  for (const [id, value] of Object.entries(e.primary_exclusion_codes)) assert.equal(result.exclusions[id][0], value, `${id} exclusion`);
  assert.equal(JSON.stringify({ data, input }), before, 'domain does not mutate inputs');
});
for (const item of expected.cart_cases) test(`${item.id} ${item.title}`, () => {
  const data = structuredClone(original), input = fromSetup(data, item.setup), lines = structuredClone(item.setup.lines);
  const before = JSON.stringify({ data, input, lines });
  const result = validateCart(data, input, lines);
  assert.deepEqual({ valid: result.valid, error_code: result.error_code, amounts_fen: result.amounts_fen }, item.expected);
  assert.equal(JSON.stringify({ data, input, lines }), before);
});
