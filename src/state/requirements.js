import { matches, DIMENSIONS, REPEAT_RULES } from '../domain/requirements.js';

export const emptyRequirements = () => ({ excluded_ingredients: [], soft_preferences: {}, hard_attributes: {} });
export function normalizeRequirements(data, value, historical = false) {
  const clean = emptyRequirements();
  const source = historical ? { soft_preferences: value } : value;
  if (!source || typeof source !== 'object') throw new Error('要求格式无效。');
  for (const id of source.excluded_ingredients ?? []) {
    if (!data.dictionaries.ingredients.includes(id)) throw new Error('当前无法核实该食材。');
    if (!clean.excluded_ingredients.includes(id)) clean.excluded_ingredients.push(id);
  }
  for (const field of ['soft_preferences', 'hard_attributes']) {
    for (const [dimension, values] of Object.entries(source[field] ?? {})) {
      if (!DIMENSIONS.includes(dimension) || !Array.isArray(values) || !values.length) throw new Error('请选择支持的要求值。');
      const allowed = [...data.dictionaries.attributes[dimension].filter(value => value !== null), ...(dimension === 'staple' ? ['any'] : [])];
      if (values.some(value => !allowed.includes(value))) throw new Error('要求值不受支持。');
      clean[field][dimension] = [...new Set(values)];
    }
  }
  if (source.repeat_rule !== undefined) {
    if (!REPEAT_RULES.includes(source.repeat_rule)) throw new Error('重复规则无效。');
    clean.repeat_rule = source.repeat_rule;
  }
  return historical ? clean.soft_preferences : clean;
}

export function requirementsSnapshot(state) {
  return structuredClone({ long_term: state.profile.long_term, historical: state.profile.historical_soft_preferences,
    current: state.current, exceptions: state.confirmed_exceptions });
}
export function restoreRequirements(state, snapshot) {
  state.profile.long_term = structuredClone(snapshot.long_term);
  state.profile.historical_soft_preferences = structuredClone(snapshot.historical);
  state.current = structuredClone(snapshot.current);
  state.confirmed_exceptions = structuredClone(snapshot.exceptions);
}

// All manual editing goes through the same planner that a future AI adapter
// will use. A confirmation token refers to a specific immutable proposal.
export function planRequirements(data, state, event) {
  const next = requirementsSnapshot(state), messages = [];
  const names = data.dictionaries.ingredient_labels;
  if (event.type === 'CLEAR_CURRENT_REQUIREMENTS') {
    next.current = emptyRequirements(); next.exceptions = { ingredients: [], hard_attributes: {} };
  } else if (event.type === 'PROPOSE_EXCEPTION') {
    if (event.field === 'ingredients') {
      if (!state.profile.long_term.excluded_ingredients.includes(event.value)) throw new Error('该食材没有长期排除要求。');
      if (!next.exceptions.ingredients.includes(event.value)) next.exceptions.ingredients.push(event.value);
      messages.push(`仅本餐允许${names[event.value]}；长期排除保留。独立的本餐排除仍然有效。`);
    } else {
      const values = state.profile.long_term.hard_attributes[event.field];
      if (!values) throw new Error('该维度没有长期硬约束。');
      next.exceptions.hard_attributes[event.field] = [...values];
      messages.push(`仅本餐豁免长期${dimensionLabel(event.field)}硬约束，其他要求不变。`);
    }
  } else {
    if (!['current', 'long_term', 'historical'].includes(event.scope)) throw new Error('要求范围无效。');
    const value = normalizeRequirements(data, event.value, event.scope === 'historical');
    if (event.scope === 'historical') { next.historical = value; }
    else {
      const previous = next[event.scope];
      next[event.scope] = value;
      if (event.scope === 'long_term' && value.repeat_rule === undefined) value.repeat_rule = 'allow';
      for (const ingredient of previous.excluded_ingredients) {
        if (!value.excluded_ingredients.includes(ingredient)) messages.push(`取消${event.scope === 'current' ? '本餐' : '长期'}「不吃${names[ingredient]}」。`);
      }
      for (const [dimension, accepted] of Object.entries(previous.hard_attributes)) {
        if (JSON.stringify(value.hard_attributes[dimension]) !== JSON.stringify(accepted)) {
          messages.push(`修改${event.scope === 'current' ? '本餐' : '长期'}的${dimensionLabel(dimension)}硬约束。`);
        }
      }
      const previousRule = state.current.repeat_rule ?? state.profile.long_term.repeat_rule;
      const nextRule = next.current.repeat_rule ?? next.long_term.repeat_rule;
      if (previousRule !== 'allow' && previousRule !== nextRule) messages.push('改变已有避重范围，可能重新允许此前排除的主菜。');
    }
  }
  // Contradictory layers cannot silently overwrite each other. The user may
  // first explicitly exempt the long-term constraint using PROPOSE_EXCEPTION.
  for (const dimension of DIMENSIONS) {
    const long = next.long_term.hard_attributes[dimension];
    const current = next.current.hard_attributes[dimension];
    const exempt = long && long.every(value => next.exceptions.hard_attributes[dimension]?.includes(value));
    const soft = next.current.soft_preferences[dimension];
    if (long && !exempt && [current, soft].some(values => values && !data.dictionaries.attributes[dimension].some(value => matches(dimension, value, long) && matches(dimension, value, values)))) {
      throw new Error(`本餐${dimensionLabel(dimension)}与长期硬约束冲突。请先确认对应的本餐例外，或修改冲突要求。`);
    }
    if (current && soft && !data.dictionaries.attributes[dimension].some(value => matches(dimension, value, current) && matches(dimension, value, soft))) throw new Error(`本餐${dimensionLabel(dimension)}的偏好与硬约束冲突，请先核对。`);
  }
  return { next, messages };
}
export function dimensionLabel(dimension) {
  return ({ spiciness: '辣度', oil: '油量', fried: '油炸方式', staple: '主食', cuisine: '菜系', portion: '份量' })[dimension] ?? dimension;
}

