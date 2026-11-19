# 第一轮领域接口

所有 `src/domain` 模块为ES modules，不依赖DOM、网络或模型，Node测试与后续浏览器页面使用同一实现。输入保持不变，结果为派生计算；金额单位为分。

## 推荐与购物车输入

```js
import { recommend } from './src/domain/recommend.js';
import { validateCart } from './src/domain/cart.js';
import { demoDate } from './src/domain/history.js';

const anchor = demoDate(); // 仅新任务/恢复示例时确定，刷新沿用保存值。
const input = {
  user_id: 'U_A', // 也可传入已保存且已确认的profile。
  task: {
    address_id: 'A01', anchor_date: anchor, date: anchor, meal: 'lunch',
    allow_incomplete_history: false,
  },
  current: { soft_preferences: {}, excluded_ingredients: [], hard_attributes: {} },
  confirmed_exceptions: { ingredients: [], hard_attributes: {} },
  selections: {},
  history_corrections: {},
  skipped_product_ids: [],
  supply: { unavailable_product_ids: [], delivery_fee_overrides: {} },
};
const recommendations = recommend(data, input);
const cart = validateCart(data, input, [
  { product_id: 'P01', configuration_id: 'fixed', quantity: 1, role: 'main' },
]);
```

`data`为解析后的mock-data.json；传入profile时由上层状态管理保证用户身份和资料一致。`task.date`是当前选餐日期，`anchor_date`是相对历史的固定基准，两者分开保存。历史纠正通过记录ID映射；后续新增平台外记录先加入data.history和profile.history_record_ids。

这些接口只接受**已经生效的条件**。`confirmed_exceptions`只能由确认流程写入，模型返回或用户未确认的提议不能直接传入。批次3实现事件、确认、撤销和存储，批次4实现AI输出校验。当前领域模块不会自行推断用户已经确认。

硬属性约束保留长期与本餐两层检查，冲突时无合格配置，不会由本餐值覆盖长期限制。硬属性的已确认本餐例外需明确列出该长期维度的完整豁免值；独立本餐限制仍有效。放宽重复规则的确认由状态层负责。

## 结果

`recommend`返回：

- `status`：ready、no_match或needs_history_confirmation。
- `ranked_product_ids`与`display_product_ids`：完整稳定排序、最多三项展示顺序。
- `items`：商品ID索引。每项包含配置ID、比较选项、已选选项、选择来源、缺失规格、三组分数、总价、时间、匹配及未匹配偏好、未知属性。
- `exclusions`：每个被排除商品的有序原因数组，第一项为首要阻断原因。
- `history_record_ids`和`flags`：实际引用历史及不足提示。

`selected_options`是已展示预填或用户明确选择；`comparison_options`仅参与比较，不能自动写入购物车。理由用matched、unmatched、历史记录与当前约束生成，不交给模型虚构。

`validateCart`返回valid、error_code、amounts_fen、errors与flags。有效金额包含goods、packaging、delivery、discount、total；无效车金额为null。errors包含所有检查到的问题与行索引，首要错误按整车优先级决定。缺失/非法数据另标DATA_ERROR，数量必须是安全正整数。

第一轮领域模块只负责验证与计算给定购物车。第二轮新增src/state/store.js作为任务事件入口，包含选餐、规格确认、任务保存与模拟订单；完整加菜增删、数量编辑和用户隔离由第三轮扩展。后续操作层必须保留main/addon角色，不可合并后丢失角色。

## 第二轮状态接口

`createStore(data, { storage, id, now })`接受浏览器localStorage或测试存储适配器，返回state只读副本、warning、recommendations()、cartResult()、preview(productId, options)和dispatch(event)。

当前事件：ENTER_ASSISTANT、HOME、RETURN_TO_ASSISTANT、SELECT_MAIN、OPEN_CONFIRM、SET_NOTE、SUBMIT_MOCK_ORDER、START_NEW_MEAL、RESTORE_EXAMPLE。SELECT_MAIN需要完整有效规格；跨店替换返回needs_replacement_confirmation，由页面确认后再次传入replace_confirmed。规格预览不写入状态，取消对话框保留原选择。

存储键为food-assistant:1.0.0:U_A:task，schema为2。订单快照包含商品名称、实际规格、费用和备注，按task_id保存。重复提交返回reused=true，且不新增历史记录。浏览器调用提交时使用Web Locks（如可用）；存储失败会显示会话无法保存提示。当前只覆盖单用户核心任务，不宣称完整多用户同步或真实交易幂等。

## 有限规格支持

本次数据每个商品最多一个规格组。实现检查完整配置并支持对当前字段匹配，但未将任意多规格组合、部分默认失效等扩展能力计为已验证。缺失价格抛出DATA_ERROR或返回购物车数据错误，不当作0元。
