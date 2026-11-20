export const DIMENSION_LABELS = { spiciness: '辣度', cuisine: '菜系', oil: '油量', fried: '油炸方式', staple: '主食', portion: '份量' };
export const MEAL_LABELS = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐' };
export const REPEAT_LABELS = { allow: '允许重复', yesterday_same_meal: '避开昨天同餐主菜', previous_meal: '避开上一餐主菜' };
export const ERROR_LABELS = { EMPTY_CART: '购物车为空，请先选餐。', CROSS_MERCHANT: '一份订单只能包含同店商品。', MISSING_SPEC: '还有餐食未选齐必选规格。', NO_CONFIGURATION: '该规格组合不可用。', EXCLUDED_INGREDIENT: '包含当前明确排除的食材。', UNKNOWN_INGREDIENTS: '无法核实排除食材，暂不能结算。', HARD_ATTRIBUTE: '与当前硬约束冲突。', REPEAT: '主菜与需避开的历史记录重复。', UNAVAILABLE: '餐食暂不可售。', UNDELIVERABLE: '当前地址不可配送。', NEEDS_HISTORY_CONFIRMATION: '相关用餐记录不足，请先确认核查范围。', DATA_ERROR: '餐食数据无效，请重新检查。' };
export function valueLabel(dimension, value) {
  const maps = { spiciness: { none: '不辣', mild: '微辣' }, cuisine: { home: '家常', sichuan: '川味', noodles: '面食类', japanese: '日式' },
    oil: { low: '少油', regular: '普通油量', none: '无油' }, fried: { true: '油炸', false: '非油炸' },
    staple: { rice: '米饭', noodle: '面食', none: '不含主食', any: '有主食即可' }, portion: { regular: '常规份', small: '小份', large: '大份' }, cilantro: { on: '带香菜', off: '不带香菜' } };
  return maps[dimension]?.[value] ?? value;
}

