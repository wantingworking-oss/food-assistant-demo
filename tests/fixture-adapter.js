// Test-only translation of fixture setup into the production domain interface.
// No expected result is imported here or anywhere in runtime code.
export function fromSetup(data, setup) {
  const scene = setup.scene ?? {};
  const profile = structuredClone(data.users.find(user => user.id === setup.user_id));
  if (Object.hasOwn(scene, 'replace_long_excluded')) profile.long_term.excluded_ingredients = scene.replace_long_excluded;
  if (Object.hasOwn(scene, 'history_ids')) profile.history_record_ids = scene.history_ids;
  return { profile,
    task: { address_id: setup.address_id, anchor_date: data.clock.verification_anchor_date,
      date: data.clock.verification_anchor_date, meal: data.clock.current_meal,
      allow_incomplete_history: scene.allow_incomplete_history === true },
    current: { soft_preferences: scene.current_soft ?? {}, excluded_ingredients: scene.current_excluded ?? [],
      hard_attributes: scene.current_hard ?? {}, repeat_rule: scene.repeat_rule },
    confirmed_exceptions: { ingredients: scene.confirmed_temporary_exceptions ?? [] },
    selections: scene.selected_options ?? {}, skipped_product_ids: scene.skipped_products ?? [],
    supply: { unavailable_product_ids: scene.unavailable_products ?? [], delivery_fee_overrides: scene.delivery_fee_overrides ?? {} } };
}
