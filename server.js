import { sanitizeRequest, interpret } from './src/ai/adapter.js';
import {aiConfiguration} from './src/ai/providers.js';
import { unavailable } from './src/domain/ai-contract.js';
import http from 'node:http';
import {timingSafeEqual} from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const DOMAIN_FILES = ['requirements.js', 'history.js', 'context.js', 'configurations.js', 'recommend.js', 'cart.js', 'ai-contract.js'];
const PUBLIC_FILES = ['index.html', 'status.js', 'styles.css', 'app.js', 'panels.js', 'ai-ui.js', 'api.js', 'config.js'];
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8' };

export function health(env = process.env) {
  const {configured,provider} = aiConfiguration(env);
  return { status: 'ok', version: '0.8.0', phase: 'provider-configuration',
    ai: { provider, mode: env.AI_MODE === 'real' ? 'real' : 'disabled', configured,
      available: false, auth_required:Boolean(env.AI_ACCESS_TOKEN), status: configured ? 'configured_unverified' : 'not_configured',
      reason: configured ? 'NOT_VERIFIED' : 'AI_NOT_CONFIGURED' } };
}

export function createServer({ env = process.env, fetchImpl = fetch } = {}) {
  const allowedOrigins=(env.ALLOWED_ORIGINS??'').split(',').map(x=>x.trim()).filter(Boolean);
  if(allowedOrigins.some(x=>{try{return new URL(x).origin!==x||!['https:','http:'].includes(new URL(x).protocol);}catch{return true;}}))throw new Error('ALLOWED_ORIGINS must contain exact HTTP(S) origins');
  if(env.AI_MODE==='real'&&(allowedOrigins.length||(env.HOST&&!['127.0.0.1','localhost','::1'].includes(env.HOST)))&&!env.AI_ACCESS_TOKEN?.trim())throw new Error('Public real AI requires AI_ACCESS_TOKEN');
  let lastSuccess = null, lastFailure = null, activeCalls = 0;
  const dataPromise = readFile(resolve(ROOT,'fixtures/mock-data.json'),'utf8').then(JSON.parse);
  return http.createServer(async (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
    const send = (status, body) => {
      response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(request.method === 'HEAD' ? undefined : JSON.stringify(body));
    };
    let pathname;
    try {
      pathname = decodeURIComponent((request.url ?? '/').split('?')[0]);
      if (pathname.includes('\\') || pathname.split('/').some(segment => segment === '..' || segment === '.') || pathname.includes('\0')) {
        send(404, { error: 'NOT_FOUND' }); return;
      }
    } catch { send(400, { error: 'BAD_URL' }); return; }
    if(pathname.startsWith('/api/')){
      const origin=request.headers.origin;
      if(origin&&!allowedOrigins.includes(origin)&&origin!==`http://${request.headers.host}`&&origin!==`https://${request.headers.host}`){send(403,unavailable({},'ORIGIN_DENIED','来源不允许。'));request.resume();return;}
      if(origin){response.setHeader('Access-Control-Allow-Origin',origin);response.setHeader('Vary','Origin');}
      if(request.method==='OPTIONS'){
        response.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');response.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');response.writeHead(204);response.end();return;
      }
    }
    if (pathname === '/api/health' && ['GET', 'HEAD'].includes(request.method)) { const h=health(env); if(lastSuccess && env.AI_MODE==='real') { h.ai.available=true; h.ai.status='verified'; h.ai.reason=null; h.ai.last_success=lastSuccess; } if(lastFailure){h.ai.available=false;h.ai.status='unavailable';h.ai.reason=lastFailure;} send(200,h); return; }
    if (pathname === '/api/interpret' && request.method === 'POST') {
      let raw={}, body;
      const fail=(status,code,message)=>send(status,unavailable(body??raw,code,message));
      try {
        // Same-origin JSON calls only. Public remote hosting needs explicit
        // authentication and a reviewed origin policy in the deployment phase.
        if(env.AI_ACCESS_TOKEN){const expected=Buffer.from('Bearer '+env.AI_ACCESS_TOKEN),actual=Buffer.from(request.headers.authorization??'');if(expected.length!==actual.length||!timingSafeEqual(expected,actual)){fail(401,'ACCESS_CODE_REQUIRED','请填写有效的AI体验访问码。');request.resume();return;}}
        if(!(request.headers['content-type']??'').startsWith('application/json')){fail(415,'INVALID_CONTENT_TYPE','请使用JSON请求。');request.resume();return;}
        const chunks=[];let size=0,oversized=false;
        for await(const chunk of request.iterator({destroyOnReturn:false})){size+=chunk.length;if(size>65536){oversized=true;break;}chunks.push(chunk);}
        if(oversized){fail(413,'BODY_TOO_LARGE','请求过长，请缩短输入。');request.resume();return;}
        try{raw=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{fail(400,'INVALID_JSON','请求格式无效。');return;}
        const data=await dataPromise;
        body=sanitizeRequest(raw,data);
        if(activeCalls>=2){fail(429,'AI_BUSY','服务繁忙，请稍后重试。');return;}
        activeCalls++;
        try {
          const {result,metrics}=await interpret(body,data,{env,fetchImpl});
          lastSuccess={...metrics,at:new Date().toISOString()};lastFailure=null;
          send(200,result);
        } finally {activeCalls--;}
      } catch(error) {
        const messages={AI_NOT_CONFIGURED:'AI尚未配置，可直接编辑要求。',AI_TIMEOUT:'AI响应超时，请重试或手动编辑。',AI_AUTH_ERROR:'模型凭证或权限不可用。',AI_RATE_LIMIT:'模型服务限流，请稍后重试。',AI_QUOTA_EXCEEDED:'AI服务额度已用完，请联系体验提供者或手动编辑要求。',AI_CONNECTION_FAILED:'暂时无法连接AI服务，请稍后重试或手动编辑。',AI_REFUSED:'模型未能处理本次表达，请改写或手动编辑。',AI_INCOMPLETE:'模型响应不完整，请重试。',INVALID_REQUEST:'请求无效，单次输入最多500字。'};
        const code=messages[error.message]?error.message:['OUTPUT_FORMAT','INVALID_EVIDENCE','HISTORY_SCOPE','CURRENT_SCOPE','UNKNOWN_INGREDIENT','INVALID_VALUES','AMBIGUOUS_OPERATIONS','INVALID_CLARIFICATION','INVALID_COMMAND','INVALID_REPEAT','UNKNOWN_DIMENSION','INVALID_SCOPE'].includes(error.message)?'AI_VALIDATION_FAILED':'AI_UPSTREAM_ERROR';
        if(code!=='INVALID_REQUEST')lastFailure=code;
        fail(code==='INVALID_REQUEST'?400:code==='AI_TIMEOUT'?504:503,code,messages[code]??'AI结果未通过校验或服务不可用，原要求已保留。');
      }
      return;
    }
    if (!['GET', 'HEAD'].includes(request.method)) { send(405, { error: 'METHOD_NOT_ALLOWED' }); return; }
    let file;
    if (pathname === '/') file = 'public/index.html';
    else if (PUBLIC_FILES.some(name => pathname === `/${name}`)) file = `public${pathname}`;
    else if (DOMAIN_FILES.some(name => pathname === `/src/domain/${name}`)) file = pathname.slice(1);
    else if (['/src/state/store.js', '/src/state/requirements.js', '/src/state/ai-operations.js'].includes(pathname)) file = pathname.slice(1);
    else if (pathname === '/data/mock-data.json') file = 'fixtures/mock-data.json';
    else { send(404, { error: 'NOT_FOUND' }); return; }
    try {
      const contents = await readFile(resolve(ROOT, file));
      response.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' });
      response.end(request.method === 'HEAD' ? undefined : contents);
    } catch { send(500, { error: 'ASSET_UNAVAILABLE' }); }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const port = Number(process.env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be between 1 and 65535');
  const server = createServer();
  server.on('error', error => { console.error(`Startup failed: ${error.code}`); process.exitCode = 1; });
  const host=process.env.HOST??'127.0.0.1';
  server.listen(port, host, () => console.log(`今天吃什么 · 服务已启动，端口 ${port}；本机体验 http://localhost:${port}`));
  for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
}
