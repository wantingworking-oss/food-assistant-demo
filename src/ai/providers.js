// Provider keys are intentionally separate. No cross-provider fallback.
export function aiConfiguration(env=process.env){
 const provider=env.AI_PROVIDER?.trim()||'openai';
 const supported=['openai','deepseek'].includes(provider);
 const key=(provider==='deepseek'?env.DEEPSEEK_API_KEY:provider==='openai'?env.OPENAI_API_KEY:'')?.trim()??'';
 const model=env.FOOD_ASSISTANT_MODEL?.trim()??'';
 return {provider,key,model,configured:supported&&Boolean(key&&model),supported};
}
export async function providerError(response){
 if(response.status===401||response.status===403)return 'AI_AUTH_ERROR';
 if(response.status===402)return 'AI_QUOTA_EXCEEDED';
 if(response.status===429){const body=await response.json().catch(()=>null);return ['insufficient_quota','credit_balance_exhausted','billing_hard_limit_reached'].includes(body?.error?.code)?'AI_QUOTA_EXCEEDED':'AI_RATE_LIMIT';}
 return 'AI_UPSTREAM_ERROR';
}
