import {createValidationClient} from '../src/ai/validation-client.js';
const checks=await createValidationClient().readiness();
console.log(JSON.stringify({...checks,model_call_made:false,next_action:checks.ready?'运行 npm run test:ai 执行24条真实验收（会调用模型）。':checks.reason==='ACCESS_CODE_REQUIRED'?'在本机环境配置后端的 AI_ACCESS_TOKEN，再运行诊断。':checks.reason==='INVALID_AI_TEST_BASE_URL'?'AI_TEST_BASE_URL 只能是后端 HTTPS origin，本机可用HTTP。':checks.reason==='AI_NOT_CONFIGURED'?`本机直连需 AI_MODE=real、${checks.provider==='deepseek'?'DEEPSEEK_API_KEY':'OPENAI_API_KEY'}、FOOD_ASSISTANT_MODEL；线上验收需配置好的后端与 AI_TEST_BASE_URL。`:'检查后端地址、网络及服务配置。'},null,2));
if(!checks.ready)process.exitCode=2;
