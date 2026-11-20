import { createPanels, valueLabel, DIMENSION_LABELS, MEAL_LABELS, REPEAT_LABELS, ERROR_LABELS } from './panels.js';
import { createStore, STORAGE_KEY } from './src/state/store.js';

const app = document.querySelector('#app');
const specDialog = document.querySelector('#spec-dialog');
const actionDialog = document.querySelector('#action-dialog');
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const yuan = value => (value / 100).toFixed(2);
const labels = { regular: '常规份', small: '小份', rice: '米饭', noodle: '面食', none: '不辣', mild: '微辣', portion: '份量', staple: '主食', spiciness: '辣度' };
const optionLabel = valueLabel;
const specs = options => Object.entries(options).map(([key, value]) => optionLabel(key, value)).join(' · ') || '固定餐食';
const icon = name => `<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${({ pin: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', check: '<path d="m5 12 4 4L19 6"/>', bowl: '<path d="M3 11h18a9 9 0 0 1-18 0ZM7 21h10M8 3v3m4-4v4m4-3v3"/>', leaf: '<path d="M20 3C8 2 2 9 7 16s15-2 13-13ZM5 20 16 8"/>', back: '<path d="m14 5-7 7 7 7"/>', info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/>', bag: '<path d="M5 7h14l1 14H4L5 7Zm3 0V6a4 4 0 0 1 8 0v1"/>' })[name] ?? ''}</svg>`;
function illustration(tone = 'tomato') {
  return `<div class="food-art ${tone}" aria-label="餐食示意插画，非实拍"><svg viewBox="0 0 400 300" aria-hidden="true"><ellipse cx="205" cy="254" rx="124" ry="17" fill="#123f34" opacity=".1"/><path d="M76 143h248c-7 87-44 113-124 113S83 230 76 143" fill="#f7faf9"/><path d="M88 175c31 24 192 26 224-2" stroke="#dce7e1" stroke-width="5" fill="none"/><ellipse cx="200" cy="143" rx="125" ry="72" fill="#fff"/><ellipse cx="200" cy="143" rx="111" ry="60" fill="#edf0dc"/><path d="M97 147c17-67 169-82 207-14-28 53-161 57-207 14" fill="#fffaf0"/><g class="veg"><ellipse cx="242" cy="119" rx="28" ry="15" transform="rotate(-35 242 119)"/><ellipse cx="266" cy="143" rx="28" ry="16" transform="rotate(26 266 143)"/><ellipse cx="226" cy="153" rx="31" ry="16" transform="rotate(-26 226 153)"/></g><g class="main-food"><path d="M124 108q23-20 46 3l-8 30-37-6Z"/><path d="m164 128 27-16 25 28-22 23-30-8Z"/><path d="m116 151 26-11 25 22-20 21-33-8Z"/></g><g fill="#f1c34b"><path d="m169 99 27-3 15 20-22 11-24-11Z"/><path d="m153 157 21 6 10 24-33-3-9-13Z"/></g><g fill="#497c44"><ellipse cx="183" cy="134" rx="4" ry="8" transform="rotate(40 183 134)"/><ellipse cx="145" cy="122" rx="4" ry="9" transform="rotate(-40 145 122)"/><ellipse cx="207" cy="176" rx="4" ry="8" transform="rotate(20 207 176)"/></g><path d="m294 76 59-56m-48 68 59-55" stroke="#987055" stroke-width="7" stroke-linecap="round"/></svg><span class="art-caption">餐食示意</span></div>`;
}
let data, store, expanded = false, busy = false, specTarget = null, action = null, focusBeforeDialog = null;
let toastTimer, panels;
function toast(text) {
  const element = document.querySelector('#toast'); element.textContent = text; element.classList.add('visible');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => element.classList.remove('visible'), 4200);
}
function navigate(type) { store.dispatch({ type }); expanded = false; render(true); }
function header(page) {
  return `<header class="topbar"><div class="topbar-inner"><button class="brand" data-action="home" aria-label="今天吃什么首页"><span class="brand-mark">食</span><span>今天吃什么<small>每一餐，少一点纠结</small></span></button><div class="topbar-right"><span class="demo-label">模拟体验</span><label class="user-picker">用户<select id="user-picker" aria-label="切换示例用户">${data.users.map(user => `<option value="${user.id}" ${store.state.user_id === user.id ? 'selected' : ''}>${escape(user.name)}</option>`).join('')}</select></label></div></div></header>
    <div class="context-bar"><span>${icon('pin')} ${escape(data.addresses.find(a => a.id === store.state.task.address_id).label)} <button class="text-button" data-action="context">配送与餐次</button></span><span>${escape(store.state.task.date)} <b>${MEAL_LABELS[store.state.task.meal]}</b></span></div>
    ${page === 'home' ? '' : `<nav class="steps" aria-label="选餐进度"><span class="${page === 'assistant' ? 'active' : ''}">01 选定这一餐</span><i></i><span class="${page === 'confirm' ? 'active' : ''}">02 核对并模拟提交</span></nav>`}`;
}
function footer() {
  return `${supplyDemo()}<footer class="footer"><span>模拟商家与商品 · 不产生真实交易</span><button class="text-button" data-action="new-meal-request">开始新的一餐</button><button class="text-button" data-action="reset">恢复示例</button></footer>`;
}
function supplyDemo(){
 const st=store.state;if(st.page==='home'||st.orders[st.task.task_id])return '';
 const unavailable=st.supply?.unavailable_product_ids??[],fees=st.supply?.delivery_fee_overrides??{};
 return `<details class="demo-supply panel"><summary>体验异常场景（模拟）</summary><p class="muted">可模拟商家售罄和配送费调整，查看购物车与提交如何响应。仅影响当前用户的本餐示例。</p><form id="supply-stock" class="toolbar"><label>模拟商品<select name="product" aria-label="模拟商品">${data.products.map(p=>`<option value="${p.id}">${escape(p.name)}${unavailable.includes(p.id)?' · 已模拟售罄':''}</option>`).join('')}</select></label><button class="secondary" name="stock" value="off">模拟售罄</button><button class="secondary" name="stock" value="on">恢复可售</button></form><form id="supply-fee" class="toolbar"><label>模拟商家<select name="merchant" aria-label="模拟商家">${data.merchants.map(m=>`<option value="${m.id}">${escape(m.name)}</option>`).join('')}</select></label><label>新配送费（元）<input name="fee" aria-label="新配送费（元）" type="number" min="0" max="1000" step="0.01" required value="5"></label><button class="secondary">更新配送费</button></form><p class="muted">已模拟售罄：${unavailable.map(id=>escape(data.products.find(p=>p.id===id)?.name??id)).join('、')||'无'}；配送费调整：${Object.entries(fees).map(([id,fee])=>escape(data.merchants.find(m=>m.id===id)?.name??id)+' ¥'+yuan(fee)).join('、')||'无'}</p><button class="text-button" data-action="reset-supply">恢复供给与费用</button></details>`;
}
function home() {
  const hasOrder = Boolean(store.state.orders[store.state.task.task_id]);
  return `<main id="main"><section class="home-hero"><div class="hero-copy"><p class="eyebrow">给忙碌的日常，留一点轻松</p><h1 tabindex="-1">今天这一餐，<br>帮你选好了。</h1><p class="hero-description">记住你的口味，避开不吃的食材。<br>从一份合适的推荐开始，少翻一会儿，多歇一会儿。</p><button class="primary large" data-action="enter">${hasOrder ? '查看本次模拟订单' : '进入今天吃什么'}</button><p class="hero-hint">${icon('check')} 沿用小A示例要求，无需先聊天</p></div><div class="hero-visual">${illustration()}<span class="floating-label">这一餐，照顾你的口味</span></div></section>
    <section class="home-details"><div><p class="eyebrow">从要求到选定，简单三步</p><h2>把挑选的功夫，省下来。</h2></div><div class="benefit"><span>${icon('leaf')}</span><h3>记住你的要求</h3><p>口味、食材排除与近期主菜，<br>一起考虑。</p></div><div class="benefit"><span>${icon('bowl')}</span><h3>给你具体的一餐</h3><p>一项主推，少量备选，<br>说明为什么适合你。</p></div><div class="benefit"><span>${icon('bag')}</span><h3>选好就去确认</h3><p>规格、包装和配送费用，<br>提交前看清楚。</p></div></section>
    <div class="home-note">${icon('info')} 可从已有要求下方调整口味与忌口，再查看推荐；当前为模拟选餐体验。</div></main>`;
}
function requirements() {
 const st=store.state, effective=store.effectiveRequirements();
 const list = (obj) => Object.entries(obj).map(([key, values]) => `${DIMENSION_LABELS[key]}：${values.map(value=>valueLabel(key,value)).join(' / ')}`).join('；') || '未设置';
 return `<aside class="requirements panel"><h2>${escape(st.profile.name)}</h2><div class="requirement-group"><h3>有效食材排除</h3><p>${effective.excluded.map(id=>escape(data.dictionaries.ingredient_labels[id])).join('、') || '未设置'}</p></div><div class="requirement-group"><h3>长期要求</h3><p>${escape(list(st.profile.long_term.soft_preferences))}</p><p>硬约束：${escape(list(st.profile.long_term.hard_attributes))}</p></div><div class="requirement-group"><h3>仅这餐</h3><p>${escape(list(st.current.soft_preferences))}</p><p>本餐排除：${st.current.excluded_ingredients.map(id=>escape(data.dictionaries.ingredient_labels[id])).join('、') || '无'}</p><p>硬约束：${escape(list(st.current.hard_attributes))}</p><p>临时例外：${[...st.confirmed_exceptions.ingredients.map(id=>data.dictionaries.ingredient_labels[id]),...Object.keys(st.confirmed_exceptions.hard_attributes).map(key=>DIMENSION_LABELS[key])].join('、') || '无'}</p></div><div class="requirement-group"><h3>重复规则</h3><p>${REPEAT_LABELS[effective.repeat_rule]}</p></div><p class="history-hint">示例历史倾向：${escape(list(st.profile.historical_soft_preferences))}，不是本次AI分析。</p><div class="toolbar"><button class="primary" data-action="preferences">调整本餐要求</button><button class="text-button" data-action="history">核对历史</button><button class="text-button" data-action="undo" ${st.undo ? '' : 'disabled'}>撤销上次修改</button><button class="text-button" data-action="clear">清除本餐调整</button></div></aside>`;
}
const reasonFor = entry => ({ oil: '商品标记为少油', fried: '非油炸', staple: `包含${optionLabel('staple', entry.actual)}`, spiciness: optionLabel('spiciness', entry.actual), portion: optionLabel('portion', entry.actual) })[entry.dimension] ?? '符合菜系偏好';
function card(id, primary = false) {
  const item = store.recommendations().items[id];
  const product = data.products.find(product => product.id === id);
  const merchant = data.merchants.find(merchant => merchant.id === product.merchant_id);
  const config = product.configurations.find(config => config.id === item.configuration_id);
  const ingredients = config.ingredients.filter(id => !['oil', 'salt', 'water', 'garlic', 'ginger'].includes(id)).slice(0, 4).map(id => data.dictionaries.ingredient_labels[id]);
  const reasons = item.matched.filter(entry => ['oil', 'fried', 'staple'].includes(entry.dimension)).map(reasonFor);
  const missing = item.missing_specs.length > 0;
  return `<article class="meal-card ${primary ? 'featured' : ''}" data-product="${id}"><div class="meal-visual">${primary ? '<span class="recommend-label">本餐主推</span>' : ''}${illustration(id === 'P09' ? 'tofu' : id === 'P08' ? 'fish' : 'tomato')}</div><div class="meal-body"><p class="merchant">${escape(merchant.name)} <span>· 约${item.eta_minutes}分钟</span></p><h${primary ? 2 : 3}>${escape(product.name)}</h${primary ? 2 : 3}><p class="ingredients">${escape(ingredients.join(' · '))}</p><div class="reasons">${reasons.slice(0, 3).map(reason => `<span>${icon('check')}${escape(reason)}</span>`).join('')}</div><p class="fit-detail">${store.effectiveRequirements().excluded.length ? '符合当前食材排除' : '食材排除未设置'} · ${store.effectiveRequirements().repeat_rule === 'allow' ? '允许主菜重复' : (store.recommendations().flags.length ? '仅按现有记录避重' : '未命中所核查历史主菜')}</p>${item.unmatched.length ? `<p class="unmet">未满足：${item.unmatched.map(entry => escape(({ oil: '少油偏好', spiciness: '不辣偏好', fried: '非油炸偏好', staple: '主食偏好' })[entry.dimension] ?? entry.dimension)).join('、')}</p>` : ''}
    <div class="spec-note ${missing ? 'pending' : ''}">${missing ? `${icon('info')} 参考配置：${escape(specs(item.comparison_options))}，仍需选择主食` : `已${item.selection_source === 'user' ? '选' : '预填'}：${escape(specs(item.selected_options))}`}</div>
    <div class="meal-bottom"><div><span class="price"><small>¥</small>${yuan(item.total_fen)}</span><small class="price-caption">${missing ? '按参考配置估算，选后重算' : '预估总价，含包装和配送'}</small></div><button class="${primary ? 'primary' : 'secondary'}" data-action="select" data-product="${id}">选这餐</button></div><div class="toolbar"><button class="text-button" data-action="shop-select" data-product="${id}">进店加菜</button><button class="text-button" data-action="skip" data-product="${id}">换一个</button></div></div></article>`;
}
function assistant() {
  const result = store.recommendations(), ids = result.display_product_ids;
  return `<main id="main"><div class="page-title"><div><p class="eyebrow">${escape(store.state.profile.name)}，你好</p><h1 tabindex="-1">这一餐，试试这个？</h1><p class="muted">先看一份合适的，也给你留了其他选择。</p></div><span class="meal-label">${icon('clock')} ${MEAL_LABELS[store.state.task.meal]}</span></div><div class="assistant-layout">${requirements()}<section class="recommendations" aria-label="本餐推荐">
    ${store.state.cart.length ? '<div class="draft-bar">已保留你选的餐食。<button class="text-button" data-action="shop">查看购物车 / 加菜</button><button class="text-button" data-action="continue">继续核对订单</button></div>' : ''}
    ${ids.length ? card(ids[0], true) : `<div class="panel"><h2>暂时没有合适餐食</h2><p>当前没有符合要求的可售餐食，可以编辑要求、核对历史或查看已跳过的餐食。</p><button class="secondary" data-action="preferences">编辑要求</button><button class="text-button" data-action="reset-skipped">查看已跳过餐食</button>${result.status === 'needs_history_confirmation' ? '<button class="secondary" data-action="allow-history">仅按现有记录推荐</button>' : ''}</div>`}
    ${ids.length > 1 ? `<button class="alternatives-toggle" data-action="alternatives" aria-expanded="${expanded}" aria-controls="alternatives"><span>${expanded ? '收起' : '看看'}另外 ${ids.length - 1} 个选择</span><span class="chevron ${expanded ? 'up' : ''}" aria-hidden="true"></span></button><div id="alternatives" class="alternatives" ${expanded ? '' : 'hidden'}>${expanded ? ids.slice(1).map(id => card(id)).join('') : ''}</div>` : ''}
    <p class="recommend-footnote">推荐依据当前商品与规格信息；图片为统一餐食示意。</p></section></div></main>`;
}
function confirmation() {
  const state = store.state, order = state.orders[state.task.task_id], result = store.cartResult();
  const amounts = order?.amounts_fen ?? result.amounts_fen;
  const items = order?.items ?? state.cart.map(line => {
    const product = data.products.find(product => product.id === line.product_id);
    const config = product.configurations.find(config => config.id === line.configuration_id) ?? { option_values: {}, price_fen: 0 };
    return { ...line, name: product.name, option_values: config.option_values, price_fen: config.price_fen,
      merchant_name: data.merchants.find(merchant => merchant.id === product.merchant_id).name };
  });
  return `<main id="main" class="checkout"><div class="page-title"><div><p class="eyebrow">${order ? '这一餐，已经选好' : '选好了，再核对一下'}</p><h1 tabindex="-1">${order ? '模拟订单已提交' : '确认这一餐'}</h1><p class="muted">${order ? '明细已保存，不会产生真实付款或配送。' : '商品、规格和全部费用，都在这里。'}</p></div>${order ? '<span class="success-check">' + icon('check') + '</span>' : '<button class="text-button" data-action="back">' + icon('back') + ' 返回推荐</button>'}</div>
    ${order ? '<div class="success-banner">' + icon('check') + '<div><strong>提交成功 · 模拟体验</strong><p>这只是提交记录，未自动记为“已经吃过”。</p></div></div>' : ''}
    <div class="checkout-layout"><section class="order-details"><div class="panel address-panel">${icon('pin')}<div><h2>${escape(data.addresses.find(a=>a.id===state.task.address_id).label)}</h2><p>${escape(state.profile.name)} · ${escape(state.task.date)} ${MEAL_LABELS[state.task.meal]}</p><p class="muted">演示地址，无真实收货信息</p></div></div><div class="panel order-panel"><h2>${escape(items[0]?.merchant_name ?? '本次餐食')}</h2>${items.map(item => `<div class="order-line"><div class="order-icon">${icon('bowl')}</div><div><h3>${escape(item.name)}</h3><p>${escape(specs(item.option_values))} · ×${item.quantity}</p><span class="soft-badge">${item.role === 'main' ? '主餐' : '主动加菜'}</span></div><strong>¥${yuan(item.price_fen * item.quantity)}</strong></div>`).join('')}
    ${!order ? '<button class="text-button" data-action="shop">编辑购物车 / 加菜</button><button class="text-button" data-action="preferences">编辑要求</button>' : ''}${!order && items.length ? '<button class="text-button" data-action="edit-spec">调整规格</button>' : ''}</div><div class="panel note-panel">${order ? `<h2>订单备注</h2><p class="saved-note">${escape(order.note || '无备注')}</p><p class="muted order-id">模拟订单号：${escape(order.id)}</p>` : `<label for="order-note">订单备注 <span class="muted">（选填）</span></label><textarea id="order-note" maxlength="200" rows="2" placeholder="如：放在前台。备注不改变商品食材与规格。">${escape(state.note)}</textarea><p class="muted">备注不能替代食材检查或规格选择。</p>`}</div></section>
    <aside class="panel bill"><h2>费用明细</h2>${amounts ? `<dl><div><dt>商品小计</dt><dd>¥${yuan(amounts.goods)}</dd></div><div><dt>包装费</dt><dd>¥${yuan(amounts.packaging)}</dd></div><div><dt>配送费</dt><dd>¥${yuan(amounts.delivery)}</dd></div><div><dt>优惠</dt><dd>¥${yuan(amounts.discount)}</dd></div></dl><div class="bill-total"><span>合计</span><strong data-testid="total">¥${yuan(amounts.total)}</strong></div>` : `<p role="alert">${escape(ERROR_LABELS[result.error_code] ?? result.error_code)}</p>`}
    ${!order&&state.quote_review_required?`<p class="quote-notice" role="status">商家供给或费用已变化，请重新核对当前明细。</p><button class="secondary full" data-action="review-quote" ${result.valid?'':'disabled'}>已核对当前明细</button>`:''}${order ? '<button class="primary full" data-action="new-meal">开始新的一餐</button><button class="secondary full" data-action="home">回到首页</button>' : `<button class="primary full" data-action="submit" ${busy || !result.valid || state.quote_review_required ? 'disabled' : ''}>${busy ? '正在保存…' : '确认并模拟提交'}</button>`}<p class="bill-note">${icon('info')} ${order ? '已保存一条模拟订单' : '仅模拟提交，不会扣款'}</p></aside></div></main>`;
}
function render(focus = false) {
  const state = store.state;
  app.innerHTML = header(state.page) + (store.warning ? `<div class="storage-warning" role="status">${escape(store.warning)}</div>` : '') +
    (state.page === 'home' ? home() : state.page === 'assistant' ? assistant() : state.page === 'shop' ? shop() : confirmation()) + footer();
  if (focus) { document.querySelector('h1')?.focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: 'instant' }); }
}
function actionPrompt(title, text, label, callback) {
  focusBeforeDialog = document.activeElement; action = callback;
  actionDialog.innerHTML = `<h2 id="action-title">${escape(title)}</h2><p>${escape(text)}</p><div class="dialog-actions"><button class="secondary" data-dialog="cancel">取消</button><button class="primary" data-dialog="confirm">${escape(label)}</button></div>`;
  actionDialog.showModal();
}
function closeDialog(dialog) { dialog.close(); focusBeforeDialog?.focus?.(); }
function select(productId, options, confirmed = false, destination) {
  const result = store.dispatch({ type: 'SELECT_MAIN', product_id: productId, options, replace_confirmed: confirmed, destination });
  if (result.needs_replacement_confirmation) {
    actionPrompt('换一家店吗？', '确认后替换整份购物车，包括主餐和加菜。取消保留原草稿。', '确认替换', () => select(productId, options, true, destination)); return;
  }
  if (!result.ok) { toast(result.reason); return; }
  render(true);
}
function openSpecs(productId, mode = 'select', index = null) {
  const product = data.products.find(product => product.id === productId);
  const item = mode === 'select' ? store.recommendations().items[productId] : { selected_options: index === null ? store.productOptions(productId) : product.configurations.find(c=>c.id===store.state.cart[index].configuration_id)?.option_values ?? {}, missing_specs: product.spec_groups.map(g=>g.id) };
  if (!item) { toast('当前餐食已不符合要求。'); return; }
  specTarget = { id: productId, mode, index, options: { ...item.selected_options } }; focusBeforeDialog = document.activeElement;
  specDialog.innerHTML = `<div class="section-heading"><p class="eyebrow">选好规格，再确认</p><button class="close-button" data-spec="cancel" aria-label="关闭规格面板">×</button></div><h2 id="spec-title">${escape(product.name)}</h2><p class="muted">${item.missing_specs.length ? '参考配置不是已选规格，请选择你想要的。' : '按商家支持的规格调整，费用将重新计算。'}</p><form id="spec-form">${product.spec_groups.map(group => `<fieldset><legend>${escape(labels[group.id])}<span class="required">${group.required ? '必选' : ''}</span></legend><div class="spec-options">${group.option_ids.map(value => `<label class="option"><input type="radio" name="${escape(group.id)}" value="${escape(value)}" ${specTarget.options[group.id] === value ? 'checked' : ''}><span>${escape(optionLabel(group.id, value))}</span></label>`).join('')}</div></fieldset>`).join('')}<div id="spec-preview" aria-live="polite"></div><button class="primary full" type="submit">确认规格并继续</button></form>`;
  updateSpecPreview(); specDialog.showModal();
}
function updateSpecPreview() {
  const result = store.preview(specTarget.id, specTarget.options);
  document.querySelector('#spec-preview').innerHTML = result.valid ? `<div class="spec-total"><span>本餐预估总价</span><strong>¥${yuan(result.amounts_fen.total)}</strong></div><p class="muted">含商品、包装和配送。已按所选规格重新检查。</p>` : `<p class="pending-text">${escape(ERROR_LABELS[result.error_code] ?? '请选择完整规格后继续。')}</p>`;
  specDialog.querySelector('button[type="submit"]').disabled = !result.valid;
}
app.addEventListener('click', async event => {
  const button = event.target.closest('[data-action]'); if (!button) return;
  const actionName = button.dataset.action;
  if(actionName==='reset-supply')perform(store.dispatch({type:'SIMULATE_SUPPLY',reset:true}));
  if(actionName==='review-quote')perform(store.dispatch({type:'REVIEW_QUOTE'}));
  if(actionName==='new-meal-request') actionPrompt('开始新的一餐？','清理本餐购物车、临时要求和撤销记录，保留个人资料与有效历史。','开始新餐',()=>navigate('START_NEW_MEAL'));
  if(actionName==='preferences') panels.openPreferences();
  if(actionName==='history') panels.openHistory();
  if(actionName==='context') panels.openContext();
  if(actionName==='undo') perform(store.dispatch({type:'UNDO_LAST_CHANGE'}));
  if(actionName==='clear') perform(store.dispatch({type:'CLEAR_CURRENT_REQUIREMENTS'}));
  if(actionName==='allow-history') actionPrompt('记录不足','仅按现有记录继续，不能保证未与遗漏记录重复。','确认继续',()=>perform(store.dispatch({type:'ALLOW_INCOMPLETE_HISTORY'})));
  if(actionName==='skip') perform(store.dispatch({type:'SKIP_PRODUCT',product_id:button.dataset.product}));
  if(actionName==='reset-skipped') perform(store.dispatch({type:'RESET_SKIPPED'}));
  if(actionName==='shop-select') select(button.dataset.product, undefined, false, 'shop');
  if(actionName==='shop') perform(store.dispatch({type:'OPEN_SHOP'}));
  if(actionName==='replace-main') select(button.dataset.product, undefined, false, 'shop');
  if(actionName==='add') { const p=data.products.find(p=>p.id===button.dataset.product); if(p.spec_groups.length) openSpecs(p.id,'add'); else perform(store.dispatch({type:'ADD_ITEM',product_id:p.id})); }
  if(actionName==='line-spec') openSpecs(store.state.cart[Number(button.dataset.index)].product_id,'edit',Number(button.dataset.index));
  if(actionName==='quantity') perform(store.dispatch({type:'CHANGE_QUANTITY',index:Number(button.dataset.index),quantity:Number(button.dataset.quantity)}));
  if(actionName==='remove') perform(store.dispatch({type:'REMOVE_LINE',index:Number(button.dataset.index)}));

  if (actionName === 'home') navigate('HOME');
  if (actionName === 'enter') navigate('ENTER_ASSISTANT');
  if (actionName === 'back') navigate('RETURN_TO_ASSISTANT');
  if (actionName === 'continue') navigate('OPEN_CONFIRM');
  if (actionName === 'new-meal') navigate('START_NEW_MEAL');
  if (actionName === 'reset') actionPrompt('恢复小A示例？', '会清除本次选择、备注和新增模拟订单，回到初始状态。', '恢复示例', () => navigate('RESTORE_EXAMPLE'));
  if (actionName === 'alternatives') { expanded = !expanded; render(); app.querySelector('[data-action="alternatives"]')?.focus(); }
  if (actionName === 'select') {
    const id = button.dataset.product, item = store.recommendations().items[id];
    if (item.missing_specs.length) openSpecs(id); else select(id);
  }
  if (actionName === 'edit-spec') {
    const id = store.state.cart[0]?.product_id;
    if (!data.products.find(product => product.id === id)?.spec_groups.length) toast('这份餐食没有可调整的规格。');
    else openSpecs(id, 'edit', 0);
  }
  if (actionName === 'submit' && !busy) {
    busy = true; button.disabled = true; button.textContent = '正在保存…';
    try {
      const submit = () => store.dispatch({ type: 'SUBMIT_MOCK_ORDER' });
      const result = navigator.locks ? await navigator.locks.request(`${store.storageKey}:submit`, submit) : submit();
      if (!result.ok) toast(result.reason);
    } catch { toast('保存未完成，请检查后重试。已保留本次选择。'); }
    finally { busy = false; render(true); }
  }
});
app.addEventListener('input', event => { if (event.target.id === 'order-note') store.dispatch({ type: 'SET_NOTE', value: event.target.value }); });
app.addEventListener('submit',event=>{
 if(!['supply-stock','supply-fee'].includes(event.target.id))return;
 event.preventDefault();const values=new FormData(event.target);
 perform(store.dispatch(event.target.id==='supply-stock'?{type:'SIMULATE_SUPPLY',product_id:values.get('product'),available:event.submitter?.value==='on'}:{type:'SIMULATE_SUPPLY',merchant_id:values.get('merchant'),delivery_fee_fen:Math.round(Number(values.get('fee'))*100)}));
});
specDialog.addEventListener('change', event => { if (event.target.matches('input[type="radio"]')) { specTarget.options[event.target.name] = event.target.value; updateSpecPreview(); } });
specDialog.addEventListener('submit', event => { event.preventDefault(); const target = specTarget; closeDialog(specDialog); if(target.mode==='select') select(target.id, target.options); else perform(store.dispatch(target.mode==='add' ? {type:'ADD_ITEM',product_id:target.id,options:target.options} : {type:'EDIT_SPEC',index:target.index,options:target.options})); });
specDialog.addEventListener('click', event => { if (event.target.closest('[data-spec="cancel"]')) closeDialog(specDialog); });
function cancelPendingChange(){const token=store?.state.pending_change?.token;store?.dispatch({type:'CANCEL_CHANGE'});panels?.resolveConfirmation(token,'cancelled');render();}
actionDialog.addEventListener('click', event => { const button = event.target.closest('[data-dialog]'); if (!button) return; closeDialog(actionDialog); if (button.dataset.dialog === 'confirm') action?.(); else cancelPendingChange(); });
actionDialog.addEventListener('cancel',()=>{cancelPendingChange();focusBeforeDialog?.focus?.();});
specDialog.addEventListener('cancel',()=>{focusBeforeDialog?.focus?.();});

