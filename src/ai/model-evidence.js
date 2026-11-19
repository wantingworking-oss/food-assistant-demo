// Admin validation evidence only. Never copy provider errors, headers or keys.
export function modelEvidence(body){
 const text=body?.choices?.[0]?.message?.content??(body?.output??[]).filter(x=>x.type==='message').flatMap(x=>x.content??[]).filter(x=>x.type==='output_text').map(x=>x.text).join('');
 if(typeof text!=='string'||!text)return {};
 const safeNumber=value=>Number.isSafeInteger(value)&&value>=0?value:null;
 return {raw_model_text:text.slice(0,30000),raw_usage:{input_tokens:safeNumber(body.usage?.input_tokens??body.usage?.prompt_tokens),output_tokens:safeNumber(body.usage?.output_tokens??body.usage?.completion_tokens)}};
}
