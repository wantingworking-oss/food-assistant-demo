export const MEALS = ['breakfast', 'lunch', 'dinner'];

export function shiftDate(isoDate, offset) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  if (!Number.isInteger(offset) || !Number.isFinite(date.valueOf()) || date.toISOString().slice(0, 10) !== isoDate) {
    throw new Error('DATA_ERROR: invalid date');
  }
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

export function demoDate(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function resolveHistory(data, profile, task, repeatRule, corrections = {}) {
  const anchor = task.anchor_date;
  const date = task.date ?? anchor;
  shiftDate(date, 0);
  if (!MEALS.includes(task.meal)) throw new Error('DATA_ERROR: invalid meal');
  const productMap = new Map(data.products.map(product => [product.id, product]));
  const records = [];
  const seen = new Set();
  for (const id of profile.history_record_ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    const original = data.history.find(record => record.id === id);
    if (!original) throw new Error(`DATA_ERROR: unknown history ${id}`);
    const record = { ...original, ...corrections[id] };
    if (record.user_id !== profile.id || record.belongs_to_user !== true ||
        ['cancelled', 'failed'].includes(record.order_status) ||
        (!record.consumed_confirmed && record.order_status !== 'completed')) continue;
    const recordDate = record.date ?? shiftDate(anchor, record.day_offset);
    shiftDate(recordDate, 0);
    if (!MEALS.includes(record.meal)) throw new Error('DATA_ERROR: invalid historical meal');
    if (recordDate > date || (recordDate === date && MEALS.indexOf(record.meal) >= MEALS.indexOf(task.meal))) continue;
    records.push({ ...record, date: recordDate });
  }
  let relevant = [];
  if (repeatRule === 'yesterday_same_meal') {
    relevant = records.filter(record => record.date === shiftDate(date, -1) && record.meal === task.meal);
  } else if (repeatRule === 'previous_meal') {
    const ordered = [...records].sort((a, b) => b.date.localeCompare(a.date) || MEALS.indexOf(b.meal) - MEALS.indexOf(a.meal));
    if (ordered.length) relevant = ordered.filter(record => record.date === ordered[0].date && record.meal === ordered[0].meal);
  }
  const dishes = new Set();
  for (const record of relevant) for (const item of record.items) {
    const product = productMap.get(item.product_id);
    if (!product) throw new Error('DATA_ERROR: unknown history product');
    for (const id of product.canonical_main_dish_ids) dishes.add(id);
  }
  const incomplete = repeatRule !== 'allow' && relevant.length === 0;
  return { record_ids: relevant.map(record => record.id), dish_ids: [...dishes],
    blocked: incomplete && task.allow_incomplete_history !== true,
    flags: incomplete && task.allow_incomplete_history === true ? ['HISTORY_INCOMPLETE'] : [] };
}
