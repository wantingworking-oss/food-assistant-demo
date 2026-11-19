import {PARSER_VERSION} from './src/domain/ai-contract.js';
import {apiUrl,aiHeaders,setAccessCode,remoteAPI} from './api.js';
export function createAI({data,store,escape:e,render,perform,toast}){
 let draft='',busy=false,last=null,clarification=null,owner=store.state.user_id,task=store.state.task.task_id,controller=null,health=null;
 const labels={set_soft:'偏好',remove_soft:'移除偏好',add_excluded:'排除食材',remove_excluded:'取消排除',set_hard:'硬约束',remove_hard:'移除硬约束',set_repeat:'重复规则',propose_exception:'临时例外',undo_last:'撤销',clear_current:'清除本餐'};
 const describe=op=>`${op.scope==='long_term'?'长期':op.scope==='current'?'本餐':'历史建议'} · ${labels[op.op]}：${op.values.map(v=>data.dictionaries.ingredient_labels[v]??({noodle:'面食',rice:'米饭',low:'少油',none:'无 / 不辣',false:'非油炸',true:'油炸',allow:'允许重复',previous_meal:'上一餐',yesterday_same_meal:'昨天同餐'})[v]??v).join('、')}（来源：${op.evidence}）`;
 const sync=()=>{const s=store.state;if(s.user_id!==owner||s.task.task_id!==task){controller?.abort();busy=false;draft='';last=null;clarification=null;owner=s.user_id;task=s.task.task_id;}if(clarification&&clarification.version!==s.versions.requirements)clarification=null;};
 function markup(){
  sync();const cache=store.historyCache(),current=store.state;
  const availability=health?.ai?.status==='unavailable'?'AI服务当前不可用':health?.ai?.available?'真实AI已连接':health?.ai?.configured?'模型已配置，等待实际调用验证':'AI尚未配置 / 当前为手动模式';
  return `<section class="ai-panel panel" aria-labelledby="ai-title"><h2 id="ai-title">说说这餐有什么变化</h2><p class="muted">${availability}。也可以直接编辑要求，选餐不依赖AI。</p><form id="ai-input-form"><label for="ai-text">本餐要求（最多500字）</label><textarea id="ai-text" maxlength="500" rows="2" placeholder="例如：今天想吃面，不要鸡肉">${e(draft)}</textarea><div class="toolbar"><button class="primary" type="submit" ${busy?'disabled':''}>${busy?'正在理解…':'理解并应用'}</button><button class="secondary" type="button" data-action="preferences">手动编辑</button><button class="text-button" type="button" data-ai="history" ${busy?'disabled':''}>整理历史备注</button><button class="text-button" type="button" data-ai="history-refresh" ${busy?'disabled':''}>重新整理</button></div></form><p class="muted">AI只理解饮食要求，不直接改规格、算费用或下单。</p>
  ${remoteAPI||health?.ai?.auth_required?`<details><summary>AI服务访问码</summary><p class="muted">向提供本体验的人获取访问码，仅保存在当前标签页。</p><label>体验访问码<input id="ai-access-code" type="password" autocomplete="off" maxlength="200"></label><div class="toolbar"><button type="button" class="secondary" data-ai="save-code">保存访问码</button><button type="button" class="text-button" data-ai="clear-code">清除访问码</button></div></details>`:''}
  <div id="ai-result" role="status">${last?`<p>${e(last.message)}</p>${(last.applied??[]).map(op=>`<p>已应用：${e(describe(op))}</p>`).join('')}${(last.deferred??[]).map(op=>`<p>待确认：${e(describe(op))}</p>`).join('')}${[...(last.skipped??[]),...(last.unsupported_parts??[])].map(x=>`<p>未应用「${e(x.evidence)}」：${e(x.reason)}</p>`).join('')}`:''}</div>
  ${clarification?`<div class="ai-clarifications"><h3>还需要确认含义</h3>${clarification.items.map(c=>`<p>${e(c.question)}</p><div class="toolbar">${c.options.map(o=>`<button class="secondary" data-ai="clarify" data-label="${e(o.label)}">${e(o.label)}</button>`).join('')}</div>`).join('')}<p>也可在上方输入框补充说明；只处理尚未明确部分。</p></div>`:''}
  ${cache?`<details class="history-ai" open><summary>历史整理 · 待确认建议</summary><p class="muted">来源未变时复用解析结果（约定 ${PARSER_VERSION}）。未确认不改变推荐。</p>${cache.response.operations.map((op,i)=>cache.dismissed.includes('op:'+i)?'':`<article class="history-suggestion"><p>${e(describe(op))}</p><p>记录 ${e(op.source_record_id)} · ${op.scope==='historical_meal'?'仅属于历史那一餐':'范围待确认'}</p><div class="toolbar">${op.scope==='unresolved'?`<button class="secondary" data-ai="accept" data-item="op:${i}" data-scope="current">仅本餐使用</button><button class="secondary" data-ai="accept" data-item="op:${i}" data-scope="long_term">设为长期要求</button>`:''}<button class="text-button" data-ai="dismiss" data-item="op:${i}">忽略</button></div></article>`).join('')}${cache.response.record_annotations.map((a,i)=>cache.dismissed.includes('ann:'+i)?'':`<article class="history-suggestion"><p>记录 ${e(a.source_record_id)}：${e(a.evidence)}</p>${a.fulfillment_note?`<p>履约备注：${e(a.fulfillment_note)}（不改变饮食要求）</p>`:''}${a.belongs_to_user!==null?`<p>建议归属：${a.belongs_to_user?'本人':'非本人'}</p><button class="secondary" data-ai="accept" data-item="ann:${i}">确认归属</button>`:''}<button class="text-button" data-ai="dismiss" data-item="ann:${i}">忽略</button></article>`).join('')}${cache.response.operations.length+cache.response.record_annotations.length===0?'<p>没有可应用的饮食或归属建议。</p>':''}${cache.response.unsupported_parts.map(u=>`<p>${e(u.reason)}</p>`).join('')}</details>`:''}</section>`;
 }
 async function request(mode,force=false,text=draft){
  sync();if(busy)return;
  if(mode==='history_notes'&&!force&&store.historyCache()){last={message:'已复用未变化来源的历史整理结果。'};render();return;}
  if(mode==='user_input'&&(!text.trim()||[...text].length>500)){toast('请输入1至500字的要求。');return;}
  const started=store.dispatch({type:'AI_BEGIN',mode,text:mode==='history_notes'?'':text,clarification:clarification?JSON.stringify({original:clarification.original,questions:clarification.items}):null});
  if(!started.ok){toast(started.reason);return;}
  const req=started.request;const boundUser=req.context.user_id;busy=true;last={message:'正在理解，原有条件仍然有效…'};const activeController=new AbortController();controller=activeController;render();
  const timer=setTimeout(()=>activeController.abort(),22000);
  try{
   const response=await fetch(apiUrl('interpret'),{method:'POST',headers:aiHeaders(),body:JSON.stringify(req),signal:activeController.signal});
   let body;try{body=await response.json();}catch{throw new Error('未连接AI后端，可手动编辑要求。');}
   const state=store.state;
   if(state.user_id!==boundUser||state.task.task_id!==req.task_id||state.versions.requirements!==req.requirements_version||state.ai_request?.request_id!==req.request_id){if(state.user_id===boundUser&&state.task.task_id===req.task_id)last={message:'要求已变化，旧AI结果已丢弃。'};return;}
   if(!response.ok||body.status==='unavailable')throw new Error(body.error?.message??'AI暂不可用，请重试或手动编辑。');
   const result=store.dispatch({type:'AI_RESULT',response:body});
   if(result.stale){last={message:result.reason};return;}
   if(!result.ok)throw new Error(result.reason);
   last={...result,message:result.history?'历史备注已整理，请逐项确认。':result.applied?.length?'明确部分已应用，请查看更新后的要求。':result.needs_confirmation?'已识别，等待确认后才生效。':'已解析，请查看待澄清或未应用内容。'};
   clarification=result.clarifications?.length?{original:text,items:result.clarifications,version:store.state.versions.requirements}:null;
   if(result.needs_confirmation)perform(result);
   health={ai:{configured:true,available:true}};
  }catch(error){const s=store.state;if(controller===activeController&&s.user_id===boundUser&&s.task.task_id===req.task_id){if(health?.ai?.configured)health={ai:{...health.ai,available:false,status:'unavailable'}};last={message:error.name==='AbortError'?'请求超时或已取消，原条件保留。请重试或手动编辑。':error.message};store.dispatch({type:'AI_END',request_id:req.request_id});}}
  finally{clearTimeout(timer);if(controller===activeController){busy=false;controller=null;}render();}
 }
 document.addEventListener('input',event=>{if(event.target.id==='ai-text')draft=event.target.value;});
 document.addEventListener('submit',event=>{if(event.target.id==='ai-input-form'){event.preventDefault();request('user_input');}});
 document.addEventListener('click',event=>{
  const button=event.target.closest('[data-ai]');if(!button)return;
  if(button.dataset.ai==='save-code'){const value=document.querySelector('#ai-access-code')?.value;if(value?.trim()){setAccessCode(value);toast('访问码已保存到当前标签页。');render();}else toast('请输入体验访问码。');}
  if(button.dataset.ai==='clear-code'){setAccessCode('');toast('已清除当前标签页访问码。');render();}
  if(button.dataset.ai==='history'||button.dataset.ai==='history-refresh')request('history_notes',button.dataset.ai==='history-refresh');
  if(button.dataset.ai==='clarify'){draft=button.dataset.label;request('user_input',false,draft);}
  if(button.dataset.ai==='dismiss')perform(store.dispatch({type:'HISTORY_AI_DISMISS',item_id:button.dataset.item}));
  if(button.dataset.ai==='accept')perform(store.dispatch({type:'HISTORY_AI_ACCEPT',item_id:button.dataset.item,scope:button.dataset.scope}));
 });
 fetch(apiUrl('health')).then(r=>r.ok?r.json():null).then(value=>{health=value;render();}).catch(()=>{});
 return {markup};
}
