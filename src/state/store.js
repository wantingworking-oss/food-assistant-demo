import {planAI} from './ai-operations.js';
import {validateInterpretation,PARSER_VERSION} from '../domain/ai-contract.js';
import { demoDate, shiftDate, MEALS } from '../domain/history.js';
import { recommend } from '../domain/recommend.js';
import { validateCart } from '../domain/cart.js';
import { createContext } from '../domain/context.js';
import { selectableConfigurations } from '../domain/configurations.js';
import { mergeRequirements } from '../domain/requirements.js';
import { emptyRequirements, normalizeRequirements, planRequirements, requirementsSnapshot, restoreRequirements } from './requirements.js';

const PREFIX = 'food-assistant:1.0.0:';
export const STORAGE_KEY = `${PREFIX}U_A:task`;
export const userStorageKey = userId => `${PREFIX}${userId}:task`;
const ACTIVE_KEY = `${PREFIX}active-user`;
const copy = value => structuredClone(value);
const failure = reason => ({ ok: false, reason });
export function createStore(data, { storage, id = () => crypto.randomUUID(), now = () => new Date() } = {}) {
  let warning = '', blockedStorage = false;
  const sessions = new Map();
  const knownUser = userId => data.users.some(user => user.id === userId);
  const fresh = (userId = 'U_A', previous = null) => ({ schema: 3, dataset_version: data.dataset_version, user_id: userId,
    profile: copy(previous?.profile ?? data.users.find(user => user.id === userId)),
    task: { task_id: id(), address_id: previous?.task.address_id ?? 'A01', anchor_date: previous?.task.anchor_date ?? demoDate(now()), date: demoDate(now()), meal: 'lunch', allow_incomplete_history: false },
    current: emptyRequirements(), confirmed_exceptions: { ingredients: [], hard_attributes: {} },
    history_corrections: copy(previous?.history_corrections ?? {}), extra_history: copy(previous?.extra_history ?? []),
    page: 'home', selections: {}, skipped_product_ids: [], cart: [], note: '', orders: copy(previous?.orders ?? {}),
    quote: null, quote_review_required: false, supply: {unavailable_product_ids:[],delivery_fee_overrides:{}}, shop_id: null, undo: null, pending_change: null, history_ai: copy(previous?.history_ai ?? null),
    versions: { requirements: 0, cart: 0 }, ai_request: null });
  const runtimeData = state => ({ ...data, history: [...data.history, ...state.extra_history] });
  const inputFor = state => ({ profile: state.profile, task: state.task, current: state.current,
    confirmed_exceptions: state.confirmed_exceptions, history_corrections: state.history_corrections,
    selections: state.selections, skipped_product_ids: state.skipped_product_ids, supply: state.supply ?? {} });
  const load = userId => {
    let text;
    try { text = storage?.getItem(userStorageKey(userId)); }
    catch { warning = '浏览器无法保存。本次仍可操作，刷新后可能丢失选择和模拟订单。'; return sessions.get(userId) ? copy(sessions.get(userId)) : null; }
    try {
      if (!text) return sessions.get(userId) ? copy(sessions.get(userId)) : null;
      let saved = JSON.parse(text);
      if (saved.dataset_version !== data.dataset_version || saved.user_id !== userId || ![2, 3].includes(saved.schema)) throw new Error('version');
      if (saved.schema === 2) {
        const base = fresh(userId);
        saved = { ...base, ...saved, schema: 3, profile: base.profile, extra_history: [], current: base.current, confirmed_exceptions: base.confirmed_exceptions,
          history_corrections: {}, versions: base.versions, pending_change: null, undo: null, skipped_product_ids: [], shop_id: null };
      }
      if (!saved.profile || saved.profile.id !== userId || typeof saved.task?.task_id !== 'string' || !Array.isArray(saved.cart) || !saved.orders ||
          !saved.selections || !['home', 'assistant', 'confirm', 'shop'].includes(saved.page)) throw new Error('schema');
      normalizeRequirements(data, saved.profile.long_term); normalizeRequirements(data, saved.current);
      validateCart(runtimeData(saved), inputFor(saved), saved.cart);
      return saved;
    } catch {
      blockedStorage = true;
      warning = '保存记录版本不兼容或已损坏。已进入临时示例；请使用“恢复示例”重置，旧记录不会被静默覆盖。'; return null;
    }
  };
  let activeUser = 'U_A';
  try { const saved = storage?.getItem(ACTIVE_KEY); if (knownUser(saved)) activeUser = saved; } catch { /* session fallback */ }
  let state = load(activeUser) ?? fresh(activeUser);
  const historyCacheKey = () => JSON.stringify([state.user_id,PARSER_VERSION,state.history_corrections, data.history.filter(r=>r.user_id===state.user_id)]);
  // Pending confirmations cannot be replayed after refresh or switching users.
  state.pending_change = null; state.ai_request = null;
  const save = () => {
    sessions.set(state.user_id, copy(state));
    if (blockedStorage) return;
    try {
      if (!storage) throw new Error('unavailable');
      storage.setItem(userStorageKey(state.user_id), JSON.stringify(state)); storage.setItem(ACTIVE_KEY, state.user_id);
    } catch { warning = '浏览器无法保存。本次仍可操作，刷新后可能丢失选择和模拟订单。'; }
  };
  const input = () => inputFor(state);
  const effectiveData = () => runtimeData(state);
  const cartResult = () => validateCart(effectiveData(), input(), state.cart);
  const quote = result => JSON.stringify({ task: state.task, lines: state.cart, amounts: result.amounts_fen, requirements_version: state.versions.requirements });
  const existingOrder = () => state.orders[state.task.task_id] ?? null;
  const refreshQuote = () => { const result = cartResult(); state.quote = result.valid ? quote(result) : null; return result; };
  const invalidate = (kind = 'requirements') => {
    state.versions[kind]=(state.versions[kind]??0)+1; state.pending_change = null; state.ai_request = null; state.quote = null;
    if (kind === 'requirements') state.task.allow_incomplete_history = false;
  };
  const applyRequirements = next => {
    const before = requirementsSnapshot(state);
    if (JSON.stringify(before) === JSON.stringify(next)) return;
    restoreRequirements(state, next); state.undo = before; invalidate();
  };
  const getProduct = productId => data.products.find(product => product.id === productId);
  const selectedOptions = product => selectableConfigurations(product, createContext(effectiveData(), input())).selection;
  const validConfiguration = (productId, options) => {
    const product = getProduct(productId);
    if (!product) return { valid: false, error_code: 'NO_CONFIGURATION' };
    const complete = product.spec_groups.every(group => !group.required || Object.hasOwn(options, group.id));
    const configuration = product.configurations.find(config => product.spec_groups.every(group => options[group.id] === config.option_values[group.id]));
    const result = validateCart(effectiveData(), input(), [{ product_id: productId, configuration_id: complete ? configuration?.id ?? null : null, quantity: 1, role: 'main' }]);
    return { ...result, configuration_id: configuration?.id ?? null };
  };
  if (state.page === 'confirm' && !existingOrder()) refreshQuote();
  save();
  return {
    get state() { return copy(state); }, get warning() { return warning; },
    get storageKey() { return userStorageKey(state.user_id); },
    recommendations: () => recommend(effectiveData(), input()), cartResult,
    effectiveRequirements: () => mergeRequirements(state.profile, state.current, state.confirmed_exceptions),
    historyRecords: () => effectiveData().history.filter(record => state.profile.history_record_ids.includes(record.id)).map(record => ({ ...copy(record), ...copy(state.history_corrections[record.id] ?? {}), date: state.history_corrections[record.id]?.date ?? record.date ?? shiftDate(state.task.anchor_date, record.day_offset) })),
    productOptions: productId => selectedOptions(getProduct(productId)),
    preview: validConfiguration,
    historyCache: () => state.history_ai?.key===historyCacheKey()?copy(state.history_ai):null,
    dispatch(event) {
      try {
        if ((event.user_id && event.type !== 'SWITCH_USER' && event.user_id !== state.user_id) || (event.task_id && event.task_id !== state.task.task_id)) return failure('任务已变化，请重新操作。');
        if (existingOrder() && ['SELECT_MAIN', 'ADD_ITEM', 'EDIT_SPEC', 'CHANGE_QUANTITY', 'REMOVE_LINE', 'CHANGE_CONTEXT'].includes(event.type)) return failure('订单已提交，请先开始新的一餐。');
        switch (event.type) {
          case 'SIMULATE_SUPPLY': {
            const supply=copy(state.supply??{unavailable_product_ids:[],delivery_fee_overrides:{}});
            if(event.product_id!==undefined){
              if(!getProduct(event.product_id)||typeof event.available!=='boolean')return failure('请选择有效商品及可售状态。');
              supply.unavailable_product_ids=supply.unavailable_product_ids.filter(id=>id!==event.product_id);
              if(!event.available)supply.unavailable_product_ids.push(event.product_id);
            }
            if(event.merchant_id!==undefined){
              if(!data.merchants.some(m=>m.id===event.merchant_id)||!Number.isSafeInteger(event.delivery_fee_fen)||event.delivery_fee_fen<0||event.delivery_fee_fen>100000)return failure('配送费须为0至1000元，最多两位小数。');
              supply.delivery_fee_overrides[event.merchant_id]=event.delivery_fee_fen;
            }
            if(event.reset===true){supply.unavailable_product_ids=[];supply.delivery_fee_overrides={};}
            state.supply=supply;state.quote_review_required=true;invalidate('supply');break;
          }
          case 'REVIEW_QUOTE': {
            if(state.page!=='confirm')return failure('请先进入订单核对。');
            const result=cartResult();if(!result.valid)return failure(result.error_code);
            refreshQuote();state.quote_review_required=false;break;
          }
          case 'AI_BEGIN': {
            if(!['user_input','history_notes'].includes(event.mode))return failure('请求模式无效。');
            const request={request_id:id(),task_id:state.task.task_id,requirements_version:state.versions.requirements,mode:event.mode,text:event.text??'',
              context:{user_id:state.user_id,meal:state.task.meal,long_term:copy(state.profile.long_term),current:copy(state.current),exceptions:copy(state.confirmed_exceptions),undo_available:!!state.undo,clarification:event.clarification??null},
              history_notes:event.mode==='history_notes'?this.historyRecords().filter(r=>data.history.some(original=>original.id===r.id)).slice(0,6).map(r=>({id:r.id,note:r.note,belongs_to_user:r.belongs_to_user})):[]};
            state.ai_request=request;save();return {ok:true,request:copy(request)};
          }
          case 'AI_RESULT': {
            const req=state.ai_request, response=event.response;
            if(!req||req.context.user_id!==state.user_id||req.task_id!==state.task.task_id||req.requirements_version!==state.versions.requirements||['request_id','task_id','requirements_version','mode'].some(k=>req[k]!==response[k]))return {ok:false,stale:true,reason:'上下文已变化，旧AI结果已丢弃。'};
            const {request_id,task_id,requirements_version,mode,...body}=response;
            validateInterpretation(body,req,data);
            state.ai_request=null;
            if(body.status==='unavailable'){save();return failure(body.error?.message??'AI不可用。');}
            if(req.mode==='history_notes'){
              state.history_ai={key:historyCacheKey(),response:copy(body),dismissed:[]};save();return {ok:true,history:true};
            }
            const plan=planAI(data,state,body.operations);
            if(plan.command){return this.dispatch({type:plan.command==='undo_last'?'UNDO_LAST_CHANGE':'CLEAR_CURRENT_REQUIREMENTS'});}
            applyRequirements(plan.next);
            let result={ok:true,applied:plan.applied,deferred:plan.deferred,skipped:plan.skipped,clarifications:body.clarifications,unsupported_parts:body.unsupported_parts};
            if(plan.messages.length){state.pending_change={token:id(),version:state.versions.requirements,next:plan.pending,messages:plan.messages};result={...result,needs_confirmation:true,token:state.pending_change.token,messages:plan.messages};}
            save();return result;
          }
          case 'AI_END': if(state.ai_request?.request_id===event.request_id)state.ai_request=null;break;
          case 'HISTORY_AI_DISMISS': {
            if(state.history_ai?.key!==historyCacheKey())return failure('历史来源已变化，请重新整理。');
            state.history_ai.dismissed.push(event.item_id);break;
          }
          case 'HISTORY_AI_ACCEPT': {
            const cache=state.history_ai;
            if(!cache||cache.key!==historyCacheKey()||cache.dismissed.includes(event.item_id))return failure('建议已失效或已处理。');
            if(event.item_id.startsWith('op:')){
              const operation=cache.response.operations[Number(event.item_id.slice(3))];
              if(!operation||!['current','long_term'].includes(event.scope))return failure('建议无效。');
              if(operation.scope==='historical_meal')return failure('该建议仅属于历史那餐，不能自动应用为当前要求。');
              const plan=planAI(data,state,[{...operation,scope:event.scope}]);
              if(plan.skipped.length)return failure(plan.skipped[0].reason);
              applyRequirements(plan.next);
              if(plan.messages.length){state.pending_change={token:id(),version:state.versions.requirements,next:plan.pending,messages:plan.messages,history_item:event.item_id};save();return {ok:false,needs_confirmation:true,token:state.pending_change.token,messages:plan.messages};}
              state.history_ai.dismissed.push(event.item_id);
            }else{
              const annotation=cache.response.record_annotations[Number(event.item_id.slice(4))];
              if(!annotation||annotation.belongs_to_user===null)return failure('没有可应用的归属建议。');
              const r=this.historyRecords().find(r=>r.id===annotation.source_record_id);
              return this.dispatch({type:'EDIT_HISTORY',record_id:r.id,changes:{date:r.date,meal:r.meal,consumed_confirmed:r.consumed_confirmed,belongs_to_user:annotation.belongs_to_user}});
            }
            break;
          }
          case 'ENTER_ASSISTANT': state.page = existingOrder() ? 'confirm' : 'assistant'; break;
          case 'HOME': state.page = 'home'; break;
          case 'RETURN_TO_ASSISTANT': state.page = 'assistant'; break;
          case 'APPLY_REQUIREMENTS': case 'CLEAR_CURRENT_REQUIREMENTS': case 'PROPOSE_EXCEPTION': {
            const plan = planRequirements(data, state, event);
            if (plan.messages.length) {
              state.pending_change = { token: id(), version: state.versions.requirements, ...plan };
              save(); return { ok: false, needs_confirmation: true, token: state.pending_change.token, messages: plan.messages };
            }
            applyRequirements(plan.next); break;
          }
          case 'CONFIRM_CHANGE': {
            const pending = state.pending_change;
            if (!pending || pending.token !== event.token || pending.version !== state.versions.requirements) return failure('待确认内容已失效，请重新编辑。');
            applyRequirements(pending.next); if(pending.history_item&&state.history_ai?.key===historyCacheKey())state.history_ai.dismissed.push(pending.history_item); state.pending_change = null; break;
          }
          case 'CANCEL_CHANGE': state.pending_change = null; break;
          case 'UNDO_LAST_CHANGE': {
            if (!state.undo) return failure('没有可撤销的需求修改。');
            restoreRequirements(state, state.undo); state.undo = null; invalidate(); break;
          }
          case 'REMOVE_EXCEPTION': {
            const next = requirementsSnapshot(state);
            if (event.field === 'ingredients') next.exceptions.ingredients = next.exceptions.ingredients.filter(value => value !== event.value);
            else delete next.exceptions.hard_attributes[event.field];
            applyRequirements(next); break;
          }
          case 'EDIT_HISTORY': {
            if (!state.profile.history_record_ids.includes(event.record_id)) return failure('不能修改其他用户的记录。');
            const changes = event.changes;
            if (typeof changes.belongs_to_user !== 'boolean' || typeof changes.consumed_confirmed !== 'boolean' || !MEALS.includes(changes.meal)) return failure('历史记录格式无效。');
            shiftDate(changes.date, 0);
            state.history_corrections[event.record_id] = { belongs_to_user: changes.belongs_to_user, consumed_confirmed: changes.consumed_confirmed, meal: changes.meal, date: changes.date };
            invalidate(); break;
          }
          case 'ADD_HISTORY': {
            const product = getProduct(event.product_id);
            shiftDate(event.date, 0);
            if (!product || product.kind !== 'main' || !MEALS.includes(event.meal)) return failure('请选择有效主菜和餐次。');
            if (event.date > state.task.date || (event.date === state.task.date && MEALS.indexOf(event.meal) >= MEALS.indexOf(state.task.meal))) return failure('请补充当前餐之前的用餐记录。');
            const record = { id: `personal-${id()}`, user_id: state.user_id, belongs_to_user: true, consumed_confirmed: true,
              date: event.date, meal: event.meal, order_status: 'completed', note: '用户补充的实际用餐记录',
              items: [{ product_id: product.id, configuration_id: product.configurations[0].id, quantity: 1 }] };
            state.extra_history.push(record); state.profile.history_record_ids.push(record.id); invalidate(); break;
          }
          case 'ALLOW_INCOMPLETE_HISTORY': invalidate(); state.task.allow_incomplete_history = true; break;
          case 'CHANGE_CONTEXT': {
            if (!data.addresses.some(address => address.id === event.address_id) || !MEALS.includes(event.meal)) return failure('地址或餐次无效。');
            shiftDate(event.date, 0);
            state.task.address_id = event.address_id; state.task.date = event.date; state.task.meal = event.meal; invalidate(); break;
          }
          case 'SKIP_PRODUCT': if (!state.skipped_product_ids.includes(event.product_id)) state.skipped_product_ids.push(event.product_id); break;
          case 'RESET_SKIPPED': state.skipped_product_ids = []; break;
          case 'SELECT_MAIN': {
            const product = getProduct(event.product_id);
            if (!product || product.kind !== 'main') return failure('请选择主餐。');
            const item = recommend(effectiveData(), input()).items[event.product_id];
            if (!item) return failure('当前餐食不符合要求，请重新选择或调整要求。');
            const options = event.options ?? item.selected_options;
            const preview = validConfiguration(product.id, options);
            const allowDraft = event.destination === 'shop' && preview.error_code === 'MISSING_SPEC';
            if (!preview.valid && !allowDraft) return failure(preview.error_code);
            const old = state.cart.find(line => line.role === 'main');
            const merchantId = getProduct(state.cart[0]?.product_id)?.merchant_id;
            const switching = merchantId && merchantId !== product.merchant_id;
            if (switching && event.replace_confirmed !== true) return { ok: false, needs_replacement_confirmation: true };
            state.selections[product.id] = copy(options);
            const main = { product_id: product.id, configuration_id: allowDraft ? null : preview.configuration_id,
              quantity: old?.product_id === product.id ? old.quantity : 1, role: 'main' };
            state.cart = [main, ...(switching ? [] : state.cart.filter(line => line.role === 'addon'))];
            state.shop_id = product.merchant_id; invalidate('cart');
            state.page = event.destination === 'shop' ? 'shop' : 'confirm';
            if (state.page === 'confirm') refreshQuote(); break;
          }
          case 'OPEN_SHOP': {
            const merchantId = getProduct(state.cart[0]?.product_id)?.merchant_id ?? event.merchant_id;
            if (!data.merchants.some(merchant => merchant.id === merchantId)) return failure('请先选择一家商店。');
            state.shop_id = merchantId; state.page = 'shop'; break;
          }
          case 'ADD_ITEM': {
            const product = getProduct(event.product_id);
            if (!product || product.merchant_id !== state.shop_id || (state.cart.length && getProduct(state.cart[0].product_id).merchant_id !== product.merchant_id)) return failure('只能添加当前商店的餐食。');
            const options = event.options ?? selectedOptions(product), preview = validConfiguration(product.id, options);
            if (!preview.valid) return failure(preview.error_code);
            const line = state.cart.find(line => line.role === 'addon' && line.product_id === product.id && line.configuration_id === preview.configuration_id);
            if (line) line.quantity++; else state.cart.push({ product_id: product.id, configuration_id: preview.configuration_id, quantity: 1, role: 'addon' });
            invalidate('cart'); break;
          }
          case 'EDIT_SPEC': {
            const line = state.cart[event.index]; if (!line) return failure('餐食已变化，请重新操作。');
            const preview = validConfiguration(line.product_id, event.options);
            if (!preview.valid) return failure(preview.error_code);
            line.configuration_id = preview.configuration_id;
            if (line.role === 'main') state.selections[line.product_id] = copy(event.options);
            if (line.role === 'addon') {
              const other = state.cart.find((item, index) => index !== event.index && item.role === 'addon' && item.product_id === line.product_id && item.configuration_id === line.configuration_id);
              if (other) { other.quantity += line.quantity; state.cart.splice(event.index, 1); }
            }
            invalidate('cart'); if (state.page === 'confirm') refreshQuote(); break;
          }
          case 'CHANGE_QUANTITY': case 'REMOVE_LINE': {
            const line = state.cart[event.index]; if (!line) return failure('餐食已变化。');
            const quantity = event.type === 'REMOVE_LINE' ? 0 : event.quantity;
            if (!Number.isSafeInteger(quantity) || quantity < 0 || quantity > 999) return failure('数量须为0到999之间的整数。');
            if (quantity === 0) state.cart.splice(event.index, 1); else line.quantity = quantity;
            invalidate('cart'); if (state.page === 'confirm') refreshQuote(); break;
          }
          case 'OPEN_CONFIRM': state.page = 'confirm'; refreshQuote(); break;
          case 'SET_NOTE': if (!existingOrder()) state.note = String(event.value).slice(0, 200); break;
          case 'SUBMIT_MOCK_ORDER': {
            const saved = load(state.user_id), persisted = saved?.orders?.[state.task.task_id];
            if (persisted) state.orders[state.task.task_id] = persisted;
            if (existingOrder()) { state.page = 'confirm'; save(); return { ok: true, order: copy(existingOrder()), reused: true }; }
            if (state.page !== 'confirm') return failure('请先核对订单。');
            const result = cartResult(); if (!result.valid) return failure(result.error_code);
            if(state.quote_review_required)return failure('商家供给或费用已变化，请先核对当前明细。');
            if (state.quote !== quote(result)) { state.quote = quote(result); save(); return failure('费用、商品或要求发生变化，请重新核对后提交。'); }
            const order = { id: `DEMO-${state.task.task_id}`, task_id: state.task.task_id, status: 'submitted', submitted_at: now().toISOString(), consumed_confirmed: false,
              task: copy(state.task), lines: copy(state.cart), note: state.note, amounts_fen: copy(result.amounts_fen),
              items: state.cart.map(line => {
                const product = getProduct(line.product_id), config = product.configurations.find(item => item.id === line.configuration_id);
                return { ...copy(line), name: product.name, merchant_name: data.merchants.find(item => item.id === product.merchant_id).name,
                  option_values: copy(config.option_values), price_fen: config.price_fen, packaging_fee_fen_per_unit: product.packaging_fee_fen_per_unit };
              }) };
            state.orders[state.task.task_id] = order; save(); return { ok: true, order: copy(order), reused: false };
          }
          case 'SWITCH_USER': {
            if (!knownUser(event.user_id)) return failure('用户不存在。');
            state.pending_change = null; state.ai_request = null; save();
            state = load(event.user_id) ?? fresh(event.user_id); state.pending_change = null; state.ai_request = null; break;
          }
          case 'START_NEW_MEAL': state = fresh(state.user_id, state); state.page = 'assistant'; break;
          case 'RESTORE_EXAMPLE': {
            sessions.clear(); blockedStorage = false; warning = '';
            try { for (const user of data.users) storage?.setItem(userStorageKey(user.id), ''); } catch { /* save reports unavailable */ }
            state = fresh(); break;
          }
          default: return failure(`未知操作：${event.type}`);
        }
        save(); return { ok: true };
      } catch (error) { return failure(error.message); }
    },
  };
}