// Validate a combined editor draft and recompute confirmations against live
// requirements. Confirming a preview in an isolated draft never exempts this check.
export function planRequirementsDraft(data,state,value){
  if(!value||!Array.isArray(value.exceptions?.ingredients)||!value.exceptions.hard_attributes)throw new Error('要求草稿无效。');
  const next={long_term:normalizeRequirements(data,value.long_term),current:normalizeRequirements(data,value.current),
    historical:normalizeRequirements(data,value.historical,true),exceptions:{ingredients:[],hard_attributes:{}}};
  for(const id of value.exceptions.ingredients){
    if(!data.dictionaries.ingredients.includes(id))throw new Error('临时例外食材无效。');
    if(next.long_term.excluded_ingredients.includes(id)&&!next.exceptions.ingredients.includes(id))next.exceptions.ingredients.push(id);
  }
  const hard=normalizeRequirements(data,{hard_attributes:value.exceptions.hard_attributes}).hard_attributes;
  for(const [field,values]of Object.entries(hard)){
    const baseline=next.long_term.hard_attributes[field];
    if(baseline&&baseline.every(v=>values.includes(v))&&values.every(v=>baseline.includes(v)))next.exceptions.hard_attributes[field]=values;
  }
  const finalState=structuredClone(state);restoreRequirements(finalState,next);
  const messages=[];
  for(const scope of ['long_term','current']){
    const check=structuredClone(finalState);
    if(scope==='long_term')check.profile.long_term=structuredClone(state.profile.long_term);else check.current=structuredClone(state.current);
    messages.push(...planRequirements(data,check,{type:'APPLY_REQUIREMENTS',scope,value:next[scope]}).messages);
  }
  for(const id of next.exceptions.ingredients)if(!state.confirmed_exceptions.ingredients.includes(id))messages.push(`仅本餐允许${data.dictionaries.ingredient_labels[id]}；长期排除保留。`);
  for(const [field,values]of Object.entries(next.exceptions.hard_attributes))if(JSON.stringify(values)!==JSON.stringify(state.confirmed_exceptions.hard_attributes[field]))messages.push(`仅本餐豁免长期${dimensionLabel(field)}硬约束。`);
  return {next,messages:[...new Set(messages)]};
}
