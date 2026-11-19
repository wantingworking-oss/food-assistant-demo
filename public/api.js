import {API_BASE} from './config.js';
let memoryCode='';
const codeKey='food-assistant:ai-access-code';
export const remoteAPI=Boolean(API_BASE);
export const apiUrl=path=>API_BASE?new URL('/api/'+path,API_BASE).href:'./api/'+path;
export function setAccessCode(value){memoryCode=String(value).trim();try{if(memoryCode)sessionStorage.setItem(codeKey,memoryCode);else sessionStorage.removeItem(codeKey);}catch{/* Session memory still works. */}}
export function aiHeaders(){let code=memoryCode;try{code=sessionStorage.getItem(codeKey)||memoryCode;}catch{/* Session memory. */}return {'Content-Type':'application/json',...(code?{Authorization:'Bearer '+code}:{})};}
