// This script makes actual paid API calls only when credentials are configured.
// Fixture answers are assertions, never model input or application routing rules.
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {sanitizeRequest} from '../src/ai/adapter.js';
import {createValidationClient} from '../src/ai/validation-client.js';
import {createStore} from '../src/state/store.js';
import {modelEvidence} from '../src/ai/model-evidence.js';
const data=JSON.parse(await readFile(new URL('../fixtures/mock-data.json',import.meta.url),'utf8'));
const fixture=JSON.parse(await readFile(new URL('../fixtures/ai-semantic-cases.json',import.meta.url),'utf8'));
const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
const round=process.argv[2]??'round6';if(!/^round\d+$/.test(round))throw new Error('Expected roundN');
let currentRow=null;
const client=createValidationClient({fetchImpl:async(url,options)=>{const response=await fetch(url,options);if(currentRow&&response.ok&&!process.env.AI_TEST_BASE_URL){const body=await response.clone().json().catch(()=>null);if(body)Object.assign(currentRow,modelEvidence(body));}return response;}}),diagnostics=await client.readiness(),configured=diagnostics.ready;
const report={version:pkg.version,dataset_version:data.dataset_version,checked_at:new Date().toISOString(),model:diagnostics.model??null,transport:client.transport,diagnostics,status:configured?'running':'blocked',reason:diagnostics.reason,cases:[]};
let blockedAfterFailure=null;
const snapshot=store=>({current:store.state.current,long_term:store.state.profile.long_term,exceptions:store.state.confirmed_exceptions});
const same=(a,b)=>assert.deepEqual(a,b);
function check(c,body,before,after,result){
 const e=c.expected_semantics,ops=body.operations;
 const actionMap={remove_current_soft:'remove_soft',remove_current_excluded:'remove_excluded',propose_temporary_exception:'propose_exception',undo_last_requirements_change:'undo_last',clear_current_requirements_and_exceptions:'clear_current'};
 if(e.action){
  assert.equal(ops.length,1,'Only the requested dimension changes');const o=ops[0];same(o.op,actionMap[e.action]??e.action);
  same(o.scope,e.scope??'current');if(e.dimension)same(o.field,e.dimension);
  if(e.values)same([...o.values].sort(),[...e.values].sort());if(e.value)same(o.values,[e.value]);
 }
 if(e.soft){same(ops.length,Object.keys(e.soft).length);for(const[field,values]of Object.entries(e.soft)){assert.ok(ops.some(o=>o.op==='set_soft'&&o.scope===e.scope&&o.field===field&&JSON.stringify(o.values)===JSON.stringify(values)));same(after.current.soft_preferences[field],values);}}
 if(e.requires_clarification){assert.ok(body.clarifications.length>0);same(ops,[]);same(after,before);}
 if(e.requires_confirmation){if(e.source==='historical_note')same(after,before);else{assert.ok(result.needs_confirmation);same(after,before);}}
 if(e.long_term_unchanged||e.preserve_other_exclusions)same(after.long_term,before.long_term);
 if(e.preserve_other_conditions){const old=structuredClone(before),next=structuredClone(after);delete old.current.soft_preferences.staple;delete next.current.soft_preferences.staple;same(old,next);}
 if(e.do_not_apply_to_current_or_long_term){assert.ok(ops.length);assert.ok(ops.every(o=>o.scope==='historical_meal'&&o.source_record_id===c.context.source_record));same(after,before);}
 if(e.candidate_excluded){assert.ok(ops.some(o=>o.op==='add_excluded'&&o.scope==='unresolved'&&o.values.includes(e.candidate_excluded)));same(after,before);}
 if(e.no_personal_preference_inference||e.no_dietary_patch){same(ops,[]);same(after,before);}
 if(e.belongs_to_user===false)assert.ok(body.record_annotations.some(a=>a.belongs_to_user===false));
 if(e.fulfillment_only||e.fulfillment_note)assert.ok(body.record_annotations.some(a=>a.fulfillment_note?.includes(e.fulfillment_note??c.input)));
 if(!e.requires_confirmation&&!e.source&&!e.requires_clarification&&e.action){
  const scope=e.scope==='long_term'?'long_term':'current',v=e.values??[e.value];
  if(e.action==='set_soft')same(after[scope].soft_preferences[e.dimension],v);
  if(e.action==='set_hard')same(after[scope].hard_attributes[e.dimension],v);
  if(e.action==='add_excluded')assert.ok(after[scope].excluded_ingredients.includes(e.value));
  if(e.action==='set_repeat')same(after[scope].repeat_rule,e.value);
  if(e.action==='remove_current_soft')assert.equal(after.current.soft_preferences[e.dimension],undefined);
  if(e.action==='remove_current_excluded')assert.ok(!after.current.excluded_ingredients.includes(e.value));
  if(e.action==='clear_current_requirements_and_exceptions'){same(after.current.soft_preferences,{});same(after.current.excluded_ingredients,[]);same(after.exceptions,{ingredients:[],hard_attributes:{}});}
  if(e.action==='undo_last_requirements_change')same(after.current.soft_preferences,{});
 }
}
for(const c of fixture.cases){
 const row={id:c.id,input:c.input,context:c.context,expected:c.expected_semantics,status:'not_run'};report.cases.push(row);
 if(!configured||blockedAfterFailure){row.reason=blockedAfterFailure??report.reason;continue;}
 try{
  const values=new Map(),store=createStore(structuredClone(data),{storage:{getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)}});
  const apply=event=>{const result=store.dispatch(event);if(result.needs_confirmation)return store.dispatch({type:'CONFIRM_CHANGE',token:result.token});assert.ok(result.ok);return result;};
  if(c.context.meal)apply({type:'CHANGE_CONTEXT',address_id:store.state.task.address_id,date:store.state.task.date,meal:c.context.meal});
  if(c.context.long_term_excluded)apply({type:'APPLY_REQUIREMENTS',scope:'long_term',value:{...store.state.profile.long_term,excluded_ingredients:c.context.long_term_excluded}});
  if(c.context.current_soft||c.context.current_excluded||c.context.undo_available||c.id==='A14')apply({type:'APPLY_REQUIREMENTS',scope:'current',value:{soft_preferences:c.context.current_soft??{oil:['low']},excluded_ingredients:c.context.current_excluded??[]}});
  const started=store.dispatch({type:'AI_BEGIN',mode:c.context.source_record?'history_notes':'user_input',text:c.context.source_record?'':c.input});
  if(c.context.source_record)started.request.history_notes=started.request.history_notes.filter(n=>n.id===c.context.source_record);
  const request=sanitizeRequest(started.request,data);row.request=request;row.before=snapshot(store);
  currentRow=row;const actual=await client.run(request,data);row.response=actual.result;row.metrics=actual.metrics;
  const result=store.dispatch({type:'AI_RESULT',response:actual.result});assert.ok(result.ok);row.state_result=result;row.after_unconfirmed=snapshot(store);
  // Destructive changes are confirmed by this test driver, as in the UI.
  if(result.needs_confirmation&&!c.expected_semantics.requires_confirmation)apply({type:'CONFIRM_CHANGE',token:result.token});
  row.after=snapshot(store);
  check(c,actual.result,row.before,row.after,result);
  if(c.expected_semantics.action==='propose_temporary_exception'){apply({type:'CONFIRM_CHANGE',token:result.token});row.after_confirmation=snapshot(store);assert.ok(row.after_confirmation.exceptions.ingredients.includes(c.expected_semantics.value));same(row.after_confirmation.long_term,row.before.long_term);}
  row.status='passed';
 }catch(error){if(['AI_NOT_CONFIGURED','AI_AUTH_ERROR','AI_QUOTA_EXCEEDED','AI_RATE_LIMIT','AI_CONNECTION_FAILED','AI_TIMEOUT','BACKEND_UNREACHABLE','ACCESS_CODE_REQUIRED'].includes(error.message))blockedAfterFailure=error.message;row.status='failed';row.reason=error.code==='ERR_ASSERTION'?error.message:'Model/validation failure: '+(['AI_NOT_CONFIGURED','AI_TIMEOUT','AI_AUTH_ERROR','AI_RATE_LIMIT','AI_QUOTA_EXCEEDED','AI_CONNECTION_FAILED','AI_REFUSED','AI_INCOMPLETE','OUTPUT_FORMAT','INVALID_REQUEST'].includes(error.message)?error.message:(/^[A-Z][A-Z0-9_]{1,60}$/.test(error.message)?error.message:'AI_CALL_OR_CONTRACT_ERROR'));}
 // Persist partial actual evidence if interrupted; no API key or HTTP headers.
 await writeFile(new URL(`../docs/validation/${round}-ai.json`,import.meta.url),JSON.stringify(report,null,2)+'\n');
 console.log(`${row.id}: ${row.status}`);
}
report.summary={passed:report.cases.filter(c=>c.status==='passed').length,failed:report.cases.filter(c=>c.status==='failed').length,not_run:report.cases.filter(c=>c.status==='not_run').length};
if(blockedAfterFailure)report.reason=blockedAfterFailure;
report.status=!configured?'blocked':report.summary.failed?'failed':'passed';
await writeFile(new URL(`../docs/validation/${round}-ai.json`,import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,...report.summary,reason:report.reason}));
if(report.status!=='passed')process.exitCode=2;
