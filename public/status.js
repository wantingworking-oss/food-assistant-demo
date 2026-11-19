import {apiUrl} from './api.js';
const status = document.querySelector('#service');
try {
  const response = await fetch(apiUrl('health'));
  if (!response.ok) throw new Error('Static mode');
  const result = await response.json();
  if (result.status !== 'ok') throw new Error('Unexpected health response');
  status.textContent = '本地基础服务：运行正常。';
} catch {
  status.textContent = '当前为静态预览，未连接后端服务。';
}
