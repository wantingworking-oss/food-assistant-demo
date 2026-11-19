"""Independent fixture/oracle checker, Python standard library only.
This is a reference calculator, not a product implementation or a real AI test.
Never rewrites golden expected-results.json.
"""
from pathlib import Path
import json,sys

ROOT=Path(__file__).resolve().parent
def read(name):return json.loads((ROOT/name).read_text())
D=read('mock-data.json'); E=read('expected-results.json')
P={p['id']:p for p in D['products']};M={m['id']:m for m in D['merchants']};U={u['id']:u for u in D['users']};H={h['id']:h for h in D['history']}
def match(dim,value,accepted):
 if value is None:return False
 if dim=='staple' and 'any' in accepted and value in ('rice','noodle'):return True
 if dim=='oil' and 'low' in accepted and value=='none':return True
 return value in accepted

def context(setup):
 u=U[setup['user_id']]; sc=setup.get('scene',{});lt=u['long_term']
 ex=(set(sc.get('replace_long_excluded',lt['excluded_ingredients']))-set(sc.get('confirmed_temporary_exceptions',[])))|set(sc.get('current_excluded',[]))
 hard={**lt['hard_attributes'],**sc.get('current_hard',{})}
 prefs={}
 for level,layer in reversed(list(enumerate([sc.get('current_soft',{}),lt['soft_preferences'],u['historical_soft_preferences']]))):
  for dim,vals in layer.items():
   if dim not in hard:prefs[dim]=(level,vals)
 repeat=sc.get('repeat_rule',lt['repeat_rule']);repeat_dishes=set();flags=[]
 records=[]
 for hid in sc.get('history_ids',u['history_record_ids']):
  h=H[hid]
  if h['belongs_to_user'] is not True or h['order_status'] in ('cancelled','failed'):continue
  if not h['consumed_confirmed'] and h['order_status']!='completed':continue
  rank=(h['day_offset'],D['clock']['meal_order'].index(h['meal']))
  now=(D['clock']['current_day_offset'],D['clock']['meal_order'].index(D['clock']['current_meal']))
  if rank<now: records.append((rank,h))
 relevant=[]
 if repeat=='yesterday_same_meal':relevant=[h for _,h in records if h['day_offset']==-1 and h['meal']==D['clock']['current_meal']]
 elif repeat=='previous_meal' and records:
  latest=max(x for x,h in records);relevant=[h for r,h in records if r==latest]
 if repeat!='allow' and not relevant:
  if not sc.get('allow_incomplete_history'):return dict(blocked=True)
  flags.append('HISTORY_INCOMPLETE')
 for h in relevant:
  for item in h['items']:repeat_dishes.update(P[item['product_id']]['canonical_main_dish_ids'])
 return dict(blocked=False,excluded=ex,hard=hard,prefs=prefs,repeat_dishes=repeat_dishes,flags=flags,scene=sc,address=setup['address_id'])

def supply(p,cx):
 sc=cx['scene'];m=M[p['merchant_id']]
 if not m['open'] or not p['available'] or p['id'] in sc.get('unavailable_products',[]):return 'UNAVAILABLE'
 if not m['delivery'][cx['address']]['available']:return 'UNDELIVERABLE'
 return None
def constraint(p,c,cx):
 if set(c['ingredients'])&cx['excluded']:return 'EXCLUDED_INGREDIENT'
 if cx['excluded'] and not c['ingredient_information_complete']:return 'UNKNOWN_INGREDIENTS'
 if any(not match(k,c['attributes'][k],v) for k,v in cx['hard'].items()):return 'HARD_ATTRIBUTE'
 if set(p['canonical_main_dish_ids'])&cx['repeat_dishes']:return 'REPEAT'
 return None
def amounts(p,c,cx):
 m=M[p['merchant_id']];fee=cx['scene'].get('delivery_fee_overrides',{}).get(m['id'],m['delivery'][cx['address']]['fee_fen'])
 return c['price_fen']+p['packaging_fee_fen_per_unit']+fee
def confs_for(p,cx):
 sc=cx['scene'];explicit=p['id'] in sc.get('selected_options',{})
 selected=sc.get('selected_options',{}).get(p['id'],p['default_selections'])
 configs=[c for c in p['configurations'] if all(c['option_values'].get(k)==v for k,v in selected.items())]
 # This fixture has at most one spec group per product; a failing automatic default
 # is not applied. Explicit user selection is never silently changed.
 if not explicit and selected and configs and not any(constraint(p,c,cx) is None for c in configs):
  configs=p['configurations'];selected={}
 return configs,selected
def rank(setup):
 cx=context(setup)
 if cx['blocked']:return dict(status='needs_history_confirmation',rank=[],display=[],items={},excluded={},flags=[])
 items={};excluded={}
 for p in D['products']:
  if p['kind']!='main':continue
  error=supply(p,cx)
  if error:excluded[p['id']]=error;continue
  if p['id'] in cx['scene'].get('skipped_products',[]):excluded[p['id']]='SKIPPED';continue
  configs,selected=confs_for(p,cx);options=[];errors=[]
  for c in configs:
   error=constraint(p,c,cx)
   if error:errors.append(error);continue
   scores=[0,0,0]
   for dim,(level,accepted) in cx['prefs'].items():scores[level]+=int(match(dim,c['attributes'][dim],accepted))
   total=amounts(p,c,cx);eta=M[p['merchant_id']]['delivery'][cx['address']]['eta_minutes']
   key=tuple(-v for v in scores)+(total,eta,p['id'],c['id'])
   options.append(dict(product_id=p['id'],configuration_id=c['id'],score=scores,total_fen=total,key=key,
                       missing_specs=[g['id'] for g in p['spec_groups'] if g['required'] and g['id'] not in selected]))
  if options:items[p['id']]=min(options,key=lambda x:x['key'])
  else:
   priority=['EXCLUDED_INGREDIENT','UNKNOWN_INGREDIENTS','HARD_ATTRIBUTE','REPEAT']
   excluded[p['id']]=next((e for e in priority if e in errors),'NO_CONFIGURATION')
 ranked=sorted(items,key=lambda k:items[k]['key']);shown=[];seen=set()
 for pid in ranked:
  dishes=set(P[pid]['canonical_main_dish_ids'])
  if not dishes&seen:shown.append(pid);seen|=dishes
  if len(shown)==3:break
 if len(shown)<3:
  for pid in ranked:
   if pid not in shown:shown.append(pid)
   if len(shown)==3:break
 return dict(status='ready' if ranked else 'no_match',rank=ranked,display=shown,items=items,excluded=excluded,flags=cx['flags'])

