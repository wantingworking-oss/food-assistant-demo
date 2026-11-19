import test from 'node:test';
import assert from 'node:assert/strict';
import {modelEvidence} from '../src/ai/model-evidence.js';
import {interpret} from '../src/ai/adapter.js';
import {readFile} from 'node:fs/promises';
import {createStore} from '../src/state/store.js';
test('M01 验收证据只保留模型输出和用量，不记录供应商错误或凭证字段',()=>{assert.deepEqual(modelEvidence({error:{message:'private-key'},api_key:'private-key'}),{});const r=modelEvidence({choices:[{message:{content:'{"status":"parsed"}'}}],usage:{prompt_tokens:12,completion_tokens:4},api_key:'private-key',headers:{Authorization:'private-key'}});assert.equal(r.raw_usage.input_tokens,12);assert.ok(!JSON.stringify(r).includes('private-key'));});
test('M02 不静默修复错误食材字段名或删除操作的旧值',async()=>{const data=JSON.parse(await readFile(new URL('../fixtures/mock-data.json',import.meta.url),'utf8'));const request=createStore(data,{}).dispatch({type:'AI_BEGIN',mode:'user_input',text:'去掉油量偏好'}).request;for(const[field,values,op,error]of [['oil',['low'],'remove_soft','INVALID_VALUES'],['ingredient',['beef'],'add_excluded','OUTPUT_FORMAT']]){const output={status:'parsed',operations:[{op,field,values,scope:'current',evidence:'去掉油量偏好',source_record_id:null}],clarifications:[],unsupported_parts:[],record_annotations:[],error:null};await assert.rejects(interpret(request,data,{env:{AI_MODE:'real',AI_PROVIDER:'deepseek',DEEPSEEK_API_KEY:'test-key',FOOD_ASSISTANT_MODEL:'test-model'},fetchImpl:async()=>Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(output)}}]})}),new RegExp(error));}});