export function createPanels({ data, store, escape: e, perform, render, toast }) {
  const dialog = document.createElement('dialog'); dialog.id = 'preferences-dialog'; dialog.className = 'editor-dialog';
  dialog.setAttribute('aria-labelledby', 'editor-title'); document.body.append(dialog);
  let scope = 'current', mode = 'preferences', opener, draftStore=null, baseState=null, baseVersion=null, editorAI=null;
  function dispose(){editorAI?.destroy();editorAI=null;draftStore=null;baseState=null;}
  dialog.addEventListener('close',()=>{if(!dialog.open){dispose();if(opener?.isConnected)opener.focus();}});
  const close = () => {dispose();dialog.close();};
  const values = dimension => [...data.dictionaries.attributes[dimension].filter(value => value !== null), ...(dimension === 'staple' ? ['any'] : [])];
  const head = title => `<div class="section-heading"><h2 id="editor-title">${e(title)}</h2><button type="button" class="close-button" data-editor="close" aria-label="关闭编辑面板">×</button></div>`;
  const picks = (field, source, hard = false) => Object.keys(DIMENSION_LABELS).map(dimension => `<fieldset class="preference-dimension"><legend>${DIMENSION_LABELS[dimension]}</legend><div class="checkbox-row">${values(dimension).map(value => `<label><input type="checkbox" name="${field}:${dimension}" value="${e(JSON.stringify(value))}" aria-label="${hard ? '硬约束' : '偏好'}${DIMENSION_LABELS[dimension]}：${e(valueLabel(dimension, value))}" ${source?.[dimension]?.includes(value) ? 'checked' : ''}>${e(valueLabel(dimension, value))}</label>`).join('')}</div></fieldset>`).join('');
  function drawPreferences() {
    mode = 'preferences';
    const state = draftStore.state, historical = scope === 'historical';
    const source = scope === 'current' ? state.current : scope === 'long_term' ? state.profile.long_term : { soft_preferences: state.profile.historical_soft_preferences };
    dialog.innerHTML = head('调整本餐要求') + `<p class="editor-intro muted">先调整草稿，核对后统一应用。取消不会改变已有要求。</p><div id="editor-ai"></div><section class="manual-requirements" aria-labelledby="manual-title"><h3 id="manual-title">手动调整</h3><div class="editor-tabs" role="group" aria-label="要求范围">${[['current', '仅这餐'], ['long_term', '长期要求'], ['historical', '历史倾向']].map(([id, name]) => `<button type="button" data-scope="${id}" aria-pressed="${id === scope}">${name}</button>`).join('')}</div><p class="muted">${historical ? '可修改的示例历史倾向，仅用于较低优先级的偏好排序。' : scope === 'current' ? '空白项沿用长期要求与历史倾向。本餐排除与长期排除合并。' : '应用后持续生效。解除限制会在应用时另行确认。'}</p><form id="requirements-form">
      ${historical ? '' : `<fieldset><legend>不吃的食材</legend><div class="ingredient-grid">${data.dictionaries.ingredients.map(id => `<label><input type="checkbox" name="excluded" value="${id}" aria-label="排除${data.dictionaries.ingredient_labels[id]}" ${source.excluded_ingredients.includes(id) ? 'checked' : ''}>${data.dictionaries.ingredient_labels[id]}</label>`).join('')}</div></fieldset>`}
      <h3>尽量满足的偏好</h3><p class="muted">同维度可多选，命中任一即可；全部不选表示不设置。</p><div class="preference-grid">${picks('soft', source.soft_preferences)}</div>
      ${historical ? '' : `<details class="hard-editor"><summary>明确必须满足的属性（硬约束）</summary><p class="muted">只在完全不能接受其他选项时设置。</p><div class="preference-grid">${picks('hard', source.hard_attributes, true)}</div></details><label class="field-label">重复规则<select name="repeat" aria-label="重复规则">${scope === 'current' ? `<option value="" ${!source.repeat_rule ? 'selected' : ''}>沿用长期规则</option>` : ''}${Object.entries(REPEAT_LABELS).map(([id, name]) => `<option value="${id}" ${source.repeat_rule === id ? 'selected' : ''}>${name}</option>`).join('')}</select></label>`}
      <div class="editor-error" role="alert"></div></form>
      ${scope === 'current' ? `<section class="exception-editor"><h3>仅本餐的临时例外</h3><p class="muted">先加入草稿，应用时需确认，长期要求保持不变。</p><div class="exception-list">${state.profile.long_term.excluded_ingredients.map(id => `<button class="secondary" data-exception="ingredients" data-value="${id}" ${state.confirmed_exceptions.ingredients.includes(id) ? 'disabled' : ''}>仅本餐允许${data.dictionaries.ingredient_labels[id]}</button>`).join('')}${Object.keys(state.profile.long_term.hard_attributes).map(field => `<button class="secondary" data-exception="${field}" ${state.confirmed_exceptions.hard_attributes[field] ? 'disabled' : ''}>仅本餐豁免${DIMENSION_LABELS[field]}</button>`).join('') || '<p class="muted">没有可豁免的长期限制。</p>'}</div></section>` : ''}</section><section class="draft-review" aria-labelledby="draft-title"><h3 id="draft-title">本次将修改</h3><div id="draft-summary" aria-live="polite"></div></section><div class="editor-save"><button type="button" class="secondary" data-editor="close">取消</button><button class="primary" type="button" data-editor="apply">应用修改</button></div>`;
    refreshAI();refreshSummary();
  }
  function previewEvent(event){const result=draftStore.dispatch(event);if(result.needs_confirmation)return draftStore.dispatch({type:'CONFIRM_CHANGE',token:result.token});return result;}
  function capture(){
    const form=dialog.querySelector('#requirements-form');if(!form||!draftStore)return true;
    const fields=new FormData(form),value={excluded_ingredients:fields.getAll('excluded'),soft_preferences:{},hard_attributes:{}};
    for(const dimension of Object.keys(DIMENSION_LABELS))for(const [prefix,key]of [['soft','soft_preferences'],['hard','hard_attributes']]){
      const selected=fields.getAll(`${prefix}:${dimension}`).map(value=>JSON.parse(value));if(selected.length)value[key][dimension]=selected;
    }
    if(fields.get('repeat'))value.repeat_rule=fields.get('repeat');
    const result=previewEvent({type:'APPLY_REQUIREMENTS',scope,value:scope==='historical'?value.soft_preferences:value});
    dialog.querySelector('.editor-error').textContent=result.ok?'':ERROR_LABELS[result.reason]??result.reason;
    return result.ok;
  }
  function changes(){
    if(!baseState||!draftStore)return [];
    const old=requirementsSnapshot(baseState),next=requirementsSnapshot(draftStore.state),rows=[];
    const list=(dimension,values)=>values?.length?values.map(v=>valueLabel(dimension,v)).join(' / '):'未设置';
    const eq=(a,b)=>JSON.stringify([...(a??[])].sort())===JSON.stringify([...(b??[])].sort());
    for(const [key,label]of [['current','本餐'],['long_term','长期'],['historical','历史倾向']]){
      const before=old[key],after=next[key];
      if(key!=='historical')for(const id of new Set([...before.excluded_ingredients,...after.excluded_ingredients]))if(before.excluded_ingredients.includes(id)!==after.excluded_ingredients.includes(id))rows.push(`${label}：${after.excluded_ingredients.includes(id)?'新增不吃':'取消不吃'}${data.dictionaries.ingredient_labels[id]}`);
      for(const field of key==='historical'?['soft_preferences']:['soft_preferences','hard_attributes'])for(const dimension of Object.keys(DIMENSION_LABELS)){
        const a=key==='historical'?before[dimension]:before[field]?.[dimension],b=key==='historical'?after[dimension]:after[field]?.[dimension];
        if(!eq(a,b))rows.push(`${label}${field==='hard_attributes'?'硬约束':'偏好'} · ${DIMENSION_LABELS[dimension]}：${list(dimension,a)} → ${list(dimension,b)}`);
      }
      if(key!=='historical'&&before.repeat_rule!==after.repeat_rule)rows.push(`${label}重复规则：${REPEAT_LABELS[before.repeat_rule]??'沿用长期'} → ${REPEAT_LABELS[after.repeat_rule]??'沿用长期'}`);
    }
    for(const id of new Set([...old.exceptions.ingredients,...next.exceptions.ingredients]))if(old.exceptions.ingredients.includes(id)!==next.exceptions.ingredients.includes(id))rows.push(`${next.exceptions.ingredients.includes(id)?'仅本餐允许':'取消本餐例外'}${data.dictionaries.ingredient_labels[id]}`);
    for(const field of Object.keys(DIMENSION_LABELS))if(!eq(old.exceptions.hard_attributes[field],next.exceptions.hard_attributes[field]))rows.push(`${next.exceptions.hard_attributes[field]?'仅本餐豁免':'取消本餐豁免'}长期${DIMENSION_LABELS[field]}硬约束`);
    return rows;
  }
  function refreshSummary(){
    const node=dialog.querySelector('#draft-summary');if(!node)return;
    const rows=changes();node.innerHTML=rows.length?`<ul>${rows.map(row=>`<li>${e(row)}</li>`).join('')}</ul><p class="muted">解除限制或新增临时例外，应用时还需确认。</p>`:'<p class="muted">尚未修改任何要求。</p>';
    dialog.querySelector('[data-editor="apply"]').disabled=!rows.length;
  }
  function refreshAI(){const target=dialog.querySelector('#editor-ai')??dialog.querySelector('#history-ai-slot');if(target&&editorAI)target.innerHTML=editorAI.markup();}
  const openPreferences = (selectedScope = 'current') => {
    opener=document.activeElement;dispose();scope=selectedScope;mode='preferences';baseState=store.state;baseVersion=baseState.versions.requirements;draftStore=createRequirementsDraft(data,baseState);
    editorAI=createAI({data,store:draftStore,escape:e,toast,view:'preferences',previewOnly:true,container:()=>dialog.querySelector('#editor-ai'),beforeRequest:capture,
      render:()=>{if(dialog.open&&mode==='preferences')drawPreferences();},perform:()=>{}});
    drawPreferences();if(!dialog.open)dialog.showModal();
  };
  const mealSelect = (name, selected) => `<select name="${name}" aria-label="${name === 'meal' ? '餐次' : name}">${Object.entries(MEAL_LABELS).map(([id, text]) => `<option value="${id}" ${id === selected ? 'selected' : ''}>${text}</option>`).join('')}</select>`;
  function openHistory() {
    if(!dialog.open) opener=document.activeElement;
    if(mode!=='history'||!editorAI){dispose();mode='history';editorAI=createAI({data,store,escape:e,toast,view:'history',container:()=>dialog.querySelector('#history-ai-slot'),render:()=>{if(dialog.open&&mode==='history')refreshAI();},perform:result=>{if(result.needs_confirmation)close();perform(result);if(dialog.open)refreshAI();}});}
    mode = 'history';
    const records = store.historyRecords();
    dialog.innerHTML = head('核对用餐历史') + '<p class="muted">已完成订单用于购买推断；“吃过”由你明确确认。取消、失败或非本人记录不用于避重。历史备注不是已确认的饮食要求。</p>' +
      `<div class="history-records">${records.map(record => `<form class="history-record" data-record="${e(record.id)}"><div class="section-heading"><h3>${record.items.map(item => e(data.products.find(product => product.id === item.product_id)?.name ?? item.product_id)).join('、')}</h3><span class="soft-badge">${({ completed: '已完成', cancelled: '已取消', submitted: '已提交', failed: '失败' })[record.order_status]}</span></div><p class="history-note">原备注：${e(record.note)}</p><div class="record-fields"><label>日期<input type="date" name="date" value="${e(record.date)}" required></label><label>餐次${mealSelect('meal', record.meal)}</label></div><div class="checkbox-row"><label><input type="checkbox" name="belongs" ${record.belongs_to_user ? 'checked' : ''}>属于本人</label><label><input type="checkbox" name="consumed" ${record.consumed_confirmed ? 'checked' : ''}>确认吃过</label></div><button class="secondary" type="submit">保存此记录</button></form>`).join('') || '<p>还没有个人用餐记录。</p>'}</div>
      <details class="add-history"><summary>补充平台外用餐</summary><form id="add-history-form"><label class="field-label">吃过的主菜<select name="product_id">${data.products.filter(product => product.kind === 'main').map(product => `<option value="${product.id}">${e(product.name)}</option>`).join('')}</select></label><div class="record-fields"><label>日期<input type="date" name="date" value="${e(store.state.task.date)}" required></label><label>餐次${mealSelect('meal', 'breakfast')}</label></div><p class="muted">保存表示你确认吃过该主菜；只用于用餐记录，不创建订单。</p><button class="primary" type="submit">添加用餐记录</button></form></details><div class="editor-error" role="alert"></div>`;
    dialog.insertAdjacentHTML('beforeend','<div id="history-ai-slot"></div>');refreshAI();
    if (!dialog.open) dialog.showModal();
  }
  function openContext() {
    opener=document.activeElement;
    dispose();
    mode = 'context'; const task = store.state.task;
    dialog.innerHTML = head('配送与餐次') + `<form id="context-form"><label class="field-label">配送地址<select name="address_id" aria-label="配送地址">${data.addresses.map(address => `<option value="${address.id}" ${task.address_id === address.id ? 'selected' : ''}>${e(address.label)} · ${e(address.context)}</option>`).join('')}</select></label><div class="record-fields"><label>日期<input name="date" type="date" value="${e(task.date)}" required></label><label>餐次${mealSelect('meal', task.meal)}</label></div><p class="muted">修改后重算配送、费用与避重，保留已选商品；不合格的草稿会标记冲突。</p><div class="editor-error" role="alert"></div><button class="primary full" type="submit">保存配送与餐次</button></form>`;
    dialog.showModal();
  }
  const apply = event => {
    const result = store.dispatch(event);
    if (result.ok || result.needs_confirmation) { close(); perform(result); }
    else dialog.querySelector('.editor-error').textContent = ERROR_LABELS[result.reason] ?? result.reason;
    return result;
  };
  dialog.addEventListener('click', event => {
    const button = event.target.closest('button'); if (!button) return;
    if (button.dataset.editor === 'close') close();
    if (mode==='preferences'&&button.closest('.editor-tabs')&&button.dataset.scope&&capture()) { editorAI?.cancelRequest();scope = button.dataset.scope; drawPreferences(); }
    if (button.dataset.exception&&capture()) {editorAI?.cancelRequest();const result=previewEvent({ type: 'PROPOSE_EXCEPTION', field: button.dataset.exception, value: button.dataset.value });if(result.ok)drawPreferences();else dialog.querySelector('.editor-error').textContent=result.reason;}
    if(button.dataset.editor==='apply'&&capture()){
      const result=store.dispatch({type:'APPLY_REQUIREMENTS_DRAFT',user_id:baseState.user_id,task_id:baseState.task.task_id,base_version:baseVersion,value:requirementsSnapshot(draftStore.state)});
      if(result.ok||result.needs_confirmation){close();perform(result);if(result.ok)toast('本餐要求已更新，推荐已同步。');}else dialog.querySelector('.editor-error').textContent=result.reason;
    }
  });
  dialog.addEventListener('change',event=>{if(event.target.closest('#requirements-form')){editorAI?.cancelRequest();capture();refreshSummary();refreshAI();}});
  dialog.addEventListener('submit', event => {
    event.preventDefault(); const form = event.target, fields = new FormData(form);
    if (form.id === 'requirements-form') {
      capture();refreshSummary();
    } else if (form.dataset.record) {
      const result = store.dispatch({ type: 'EDIT_HISTORY', record_id: form.dataset.record,
        changes: { date: fields.get('date'), meal: fields.get('meal'), belongs_to_user: fields.has('belongs'), consumed_confirmed: fields.has('consumed') } });
      if (result.ok) { toast('历史记录已更新，推荐与购物车已重新检查。'); render(); openHistory(); } else dialog.querySelector('.editor-error').textContent = result.reason;
    } else if (form.id === 'add-history-form') {
      const result = store.dispatch({ type: 'ADD_HISTORY', product_id: fields.get('product_id'), date: fields.get('date'), meal: fields.get('meal') });
      if (result.ok) { render(); openHistory(); toast('已添加用餐记录。'); } else dialog.querySelector('.editor-error').textContent = result.reason;
    } else if (form.id === 'context-form') apply({ type: 'CHANGE_CONTEXT', ...Object.fromEntries(fields) });
  });
  return { openPreferences, openHistory, openContext, close,resolveConfirmation:(...args)=>editorAI?.resolveConfirmation(...args) };
}
import {createAI} from './ai-ui.js';
import {createRequirementsDraft} from './src/state/store.js';
import {requirementsSnapshot} from './src/state/requirements.js';
