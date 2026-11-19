import {planRequirements,requirementsSnapshot,restoreRequirements} from './requirements.js';
// Build changes from a validated response, always using the existing planner.
// Each dimension is atomic. Independent executable dimensions may proceed.
export function planAI(data,state,operations){
 let working=structuredClone(state),pending=structuredClone(state), applied=[],messages=[],deferred=[],skipped=[];
 for(const op of operations){
  if(['undo_last','clear_current'].includes(op.op))return {command:op.op};
  try{
   const eventFor = target => {
    if(op.op==='propose_exception')return {type:'PROPOSE_EXCEPTION',field:op.field,value:op.values[0]};
    const value=structuredClone(op.scope==='current'?target.current:target.profile.long_term);
    if(op.op==='set_soft')value.soft_preferences[op.field]=op.values;
    if(op.op==='remove_soft')delete value.soft_preferences[op.field];
    if(op.op==='set_hard')value.hard_attributes[op.field]=op.values;
    if(op.op==='remove_hard')delete value.hard_attributes[op.field];
    if(op.op==='add_excluded')value.excluded_ingredients=[...new Set([...value.excluded_ingredients,...op.values])];
    if(op.op==='remove_excluded')value.excluded_ingredients=value.excluded_ingredients.filter(v=>!op.values.includes(v));
    if(op.op==='set_repeat')value.repeat_rule=op.values[0];
    return {type:'APPLY_REQUIREMENTS',scope:op.scope,value};
   };
   if(op.op==='propose_exception'&&op.values.length>1){for(const value of op.values){const plan=planRequirements(data,pending,{type:'PROPOSE_EXCEPTION',field:op.field,value});restoreRequirements(pending,plan.next);messages.push(...plan.messages);}deferred.push(op);continue;}
   const plan=planRequirements(data,working,eventFor(working));
   if(plan.messages.length){const proposed=planRequirements(data,pending,eventFor(pending));restoreRequirements(pending,proposed.next);messages.push(...proposed.messages);deferred.push(op);}
   else{const proposed=planRequirements(data,pending,eventFor(pending));restoreRequirements(working,plan.next);restoreRequirements(pending,proposed.next);applied.push(op);}
  }catch(error){skipped.push({evidence:op.evidence,reason:error.message});}
 }
 return {next:requirementsSnapshot(working),pending:requirementsSnapshot(pending),applied,deferred,messages,skipped};
}
