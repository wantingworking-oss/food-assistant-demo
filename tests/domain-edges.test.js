import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { recommend } from '../src/domain/recommend.js';
import { validateCart } from '../src/domain/cart.js';
import { mergeRequirements } from '../src/domain/requirements.js';
import { resolveHistory, demoDate, shiftDate } from '../src/domain/history.js';
import { fromSetup } from './fixture-adapter.js';
const original = JSON.parse(await readFile(new URL('../fixtures/mock-data.json', import.meta.url), 'utf8'));
const setup = (data, scene = {}, user_id = 'U_A') => fromSetup(data, { user_id, address_id: 'A01', scene });
const line = (product_id, configuration_id = 'fixed', role = 'main') => ({ product_id, configuration_id, quantity: 1, role });

test('D01 临时例外不豁免独立本餐排除，也不改长期资料', () => {
  const data = structuredClone(original), input = setup(data, {
    replace_long_excluded: ['peanut', 'chicken'], confirmed_temporary_exceptions: ['chicken'], current_excluded: ['chicken'],
  });
  const merged = mergeRequirements(input.profile, input.current, input.confirmed_exceptions);
  assert.deepEqual(merged.excluded, ['peanut', 'chicken']);
  assert.deepEqual(input.profile.long_term.excluded_ingredients, ['peanut', 'chicken']);
});
test('D02 本餐硬约束不能静默覆盖长期硬约束', () => {
  const data = structuredClone(original), input = setup(data, { current_hard: { spiciness: ['mild'] } });
  input.profile.long_term.hard_attributes = { spiciness: ['none'] };
  assert.equal(recommend(data, input).status, 'no_match');
});
test('D03 同维多值只得一分，未匹配不回退到历史来源', () => {
  const data = structuredClone(original), input = setup(data, { current_soft: { staple: ['rice', 'noodle'] } });
  const result = recommend(data, input);
  assert.deepEqual(result.items.P01.scores, [1, 3, 0]);
  input.current.soft_preferences.staple = ['noodle'];
  assert.deepEqual(recommend(data, input).items.P01.scores, [0, 3, 0]);
});
test('D04 比较配置不写入选择；金额和理由来自同一配置', () => {
  const data = structuredClone(original), input = setup(data, { current_soft: { staple: ['noodle'] } });
  const item = recommend(data, input).items.P09;
  assert.deepEqual(item.selected_options, {});
  assert.deepEqual(item.missing_specs, ['staple']);
  assert.equal(item.configuration_id, 'noodle');
  assert.equal(item.total_fen, 2800);
  assert.equal(item.matched.find(match => match.dimension === 'staple').actual, 'noodle');
  assert.deepEqual(input.selections, {});
});
test('D05 整车错误优先级不随行顺序变化', () => {
  const data = structuredClone(original), input = setup(data, { unavailable_products: ['S01'] });
  const lines = [line('S02', 'fixed', 'addon'), line('S01', 'fixed', 'addon')];
  assert.equal(validateCart(data, input, lines).error_code, 'UNAVAILABLE');
  assert.equal(validateCart(data, input, [...lines].reverse()).error_code, 'UNAVAILABLE');
});
test('D06 必选规格缺失优先于另一行的食材冲突', () => {
  const data = structuredClone(original), input = setup(data, { current_excluded: ['cilantro'] });
  const cart = validateCart(data, input, [line('S06', 'cilantro_on', 'addon'), line('P09', null)]);
  assert.equal(cart.error_code, 'MISSING_SPEC');
  assert.equal(cart.amounts_fen, null);
});
test('D07 加菜角色的主餐商品仍执行主菜避重', () => {
  const data = structuredClone(original), input = setup(data);
  assert.equal(validateCart(data, input, [line('P02', 'fixed', 'addon')]).error_code, 'REPEAT');
});
test('D08 缺失价格不是免费商品', () => {
  const data = structuredClone(original), input = setup(data);
  delete data.products.find(product => product.id === 'P01').configurations[0].price_fen;
  assert.throws(() => recommend(data, input), /DATA_ERROR/);
  const result = validateCart(data, input, [line('P01')]);
  assert.equal(result.error_code, 'DATA_ERROR');
  assert.equal(result.amounts_fen, null);
});
test('D09 拒绝非法数量、商品与规格，金额不溢出', () => {
  const data = structuredClone(original), input = setup(data);
  for (const quantity of [0, -1, 0.5, Number.MAX_SAFE_INTEGER]) {
    assert.equal(validateCart(data, input, [{ ...line('P01'), quantity }]).error_code, 'DATA_ERROR');
  }
  assert.equal(validateCart(data, input, [line('missing')]).error_code, 'DATA_ERROR');
  assert.equal(validateCart(data, input, [line('P01', 'missing')]).error_code, 'NO_CONFIGURATION');
});
test('D10 日期锚点跨年可复现，任务刷新不使用系统日期', () => {
  const data = structuredClone(original), input = setup(data);
  input.task.anchor_date = '2027-01-01'; input.task.date = '2027-01-01';
  assert.deepEqual(recommend(data, input).ranked_product_ids, recommend(data, setup(data)).ranked_product_ids);
  assert.equal(shiftDate('2027-01-01', -1), '2026-12-31');
  assert.equal(demoDate(new Date('2026-11-19T16:01:00Z')), '2026-11-20');
});
test('D11 改变餐次、归属及历史重复ID按实际上下文处理', () => {
  const data = structuredClone(original), input = setup(data);
  const history = resolveHistory(data, input.profile, input.task, 'yesterday_same_meal');
  assert.ok(history.record_ids.length);
  input.profile.history_record_ids.push(...history.record_ids);
  assert.deepEqual(resolveHistory(data, input.profile, input.task, 'yesterday_same_meal').record_ids, history.record_ids);
  const corrections = Object.fromEntries(history.record_ids.map(id => [id, { belongs_to_user: false }]));
  assert.equal(resolveHistory(data, input.profile, input.task, 'yesterday_same_meal', corrections).blocked, true);
  input.task.meal = 'breakfast';
  assert.equal(resolveHistory(data, input.profile, input.task, 'yesterday_same_meal').blocked, true);
});
test('D12 未吃过的submitted记录不参与避重，确认吃过后可参与', () => {
  const data = structuredClone(original), input = setup(data);
  const record = { id: 'new', user_id: 'U_A', belongs_to_user: true, order_status: 'submitted',
    consumed_confirmed: false, day_offset: -1, meal: 'lunch', items: [line('P01')] };
  data.history = [record]; input.profile.history_record_ids = ['new'];
  assert.equal(resolveHistory(data, input.profile, input.task, 'previous_meal').blocked, true);
  record.consumed_confirmed = true;
  assert.deepEqual(resolveHistory(data, input.profile, input.task, 'previous_meal').record_ids, ['new']);
  record.order_status = 'cancelled';
  assert.equal(resolveHistory(data, input.profile, input.task, 'previous_meal').blocked, true);
});
test('D13 仅明确同意后允许历史不足，并保留提示', () => {
  const data = structuredClone(original), input = setup(data, { history_ids: [] });
  assert.equal(validateCart(data, input, [line('P01')]).error_code, 'NEEDS_HISTORY_CONFIRMATION');
  input.task.allow_incomplete_history = true;
  const result = validateCart(data, input, [line('P01')]);
  assert.equal(result.valid, true);
  assert.deepEqual(result.flags, ['HISTORY_INCOMPLETE']);
});
test('D14 数据输入排列不影响稳定推荐排序', () => {
  const data = structuredClone(original), expected = recommend(data, setup(data));
  data.products.reverse(); data.merchants.reverse();
  data.products.forEach(product => product.configurations.reverse());
  const actual = recommend(data, setup(data));
  assert.deepEqual(actual.ranked_product_ids, expected.ranked_product_ids);
  assert.deepEqual(actual.display_product_ids, expected.display_product_ids);
});
