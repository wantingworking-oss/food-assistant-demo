import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createStore, STORAGE_KEY } from '../src/state/store.js';
const original = JSON.parse(await readFile(new URL('../fixtures/mock-data.json', import.meta.url), 'utf8'));
function harness(data = structuredClone(original)) {
  const memory = new Map();
  const storage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) };
  let counter = 0;
  const options = { storage, id: () => `task-${++counter}`, now: () => new Date('2026-11-19T04:00:00Z') };
  return { data, memory, options, store: createStore(data, options) };
}
test('T01 默认P01直接确认，金额2100，提交不产生已吃记录', () => {
  const { store, data } = harness(), before = JSON.stringify(data.history);
  store.dispatch({ type: 'ENTER_ASSISTANT' });
  assert.equal(store.dispatch({ type: 'SELECT_MAIN', product_id: 'P01' }).ok, true);
  assert.equal(store.state.page, 'confirm');
  assert.equal(store.cartResult().amounts_fen.total, 2100);
  const result = store.dispatch({ type: 'SUBMIT_MOCK_ORDER' });
  assert.equal(result.order.status, 'submitted');
  assert.equal(result.order.consumed_confirmed, false);
  assert.equal(JSON.stringify(data.history), before);
});
test('T02 P09参考配置不入车，补面食后为2800', () => {
  const { store } = harness();
  store.dispatch({ type: 'ENTER_ASSISTANT' });
  assert.equal(store.dispatch({ type: 'SELECT_MAIN', product_id: 'P09' }).ok, false);
  assert.deepEqual(store.state.cart, []);
  assert.equal(store.dispatch({ type: 'SUBMIT_MOCK_ORDER' }).ok, false);
  assert.equal(store.preview('P09', {}).valid, false);
  assert.equal(store.preview('P09', { staple: 'noodle' }).amounts_fen.total, 2800);
  store.dispatch({ type: 'SELECT_MAIN', product_id: 'P09', options: { staple: 'noodle' } });
  assert.equal(store.state.cart[0].configuration_id, 'noodle');
  assert.equal(store.recommendations().items.P09.total_fen, 2800);
});
test('T03 同一任务连续提交及重建状态后重试均复用同一订单', () => {
  const { store, data, options } = harness();
  store.dispatch({ type: 'SELECT_MAIN', product_id: 'P01' });
  const first = store.dispatch({ type: 'SUBMIT_MOCK_ORDER' });
  assert.equal(store.dispatch({ type: 'SUBMIT_MOCK_ORDER' }).order.id, first.order.id);
  const restored = createStore(data, options);
  assert.equal(restored.dispatch({ type: 'SUBMIT_MOCK_ORDER' }).order.id, first.order.id);
  assert.equal(Object.keys(restored.state.orders).length, 1);
});
test('T04 费用变化要求重新核对，快照不随后续价格改变', () => {
  const { store, data } = harness();
  store.dispatch({ type: 'SELECT_MAIN', product_id: 'P01' });
  data.merchants.find(item => item.id === 'M01').delivery.A01.fee_fen = 500;
  assert.equal(store.dispatch({ type: 'SUBMIT_MOCK_ORDER' }).ok, false);
  assert.equal(Object.keys(store.state.orders).length, 0);
  const result = store.dispatch({ type: 'SUBMIT_MOCK_ORDER' });
  assert.equal(result.order.amounts_fen.total, 2300);
  data.merchants.find(item => item.id === 'M01').delivery.A01.fee_fen = 900;
  assert.equal(store.dispatch({ type: 'SUBMIT_MOCK_ORDER' }).order.amounts_fen.total, 2300);
});
test('T05 导航与重复选餐不叠加数量，预览和取消不修改已选规格', () => {
  const { store } = harness();
  store.dispatch({ type: 'SELECT_MAIN', product_id: 'P01' });
  const before = store.state.cart;
  store.preview('P01', { portion: 'small' });
  assert.deepEqual(store.state.cart, before);
  store.dispatch({ type: 'RETURN_TO_ASSISTANT' });
  store.dispatch({ type: 'SELECT_MAIN', product_id: 'P01' });
  assert.equal(store.state.cart[0].quantity, 1);
});
test('T06 换店需要确认，取消保持旧车；确认后替换', () => {
  const { store } = harness();
  store.dispatch({ type: 'SELECT_MAIN', product_id: 'P01' });
  assert.equal(store.dispatch({ type: 'SELECT_MAIN', product_id: 'P08' }).needs_replacement_confirmation, true);
  assert.equal(store.state.cart[0].product_id, 'P01');
  assert.equal(store.dispatch({ type: 'SELECT_MAIN', product_id: 'P08', replace_confirmed: true }).ok, true);
  assert.equal(store.state.cart[0].product_id, 'P08');
});
test('T07 新餐与恢复示例分开，恢复只影响应用键', () => {
  const { store, memory } = harness(); memory.set('other-app', 'keep');
  store.dispatch({ type: 'SELECT_MAIN', product_id: 'P01' });
  const order = store.dispatch({ type: 'SUBMIT_MOCK_ORDER' }).order;
  store.dispatch({ type: 'START_NEW_MEAL' });
  assert.notEqual(store.state.task.task_id, order.task_id);
  assert.deepEqual(store.state.cart, []);
  assert.equal(Object.keys(store.state.orders).length, 1);
  store.dispatch({ type: 'RESTORE_EXAMPLE' });
  assert.equal(Object.keys(store.state.orders).length, 0);
  assert.equal(memory.get('other-app'), 'keep');
  assert.ok(memory.get(STORAGE_KEY));
});
test('T08 存储不可用仍可完成当前会话，但明确提示无法保存', () => {
  const data = structuredClone(original);
  const store = createStore(data, { storage: { getItem() { throw new Error(); }, setItem() { throw new Error(); } } });
  assert.match(store.warning, /无法保存/);
  store.dispatch({ type: 'SELECT_MAIN', product_id: 'P01' });
  assert.equal(store.dispatch({ type: 'SUBMIT_MOCK_ORDER' }).ok, true);
});