try {
  const response = await fetch('./data/mock-data.json');
  if (!response.ok) throw new Error('Dataset unavailable');
  data = await response.json();
  let storage; try { storage = localStorage; } catch { /* Store exposes a session-only warning. */ }
  store = createStore(data, { storage }); panels = createPanels({data,store,escape,perform,render,toast}); render();
} catch {
  app.innerHTML = '<main id="main" class="loading"><h1>暂时无法准备餐食</h1><p>示例数据没有成功加载，请刷新重试。</p><button class="primary" id="retry">重新加载</button></main>';
  document.querySelector('#retry').addEventListener('click', () => location.reload());
}

function perform(result) {
 if(result.needs_confirmation) actionPrompt('确认要求变更',result.messages.join(' '),'确认变更',()=>{const resolved=store.dispatch({type:'CONFIRM_CHANGE',token:result.token});panels?.resolveConfirmation(result.token,resolved.ok?'confirmed':'invalid');perform(resolved);});
 else if(!result.ok) toast(ERROR_LABELS[result.reason] ?? result.reason);
 render();
}
app.addEventListener('change',event=>{if(event.target.id==='user-picker'){panels.close();perform(store.dispatch({type:'SWITCH_USER',user_id:event.target.value}));}});
function shop(){
 const st=store.state,result=store.cartResult(), merchant=data.merchants.find(m=>m.id===st.shop_id);
 return `<main id="main"><div class="page-title"><h1>${escape(merchant.name)}</h1><button class="text-button" data-action="back">返回推荐</button></div><div class="checkout-layout"><section class="shop-menu">${data.products.filter(p=>p.merchant_id===st.shop_id).map(p=>`<article class="panel" data-menu="${p.id}"><h2>${escape(p.name)}</h2><p>${p.kind==='main'?'主餐，也可主动另加一份':'配菜 / 饮品'}</p><p>商品 ¥${yuan(Math.min(...p.configurations.map(c=>c.price_fen)))}${p.configurations.length>1?'起':''} · 每份包装 ¥${yuan(p.packaging_fee_fen_per_unit)}</p><div class="toolbar"><button class="secondary" data-action="add" data-product="${p.id}">加一份</button>${p.kind==='main'?`<button class="text-button" data-action="replace-main" data-product="${p.id}">换为主餐</button>`:''}</div></article>`).join('')}</section><aside class="panel"><h2>本次购物车</h2>${st.cart.map((line,index)=>{const p=data.products.find(p=>p.id===line.product_id),c=p.configurations.find(c=>c.id===line.configuration_id);return `<div class="cart-entry" data-line="${index}"><h3>${escape(p.name)}</h3><p>${line.role==='main'?'主餐':'主动加菜'} · ${c?escape(specs(c.option_values)):'待补规格'}</p><div class="toolbar"><button class="secondary" data-action="quantity" data-index="${index}" data-quantity="${line.quantity-1}" aria-label="减少第${index+1}行数量">−</button><span>数量 ${line.quantity}</span><button class="secondary" data-action="quantity" data-index="${index}" data-quantity="${line.quantity+1}" aria-label="增加第${index+1}行数量">＋</button><button class="text-button" data-action="remove" data-index="${index}">删除</button>${p.spec_groups.length?`<button class="text-button" data-action="line-spec" data-index="${index}">调整规格</button>`:''}</div></div>`;}).join('')}<p class="cart-error" role="status">${result.valid?'':escape(ERROR_LABELS[result.error_code]??result.error_code)}</p>${result.valid?`<div class="bill-total"><span>合计</span><strong data-testid="total">¥${yuan(result.amounts_fen.total)}</strong></div>`:''}<button class="primary full" data-action="continue" ${result.valid?'':'disabled'}>去结算</button><button class="text-button" data-action="preferences">编辑要求</button></aside></div></main>`;
}
