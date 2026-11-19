import { mergeRequirements } from './requirements.js';
import { resolveHistory } from './history.js';

export function createContext(data, input) {
  const profile = input.profile ?? data.users.find(user => user.id === input.user_id);
  if (!profile || !data.addresses.some(address => address.id === input.task.address_id)) {
    throw new Error('DATA_ERROR: unknown user or address');
  }
  const requirements = mergeRequirements(profile, input.current, input.confirmed_exceptions);
  return { data, profile, task: input.task, requirements,
    history: resolveHistory(data, profile, input.task, requirements.repeat_rule, input.history_corrections),
    selections: input.selections ?? {}, supply: input.supply ?? {},
    skipped: input.skipped_product_ids ?? [] };
}
