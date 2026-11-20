import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createStore,createRequirementsDraft} from '../src/state/store.js';
import {requirementsSnapshot} from '../src/state/requirements.js';
const data=JSON.parse(readFileSync(new URL('../fixtures/mock-data.json',import.meta.url),'utf8'));
const fresh=()=>createStore(data,{storage:{getItem:()=>null,setItem:()=>{}}});
const edit=(s,value,scope='current')=>s.dispatch({type:'APPLY_REQUIREMENTS',scope,value});
const commit=(live,draft,base=live.state.versions.requirements)=>live.dispatch({type:'APPLY_REQUIREMENTS_DRAFT',base_version:base,value:requirementsSnapshot(draft.state)});
test('E01 editor combines changes in isolation and applies them as one undoable change',()=>{
 const live=fresh(),draft=createRequirementsDraft(data,live.state);
 edit(draft,{excluded_ingredients:['chicken'],soft_preferences:{staple:['noodle']}});
 edit(draft,{excluded_ingredients:['chicken','cilantro'],soft_preferences:{staple:['noodle'],oil:['low']}});
 assert.deepEqual(live.state.current.excluded_ingredients,[]);
 assert.equal(commit(live,draft).ok,true);assert.deepEqual(live.state.current.excluded_ingredients,['chicken','cilantro']);
 assert.equal(live.state.versions.requirements,1);live.dispatch({type:'UNDO_LAST_CHANGE'});assert.deepEqual(live.state.current.soft_preferences,{});
});
test('E02 previewed exception requires confirmation again on the live store',()=>{
 const live=fresh(),draft=createRequirementsDraft(data,live.state),proposal=draft.dispatch({type:'PROPOSE_EXCEPTION',field:'ingredients',value:'peanut'});
 draft.dispatch({type:'CONFIRM_CHANGE',token:proposal.token});const result=commit(live,draft);
 assert.equal(result.needs_confirmation,true);assert.deepEqual(live.state.confirmed_exceptions.ingredients,[]);
 live.dispatch({type:'CANCEL_CHANGE'});assert.deepEqual(live.state.confirmed_exceptions.ingredients,[]);
 const again=commit(live,draft);assert.equal(live.dispatch({type:'CONFIRM_CHANGE',token:again.token}).ok,true);
 assert.deepEqual(live.state.confirmed_exceptions.ingredients,['peanut']);assert.deepEqual(live.state.profile.long_term.excluded_ingredients,['peanut']);
});
test('E03 stale editor cannot replace newer requirements',()=>{
 const live=fresh(),draft=createRequirementsDraft(data,live.state),base=live.state.versions.requirements;
 edit(draft,{soft_preferences:{staple:['noodle']}});edit(live,{excluded_ingredients:['chicken']});
 assert.equal(commit(live,draft,base).ok,false);assert.deepEqual(live.state.current.excluded_ingredients,['chicken']);assert.deepEqual(live.state.current.soft_preferences,{});
});
test('E04 combined scopes validate the final draft and confirm restriction removal',()=>{
 const live=fresh();assert.equal(edit(live,{excluded_ingredients:['peanut'],hard_attributes:{staple:['rice']},soft_preferences:{},repeat_rule:live.state.profile.long_term.repeat_rule},'long_term').ok,true);
 const next=requirementsSnapshot(live.state);next.long_term.hard_attributes={};next.current.soft_preferences.staple=['noodle'];
 const result=live.dispatch({type:'APPLY_REQUIREMENTS_DRAFT',base_version:live.state.versions.requirements,value:next});assert.equal(result.needs_confirmation,true);
 assert.deepEqual(live.state.profile.long_term.hard_attributes.staple,['rice']);live.dispatch({type:'CONFIRM_CHANGE',token:result.token});assert.deepEqual(live.state.current.soft_preferences.staple,['noodle']);
});
test('E05 conflicting final draft and unknown exception are rejected atomically',()=>{
 const live=fresh(),base=live.state.versions.requirements,next=requirementsSnapshot(live.state);
 next.long_term.hard_attributes.staple=['rice'];next.current.soft_preferences.staple=['noodle'];
 assert.equal(live.dispatch({type:'APPLY_REQUIREMENTS_DRAFT',base_version:base,value:next}).ok,false);assert.deepEqual(live.state.current.soft_preferences,{});
 next.current.soft_preferences={};next.exceptions.ingredients=['unknown-food'];assert.equal(live.dispatch({type:'APPLY_REQUIREMENTS_DRAFT',base_version:base,value:next}).ok,false);
});
test('E06 deleting a live exclusion in a draft cannot bypass confirmation',()=>{
 const live=fresh();edit(live,{excluded_ingredients:['chicken']});const next=requirementsSnapshot(live.state);next.current.excluded_ingredients=[];
 const result=live.dispatch({type:'APPLY_REQUIREMENTS_DRAFT',base_version:live.state.versions.requirements,value:next});assert.equal(result.needs_confirmation,true);assert.deepEqual(live.state.current.excluded_ingredients,['chicken']);
});
