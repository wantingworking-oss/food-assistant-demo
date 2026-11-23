import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {recommend,mealKind} from '../src/domain/recommend.js';
import {fromSetup} from './fixture-adapter.js';
import {createStore} from '../src/state/store.js';
const original=JSON.parse(readFileSync(new URL('../fixtures/mock-data.json',import.meta.url),'utf8'));
const setup=(data,extra={})=>fromSetup(data,{user_id:'U_A',address_id:'A01',scene:{current_soft:{staple:['noodle']},...extra}});
test('N01 noodle mains lead optional noodle meals even when long-term taste scores differ',()=>{
 const data=structuredClone(original),r=recommend(data,setup(data,{current_excluded:['chicken']}));
 assert.deepEqual(r.display_product_ids,['P04','P05','P09']);assert.equal(r.items.P09.meal_kind,'noodle_side');assert.equal(r.items.P05.meal_kind,'noodle_main');
 assert.deepEqual(r.items.P09.selected_options,{});assert.deepEqual(r.items.P09.missing_specs,['staple']);
});
test('N02 previously skipped first noodle main cannot promote tofu ahead of another noodle main',()=>{
 const data=structuredClone(original),r=recommend(data,setup(data,{current_excluded:['chicken'],skipped_products:['P04']}));
 assert.equal(r.display_product_ids[0],'P05');assert.equal(r.items.P05.meal_kind,'noodle_main');
});
test('N03 no eligible noodle main produces an explicit unmet result without automatic food substitution',()=>{
 const data=structuredClone(original),r=recommend(data,setup(data,{current_excluded:['chicken'],skipped_products:['P04','P05']}));
 assert.equal(r.status,'no_matching_noodle_main');assert.deepEqual(r.display_product_ids,[]);assert.equal(r.noodle_intent.alternatives_available,true);assert.equal(r.alternative_product_ids[0],'P09');
});
test('N04 explicit alternatives preserve exclusions and never revive an unsafe chicken dish',()=>{
 const data=structuredClone(original),input=setup(data,{current_excluded:['chicken'],skipped_products:['P04','P05']});input.task.allow_noodle_alternatives=true;
 const r=recommend(data,input);assert.equal(r.status,'showing_noodle_alternatives');assert.equal(r.display_product_ids[0],'P09');assert.equal(r.items.P06,undefined);assert.equal(r.noodle_intent.found,false);
});
test('N05 saved rice or no-staple selections are not silently converted to noodle sides',()=>{
 const data=structuredClone(original),input=setup(data,{selected_options:{P09:{staple:'rice'}}});
 const r=recommend(data,input);assert.equal(r.items.P09.configuration_id,'rice');assert.equal(r.items.P09.meal_kind,'other');assert.deepEqual(input.selections.P09,{staple:'rice'});
});
test('N06 classification uses structured category, supports explicit catalog type, and never matches names',()=>{
 const config={attributes:{staple:'noodle',cuisine:'home'}};assert.equal(mealKind({name:'超好吃面条'},config),'noodle_side');
 assert.equal(mealKind({meal_kind:'noodle_main'},config),'noodle_main');assert.equal(mealKind({meal_kind:'noodle_main'},{attributes:{staple:'rice'}}),'other');
});
test('N07 hard exclusions and stock still remove noodle mains before intent ranking',()=>{
 const data=structuredClone(original),input=setup(data,{current_excluded:['chicken','egg','beef']});
 const r=recommend(data,input);assert.equal(r.status,'no_matching_noodle_main');assert.equal(r.items.P04,undefined);assert.equal(r.items.P05,undefined);assert.equal(r.items.P06,undefined);
 const stock=recommend(data,setup(data,{unavailable_products:['P04','P05','P06']}));assert.equal(stock.status,'no_matching_noodle_main');
});
test('N08 alternative consent persists for the meal and resets when requirements change',()=>{
 const memory=new Map(),storage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)},store=createStore(original,{storage});
 store.dispatch({type:'APPLY_REQUIREMENTS',scope:'current',value:{soft_preferences:{staple:['noodle']},excluded_ingredients:['chicken']}});
 for(const id of ['P04','P05'])store.dispatch({type:'SKIP_PRODUCT',product_id:id});
 assert.equal(store.recommendations().status,'no_matching_noodle_main');store.dispatch({type:'ALLOW_NOODLE_ALTERNATIVES',allow:true});
 assert.equal(createStore(original,{storage}).recommendations().status,'showing_noodle_alternatives');
 store.dispatch({type:'APPLY_REQUIREMENTS',scope:'current',value:{soft_preferences:{staple:['noodle'],portion:['small']},excluded_ingredients:['chicken']}});
 assert.equal(store.state.task.allow_noodle_alternatives,false);assert.deepEqual(store.state.current.excluded_ingredients,['chicken']);
});
test('N09 no inventory reports no match without inventing a noodle meal',()=>{
 const data=structuredClone(original),input=setup(data,{unavailable_products:data.products.filter(p=>p.kind==='main').map(p=>p.id)});
 const r=recommend(data,input);assert.equal(r.status,'no_match');assert.deepEqual(r.display_product_ids,[]);assert.equal(r.noodle_intent.alternatives_available,false);
});
test('N10 a hard nonspicy requirement selects a valid noodle configuration before ranking',()=>{
 const data=structuredClone(original),r=recommend(data,setup(data,{current_excluded:['chicken','egg'],current_hard:{spiciness:['none']}}));
 assert.equal(r.display_product_ids[0],'P05');assert.equal(r.items.P05.configuration_id,'none');
});
test('N11 explicit incompatible noodle specification is never bypassed by intent priority',()=>{
 const data=structuredClone(original),r=recommend(data,setup(data,{current_excluded:['chicken','egg'],current_hard:{spiciness:['none']},selected_options:{P05:{spiciness:'mild'}}}));
 assert.equal(r.status,'no_matching_noodle_main');assert.equal(r.items.P05,undefined);assert.deepEqual(r.exclusions.P05,['HARD_ATTRIBUTE']);
});
