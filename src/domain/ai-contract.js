import {DIMENSIONS} from './requirements.js';
export const PARSER_VERSION = '1.1.0';
export const OPS = ['set_soft','remove_soft','add_excluded','remove_excluded','set_hard','remove_hard','set_repeat','propose_exception','undo_last','clear_current'];
const object = properties => ({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const string = {type:'string'}, nullable = {type:['string','null']};
const array = items => ({type:'array',items});
export const RESPONSE_SCHEMA = object({
 status:{type:'string',enum:['parsed','needs_clarification','unsupported','unavailable']},
 operations:array(object({op:{type:'string',enum:OPS},scope:{type:'string',enum:['current','long_term','historical_meal','unresolved']},field:{...nullable,enum:[...DIMENSIONS,'ingredients','repeat_rule',null]},values:array({type:['string','boolean']}),evidence:string,source_record_id:nullable})),
 clarifications:array(object({id:string,question:string,evidence:string,options:array(object({id:string,label:string}))})),
 unsupported_parts:array(object({evidence:string,reason:string})),
 record_annotations:array(object({source_record_id:string,belongs_to_user:{type:['boolean','null']},fulfillment_note:nullable,evidence:string})),
 error:{anyOf:[{type:'null'},object({code:string,message:string})]}
});
export function assertSchema(value,schema){
 if(schema.anyOf){if(!schema.anyOf.some(s=>{try{assertSchema(value,s);return true;}catch{return false;}}))throw new Error('OUTPUT_FORMAT');return;}
 const type=value===null?'null':Array.isArray(value)?'array':typeof value;
 if(!(Array.isArray(schema.type)?schema.type:[schema.type]).includes(type))throw new Error('OUTPUT_FORMAT');
 if(schema.enum&&!schema.enum.includes(value))throw new Error('OUTPUT_FORMAT');
 if(type==='object'){if(Object.keys(value).some(k=>!Object.hasOwn(schema.properties,k))||schema.required.some(k=>!Object.hasOwn(value,k)))throw new Error('OUTPUT_FORMAT');for(const[k,s]of Object.entries(schema.properties))assertSchema(value[k],s);}
 if(type==='array'){if(value.length>40)throw new Error('OUTPUT_FORMAT');value.forEach(v=>assertSchema(v,schema.items));}
 if(type==='string'&&value.length>2000)throw new Error('OUTPUT_FORMAT');
}
export function validateInterpretation(output,request,data){
 assertSchema(output,RESPONSE_SCHEMA);
 const evidenceText = item => {
  const source = request.mode==='history_notes' ? request.history_notes.find(n=>n.id===item.source_record_id)?.note : request.text;
  if(!source||!item.evidence?.trim()||!source.includes(item.evidence))throw new Error('INVALID_EVIDENCE');
 };
 for(const op of output.operations){
  evidenceText(op);
  if(request.mode==='history_notes'){
   if(!['historical_meal','unresolved'].includes(op.scope)||['undo_last','clear_current','propose_exception'].includes(op.op))throw new Error('HISTORY_SCOPE');
   if(request.history_notes.find(n=>n.id===op.source_record_id)?.belongs_to_user===false||output.record_annotations.some(a=>a.source_record_id===op.source_record_id&&a.belongs_to_user===false))throw new Error('HISTORY_SCOPE');
  }else if(!['current','long_term'].includes(op.scope)||op.source_record_id!==null)throw new Error('CURRENT_SCOPE');
  if(['undo_last','clear_current'].includes(op.op)){if(op.field!==null||op.values.length||op.scope!=='current'||output.operations.length!==1)throw new Error('INVALID_COMMAND');continue;}
  const remove=['remove_soft','remove_hard'].includes(op.op);
  if(remove?op.values.length!==0:op.values.length===0)throw new Error('INVALID_VALUES');
  if(['add_excluded','remove_excluded'].includes(op.op)||op.op==='propose_exception'&&op.field==='ingredients'){
   if(op.field!=='ingredients'||op.values.some(v=>!data.dictionaries.ingredients.includes(v)))throw new Error('UNKNOWN_INGREDIENT');
  }else if(op.op==='set_repeat'){
   if(op.field!=='repeat_rule'||op.values.length!==1||!['allow','previous_meal','yesterday_same_meal'].includes(op.values[0]))throw new Error('INVALID_REPEAT');
  }else{
   if(!data.dictionaries.dimensions.includes(op.field))throw new Error('UNKNOWN_DIMENSION');
   const allowed=[...data.dictionaries.attributes[op.field].filter(v=>v!==null),...(op.field==='staple'?['any']:[])];
   if(op.values.some(v=>!allowed.includes(v)))throw new Error('INVALID_VALUES');
  }
  if(op.op==='propose_exception'&&op.scope!=='current')throw new Error('INVALID_SCOPE');
 }
 for(const item of output.record_annotations){if(request.mode!=='history_notes')throw new Error('HISTORY_SCOPE');evidenceText(item);}
 for(const c of output.clarifications){if(!c.question.trim()||c.options.length>3||!c.evidence||!(request.mode==='user_input'?request.text.includes(c.evidence):request.history_notes.some(n=>n.note.includes(c.evidence))))throw new Error('INVALID_CLARIFICATION');}
 for(const u of output.unsupported_parts){if(!u.reason||!u.evidence||!(request.mode==='user_input'?request.text.includes(u.evidence):request.history_notes.some(n=>n.note.includes(u.evidence))))throw new Error('INVALID_EVIDENCE');}
 if(output.status==='needs_clarification'&&!output.clarifications.length)throw new Error('INVALID_CLARIFICATION');
 if(output.status==='unsupported'&&!output.unsupported_parts.length)throw new Error('OUTPUT_FORMAT');
 if(output.status==='unavailable'&&output.operations.length)throw new Error('OUTPUT_FORMAT');
 // Opposed or ambiguous changes in a single dimension remain unapplied. The
 // model must split independent clauses and leave ambiguous dimensions empty.
 const grouped=new Map();for(const op of output.operations){const key=op.source_record_id+':'+op.scope+':'+op.field;if(grouped.has(key)&&!(['add_excluded','remove_excluded'].includes(op.op)&&grouped.get(key).op===op.op))throw new Error('AMBIGUOUS_OPERATIONS');grouped.set(key,op);}
 if(output.clarifications.some(c=>output.operations.some(op=>op.evidence.includes(c.evidence)||c.evidence.includes(op.evidence))))throw new Error('AMBIGUOUS_OPERATIONS');
 return structuredClone(output);
}
export function envelope(request,body){return {...body,request_id:request?.request_id??null,task_id:request?.task_id??null,requirements_version:request?.requirements_version??null,mode:request?.mode??null};}
export function unavailable(request,code,message){return envelope(request,{status:'unavailable',operations:[],clarifications:[],unsupported_parts:[],record_annotations:[],error:{code,message}});}
