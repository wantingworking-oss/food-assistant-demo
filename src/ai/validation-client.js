import {interpret} from './adapter.js';
import {aiConfiguration} from './providers.js';

export function backendOrigin(value){
 const url=new URL(value);
 if((url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)))||url.username||url.password||url.search||url.hash||url.pathname!=='/')throw new Error('INVALID_AI_TEST_BASE_URL');
 return url.origin;
}
const positive=value=>typeof value==='string'&&Boolean(value.trim());
const codes=new Set(['AI_NOT_CONFIGURED','AI_AUTH_ERROR','AI_TIMEOUT','AI_RATE_LIMIT','AI_QUOTA_EXCEEDED','AI_CONNECTION_FAILED','AI_BUSY','ACCESS_CODE_REQUIRED','AI_VALIDATION_FAILED','AI_REFUSED','AI_INCOMPLETE','INVALID_REQUEST','ORIGIN_DENIED']);
export function createValidationClient({env=process.env,fetchImpl=fetch}={}){
 const remote=positive(env.AI_TEST_BASE_URL),token=env.AI_ACCESS_TOKEN?.trim()??'';
 const config=aiConfiguration(env);
 let origin=null,urlError=false;
 if(remote)try{origin=backendOrigin(env.AI_TEST_BASE_URL.trim());}catch{urlError=true;}
 const transport=remote?'deployed_http_backend':config.provider==='deepseek'?'direct_deepseek_chat':'direct_openai_responses';
 async function request(path,options={}){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),22000);
  try{
   const response=await fetchImpl(origin+'/api/'+path,{...options,redirect:'error',signal:controller.signal});
   let body;try{body=await response.json();}catch{throw new Error('BACKEND_RESPONSE_FORMAT');}
   if(!response.ok){const code=body?.error?.code;throw new Error(codes.has(code)?code:'BACKEND_HTTP_'+response.status);}
   return body;
  }catch(error){if(controller.signal.aborted)throw new Error('AI_TIMEOUT');if(codes.has(error.message)||/^BACKEND_(HTTP_\d+|RESPONSE_FORMAT)$/.test(error.message))throw error;throw new Error('BACKEND_UNREACHABLE');}
  finally{clearTimeout(timer);}
 }
 async function readiness(){
  const checks={transport,provider:config.provider,endpoint:origin,mode:remote?'remote':env.AI_MODE??'disabled',provider_key_present:Boolean(config.key),model_configured:Boolean(config.model),access_code_present:Boolean(token)};
  if(urlError)return {...checks,ready:false,reason:'INVALID_AI_TEST_BASE_URL'};
  if(!remote){const ready=env.AI_MODE==='real'&&checks.provider_key_present&&checks.model_configured;return {...checks,ready,reason:ready?null:'AI_NOT_CONFIGURED',model:env.FOOD_ASSISTANT_MODEL||null};}
  try{
   const health=await request('health');
   if(health.status!=='ok'||typeof health.ai?.configured!=='boolean'||!['real','disabled'].includes(health.ai?.mode))return {...checks,ready:false,reason:'BACKEND_RESPONSE_FORMAT'};
   const ready=health.ai.mode==='real'&&health.ai.configured&&(!health.ai.auth_required||Boolean(token));
   return {...checks,ready,reason:!health.ai.configured||health.ai.mode!=='real'?'AI_NOT_CONFIGURED':health.ai.auth_required&&!token?'ACCESS_CODE_REQUIRED':null,backend_version:health.version??null,previously_verified:health.ai.available===true};
  }catch(error){return {...checks,ready:false,reason:error.message};}
 }
 async function run(input,data){
  if(!remote)return interpret(input,data,{env,fetchImpl});
  if(!origin)throw new Error('INVALID_AI_TEST_BASE_URL');
  const start=Date.now();
  const result=await request('interpret',{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(input)});
  if(!result||result.status==='unavailable')throw new Error(codes.has(result?.error?.code)?result.error.code:'BACKEND_RESPONSE_FORMAT');
  // The store checks identity, schema, evidence and actual requirement effects.
  return {result,metrics:{elapsed_ms:Date.now()-start,model:null,input_tokens:null,output_tokens:null,source:'remote_backend_not_exposed'}};
 }
 return {readiness,run,transport};
}
