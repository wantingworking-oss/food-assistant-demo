import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createServer, health } from '../server.js';
let server, origin;
before(async () => {
  server = createServer({ env: {} });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
test('S01 HTTP健康检查区分未配置和未验证，不暴露凭证', async () => {
  const response = await fetch(`${origin}/api/health`);
  assert.equal(response.status, 200);
  const status = await response.json();
  assert.equal(status.ai.status, 'not_configured');
  assert.equal(status.ai.available, false);
  const configured = health({ OPENAI_API_KEY: 'test-secret-never-public', FOOD_ASSISTANT_MODEL: 'test-model', AI_MODE: 'real' });
  assert.equal(configured.ai.status, 'configured_unverified');
  assert.equal(configured.ai.available, false);
  assert.equal(JSON.stringify(configured).includes('test-secret'), false);
});
test('S02 仅公开启动页、浏览器领域模块及示例数据', async () => {
  for (const path of ['/', '/index.html', '/status.js', '/styles.css', '/src/domain/recommend.js', '/data/mock-data.json']) {
    const response = await fetch(`${origin}${path}`);
    assert.equal(response.status, 200, path);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  }
  const head = await fetch(`${origin}/`, { method: 'HEAD' });
  assert.equal(head.status, 200); assert.equal(await head.text(), '');
});
test('S03 服务端文件、测试答案与环境配置无法经静态路由读取', async () => {
  for (const path of ['/server.js', '/package.json', '/.env', '/.env.example', '/fixtures/expected-results.json',
    '/src/ai/adapter.js', '/docs/PROGRESS.md', '/tests/fixture-adapter.js']) {
    assert.equal((await fetch(`${origin}${path}`)).status, 404, path);
  }
});
test('S04 编码及未规范化路径不能穿越公开目录', async () => {
  const raw = path => new Promise((resolve, reject) => {
    http.get(`${origin}`, { path }, response => { response.resume(); response.on('end', () => resolve(response.statusCode)); }).on('error', reject);
  });
  for (const path of ['/../server.js', '/%2e%2e/server.js', '/src/domain/../../server.js', '/%5c..%5c.env', '/%00.env']) {
    assert.equal(await raw(path), 404, path);
  }
  assert.equal(await raw('/%invalid'), 400);
});
test('S05 尚未实现的AI接口返回不可用，不伪造解析成功', async () => {
  const response = await fetch(`${origin}/api/interpret`, { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({request_id:'test',task_id:'task',requirements_version:0,mode:'user_input',text:'今天想吃面',context:{user_id:'U_A',meal:'lunch',long_term:{},current:{}},history_notes:[]}) });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).status, 'unavailable');
});