def cart(setup):
 lines=setup['lines'];cx=context(setup)
 def bad(code):return dict(valid=False,error_code=code,amounts_fen=None)
 if not lines:return bad('EMPTY_CART')
 mids={P[l['product_id']]['merchant_id'] for l in lines}
 if len(mids)!=1:return bad('CROSS_MERCHANT')
 if cx['blocked']:return bad('NEEDS_HISTORY_CONFIRMATION')
 goods=pack=0
 for l in lines:
  p=P[l['product_id']];error=supply(p,cx)
  if error:return bad(error)
  if l['configuration_id'] is None:return bad('MISSING_SPEC')
  c=next(c for c in p['configurations'] if c['id']==l['configuration_id'])
  error=constraint(p,c,cx)
  if error:return bad(error)
  assert isinstance(l['quantity'],int) and l['quantity']>0
  goods+=c['price_fen']*l['quantity'];pack+=p['packaging_fee_fen_per_unit']*l['quantity']
 mid=next(iter(mids));fee=cx['scene'].get('delivery_fee_overrides',{}).get(mid,M[mid]['delivery'][cx['address']]['fee_fen'])
 return dict(valid=True,error_code=None,amounts_fen=dict(goods=goods,packaging=pack,delivery=fee,discount=0,total=goods+pack+fee))

def validate_data():
 assert (len(M),len(P),len(U),len(H),len(D['addresses']))==(4,20,3,6,2)
 assert sum(p['kind']=='main' for p in P.values())==12
 assert len({p['id'] for p in D['products']})==20
 for p in P.values():
  assert p['merchant_id'] in M and p['packaging_fee_fen_per_unit']>=0
  ids=[c['id'] for c in p['configurations']];assert len(ids)==len(set(ids))
  groups={g['id']:g for g in p['spec_groups']}
  for k,v in p['default_selections'].items():assert k in groups and v in groups[k]['option_ids']
  for c in p['configurations']:
   assert isinstance(c['price_fen'],int) and c['price_fen']>=0
   assert set(c['attributes'])==set(D['dictionaries']['dimensions'])
   for k,v in c['attributes'].items():assert v in D['dictionaries']['attributes'][k]
   assert set(c['option_values'])==set(groups)
   for k,v in c['option_values'].items():assert v in groups[k]['option_ids']
 for h in H.values():
  assert h['user_id'] in U
  for i in h['items']:assert i['configuration_id'] in [c['id'] for c in P[i['product_id']]['configurations']]

def run():
 validate_data();fail=[];details=[]
 for case in E['recommendation_cases']:
  got=rank(case['setup']);e=case['expected']
  try:
   assert got['status']==e['status'],('status',got['status'],e['status'])
   assert got['rank']==e['ranked_product_ids'],('rank',got['rank'],e['ranked_product_ids'])
   assert got['display']==e['display_product_ids'],('display',got['display'],e['display_product_ids'])
   assert got['flags']==e['flags'],('flags',got['flags'],e['flags'])
   for pid,v in e['configuration_ids'].items():assert got['items'][pid]['configuration_id']==v,(pid,'configuration')
   for pid,v in e['totals_fen'].items():assert got['items'][pid]['total_fen']==v,(pid,'total',got['items'][pid]['total_fen'],v)
   for pid,v in e['scores'].items():assert got['items'][pid]['score']==v,(pid,'scores',got['items'][pid]['score'],v)
   for pid,v in e['primary_exclusion_codes'].items():assert got['excluded'][pid]==v,(pid,'exclusion',got['excluded'][pid],v)
   details.append(dict(id=case['id'],status='passed'))
  except (AssertionError,KeyError) as ex:fail.append(dict(id=case['id'],error=str(ex)))
 for case in E['cart_cases']:
  got=cart(case['setup'])
  if got!=case['expected']:fail.append(dict(id=case['id'],actual=got,expected=case['expected']))
  else:details.append(dict(id=case['id'],status='passed'))
 assert len(read('ai-semantic-cases.json')['cases'])==24
 assert len(read('interaction-cases.json')['cases'])==15
 report=dict(scope='数据结构、引用及人工预期值与独立参考计算的交叉核对；不代表产品测试或真实AI测试',
             data_validation='passed',passed=len(details),failed=len(fail),details=details,failures=fail,
             pending={'interaction_cases':15,'real_model_semantic_cases':24,'ui_or_deployment_tests':'not_run'})
 (ROOT/'validation-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps({k:v for k,v in report.items() if k not in ('details',)},ensure_ascii=False,indent=2))
 return 1 if fail else 0
if __name__=='__main__':sys.exit(run())
