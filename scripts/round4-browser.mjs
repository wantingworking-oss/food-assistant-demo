import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createServer} from '../server.js';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE??'playwright-core');
const round=process.argv[2]??'round5';if(!/^round\d+$/.test(round))throw new Error('Expected roundN');
const pkg=JSON.parse(await readFile('package.json','utf8'));
const browser=await chromium.launch({channel:'chrome',headless:true});
const ctx=await browser.newContext({viewport:{width:1440,height:1000}}),p=await ctx.newPage(),cases=[],errors=[];
p.on('pageerror',e=>errors.push(e.message));
const click=name=>p.getByRole('button',{name,exact:true}).click();
const state=()=>p.evaluate(()=>JSON.parse(localStorage.getItem('food-assistant:1.0.0:'+document.querySelector('#user-picker').value+':task')));
const reset=async()=>{await click('恢复示例');await p.locator('#action-dialog').getByRole('button',{name:'恢复示例',exact:true}).click();await click('进入今天吃什么');};
const edit=async fn=>{await click('手动编辑');const d=p.locator('#preferences-dialog');await fn(d);await d.getByRole('button',{name:'保存本餐要求',exact:true}).click();};
const operation=(field='staple',values=['noodle'],extra={})=>({op:'set_soft',field,values,scope:'current',evidence:'今天想吃面',source_record_id:null,...extra});
const answer=(req,operations,extra={})=>({request_id:req.request_id,task_id:req.task_id,requirements_version:req.requirements_version,mode:req.mode,status:'parsed',operations,clarifications:[],unsupported_parts:[],record_annotations:[],error:null,...extra});
const reply=(route,body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
const passed=id=>cases.push({id,status:'passed',transport:'browser_response_fixture_not_real_model'});
let unconfiguredServer;
try{
 await p.goto(process.env.APP_URL??'http://localhost:3000');await click('进入今天吃什么');
 // Hold the network response until a new requirement has been saved.
 let release,seen;const received=new Promise(r=>seen=r),held=new Promise(r=>release=r);
 await p.route('**/api/interpret',async route=>{const req=route.request().postDataJSON();seen();await held;await reply(route,answer(req,[operation()]));});
 await p.locator('#ai-text').fill('今天想吃面');await click('理解并应用');await received;
 await edit(d=>d.getByLabel('偏好主食：米饭',{exact:true}).check());release();
 await p.locator('#ai-result').getByText('要求已变化，旧AI结果已丢弃。',{exact:true}).waitFor();assert.deepEqual((await state()).current.soft_preferences.staple,['rice']);passed('F10');
 await p.unroute('**/api/interpret');await reset();
 await p.route('**/api/interpret',route=>reply(route,answer(route.request().postDataJSON(),[],{status:'unavailable',error:{code:'AI_TIMEOUT',message:'AI响应超时，请重试或手动编辑。'}}),504));
 await p.locator('#ai-text').fill('今天想吃面，不要鸡肉');await click('理解并应用');await p.locator('#ai-result').getByText('AI响应超时，请重试或手动编辑。',{exact:true}).waitFor();
 assert.equal(await p.locator('#ai-text').inputValue(),'今天想吃面，不要鸡肉');assert.deepEqual((await state()).current.soft_preferences,{});
 await edit(async d=>{await d.getByLabel('偏好主食：面食',{exact:true}).check();await d.getByLabel('排除鸡肉',{exact:true}).check();});
 await p.locator('article[data-product="P04"]').getByRole('button',{name:'选这餐',exact:true}).click();await click('确认并模拟提交');await p.getByRole('heading',{name:'模拟订单已提交',exact:true}).waitFor();assert.equal(await p.getByTestId('total').textContent(),'¥21.00');passed('F11');
 await p.unroute('**/api/interpret');await reset();
 await p.route('**/api/interpret',route=>{const req=route.request().postDataJSON();return reply(route,answer(req,[operation('ingredients',['peanut'],{op:'propose_exception',evidence:'今天可以吃花生'})]));});
 await p.locator('#ai-text').fill('今天可以吃花生');await click('理解并应用');await p.locator('#action-dialog').waitFor({state:'visible'});assert.deepEqual((await state()).confirmed_exceptions.ingredients,[]);await p.locator('#action-dialog').getByRole('button',{name:'取消',exact:true}).click();assert.deepEqual((await state()).confirmed_exceptions.ingredients,[]);
 await click('理解并应用');await p.locator('#action-dialog').getByRole('button',{name:'确认变更',exact:true}).click();assert.deepEqual((await state()).confirmed_exceptions.ingredients,['peanut']);await click('撤销上次修改');assert.deepEqual((await state()).confirmed_exceptions.ingredients,[]);passed('AI-confirm-cancel-undo');
 await p.unroute('**/api/interpret');await reset();
 let historyCalls=0;
 await p.route('**/api/interpret',route=>{historyCalls++;const req=route.request().postDataJSON();return reply(route,answer(req,[operation('ingredients',['cilantro'],{op:'add_excluded',scope:'unresolved',source_record_id:'H02',evidence:'不要香菜'})]));});
 await click('整理历史备注');await p.getByRole('button',{name:'仅本餐使用',exact:true}).waitFor();assert.deepEqual((await state()).current.excluded_ingredients,[]);await click('整理历史备注');assert.equal(historyCalls,1);await click('仅本餐使用');assert.deepEqual((await state()).current.excluded_ingredients,['cilantro']);passed('history-cache-confirm');
 await p.unroute('**/api/interpret');await reset();
 await p.route('**/api/interpret',route=>{const req=route.request().postDataJSON();return reply(route,req.text==='少油'?answer(req,[operation('oil',['low'],{evidence:'少油'})]):answer(req,[],{status:'needs_clarification',clarifications:[{id:'q1',question:'希望少油还是不辣？',evidence:'清淡一点',options:[{id:'oil',label:'少油'},{id:'spice',label:'不辣'}]}]}));});
 await p.locator('#ai-text').fill('清淡一点');await click('理解并应用');await p.getByRole('button',{name:'少油',exact:true}).waitFor();assert.deepEqual((await state()).current.soft_preferences,{});await p.getByRole('button',{name:'少油',exact:true}).click();await p.locator('#ai-result').getByText('明确部分已应用，请查看更新后的要求。',{exact:true}).waitFor();assert.deepEqual((await state()).current.soft_preferences.oil,['low']);passed('clarification-followup');
 await p.evaluate(()=>{const label=document.createElement('p');label.textContent='浏览器受控响应测试 · 非真实模型调用';document.body.prepend(label);});
 await p.screenshot({path:`docs/validation/${round}-ai-desktop.png`,fullPage:true});await p.setViewportSize({width:390,height:844});await p.screenshot({path:`docs/validation/${round}-ai-mobile.png`,fullPage:true});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));passed('ai-mobile');
 await p.unroute('**/api/interpret');
 // Exercise a genuinely unconfigured server without touching the user's real credentials.
 unconfiguredServer=createServer({env:{}});await new Promise(r=>unconfiguredServer.listen(0,'127.0.0.1',r));
 await p.goto(`http://127.0.0.1:${unconfiguredServer.address().port}`);await click('进入今天吃什么');
 await p.locator('#ai-text').fill('今天想吃面');await click('理解并应用');await p.locator('#ai-result').getByText('AI尚未配置，可直接编辑要求。',{exact:true}).waitFor();assert.deepEqual((await state()).current.soft_preferences,{});assert.equal(await p.locator('#ai-text').inputValue(),'今天想吃面');
 cases.push({id:'unconfigured-real-local-endpoint',status:'passed',transport:'actual_local_http_no_model_call'});
 await p.screenshot({path:`docs/validation/${round}-manual-mobile.png`,fullPage:true});await p.setViewportSize({width:1440,height:1000});await p.screenshot({path:`docs/validation/${round}-manual-desktop.png`,fullPage:true});
 assert.deepEqual(errors,[]);
}catch(e){cases.push({id:'failure',status:'failed',error:e.stack});console.error(e);process.exitCode=1;}
finally{await browser.close();if(unconfiguredServer){unconfiguredServer.closeAllConnections();await new Promise(r=>unconfiguredServer.close(r));}await writeFile(`docs/validation/${round}-browser.json`,JSON.stringify({version:pkg.version,checked_at:new Date().toISOString(),source_sha256:JSON.parse(await readFile(`docs/validation/${round}.json`,'utf8')).source_sha256,real_ai_verified:false,cases,errors},null,2)+'\n');console.log(JSON.stringify(cases));}
