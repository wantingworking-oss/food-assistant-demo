// Opt-in live check: makes two real model calls and consumes provider balance.
import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE??'playwright-core');
const browser=await chromium.launch({channel:'chrome',headless:true}),ctx=await browser.newContext({viewport:{width:1440,height:1000}}),p=await ctx.newPage();
const cases=[],responses=[],errors=[];p.on('pageerror',e=>errors.push(e.message));
p.on('response',async response=>{if(new URL(response.url()).pathname==='/api/interpret')responses.push({status:response.status(),body:await response.json().catch(()=>null)});});
const click=name=>p.getByRole('button',{name,exact:true}).click();
const state=async()=>{await p.locator('#user-picker').waitFor();return p.evaluate(()=>JSON.parse(localStorage.getItem('food-assistant:1.0.0:U_A:task')));};
const url=process.env.APP_URL??'http://localhost:3000';
const round=process.env.AI_EVIDENCE_PREFIX??'round7';if(!/^round\d+$/.test(round))throw new Error('Expected roundN evidence prefix');
const openEditor=()=>p.locator('.requirements').getByRole('button',{name:'调整本餐要求',exact:true}).click();
try{
 const h=await(await p.request.get((process.env.AI_TEST_BASE_URL??url)+'/api/health')).json();assert.equal(h.ai.mode,'real');assert.equal(h.ai.provider,'deepseek');assert.equal(h.ai.configured,true);
 await p.goto(url);await click('进入今天吃什么');await openEditor();
 if(h.ai.auth_required){assert.ok(process.env.AI_ACCESS_TOKEN);await p.getByText('AI服务访问码',{exact:true}).click();await p.getByLabel('体验访问码',{exact:true}).fill(process.env.AI_ACCESS_TOKEN);await click('保存访问码');}
 await p.locator('#ai-text').fill('这顿主食选面食，鸡肉先避开');await click('理解并填入草稿');await p.locator('#ai-result').getByText('已整理到草稿，请核对后应用。',{exact:true}).waitFor();assert.deepEqual((await state()).current.soft_preferences,{});await click('应用修改');let s=await state();assert.deepEqual(s.current.soft_preferences.staple,['noodle']);assert.ok(s.current.excluded_ingredients.includes('chicken'));cases.push({id:'live-new-wording',status:'passed',input:'这顿主食选面食，鸡肉先避开'});
 await p.locator('article[data-product="P04"]').getByRole('button',{name:'选这餐',exact:true}).click();assert.equal(await p.getByTestId('total').textContent(),'¥21.00');await click('确认并模拟提交');await p.getByRole('heading',{name:'模拟订单已提交',exact:true}).waitFor();cases.push({id:'live-to-mock-order',status:'passed',total_fen:2100});
 await click('恢复示例');await p.locator('#action-dialog').getByRole('button',{name:'恢复示例',exact:true}).click();await click('进入今天吃什么');await openEditor();
 await p.locator('#ai-text').fill('这顿花生可以，长期不改');await click('理解并填入草稿');await p.locator('#ai-result').getByText('已整理到草稿，请核对后应用。',{exact:true}).waitFor();await click('应用修改');await p.locator('#action-dialog').waitFor({state:'visible'});s=await state();assert.deepEqual(s.confirmed_exceptions.ingredients,[]);await p.locator('#action-dialog').getByRole('button',{name:'确认变更',exact:true}).click();s=await state();assert.deepEqual(s.confirmed_exceptions.ingredients,['peanut']);assert.ok(s.profile.long_term.excluded_ingredients.includes('peanut'));cases.push({id:'live-exception-confirmation',status:'passed'});
 assert.equal(await p.locator('#preferences-dialog').isVisible(),false);
 await p.screenshot({path:`docs/validation/${round}-live-desktop.png`,fullPage:true});await p.setViewportSize({width:390,height:844});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.screenshot({path:`docs/validation/${round}-live-mobile.png`,fullPage:true});
 assert.equal(responses.length,2);assert.ok(responses.every(r=>r.status===200));assert.deepEqual(errors,[]);
}catch(error){cases.push({id:'failure',status:'failed',error:error.stack});console.error(error);process.exitCode=1;}
finally{await browser.close();await writeFile(`docs/validation/${round}-live-browser.json`,JSON.stringify({checked_at:new Date().toISOString(),url,provider:'deepseek',transport:'real_backend_and_provider',cases,responses,errors,status:cases.some(c=>c.status==='failed')?'failed':'passed'},null,2)+'\n');console.log(JSON.stringify(cases));}
