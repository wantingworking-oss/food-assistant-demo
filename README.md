# 今天吃什么 · 个人外卖决策助手

当前版本0.5.0。第五轮已补齐异常场景、费用变更重新核对、远程AI连接配置和GitHub Pages发布工作流。手动选餐、编辑、加菜、刷新恢复及模拟提交可独立体验。真实AI验收仍缺少模型凭证；不能将整个产品标为完整AI交付。

## 本地体验

需要Node.js 22或以上；实际验证Windows、Node.js 24.15.0、Chrome 157。零第三方运行依赖，无须安装依赖。

在项目目录执行：

```sh
npm start
```

打开[本地体验](http://localhost:3000)；[服务状态](http://localhost:3000/api/health)显示版本与AI配置状态。也可双击`start-local.cmd`启动。体验期间须保持服务进程运行；关闭终端、退出运行环境或重启电脑后需要重新启动。端口占用可在`.env`中设置其他PORT。

进入助手后，番茄炒蛋饭可直接确认21元模拟订单；时蔬豆腐餐需要补选主食，面食规格总价28元。支持三组示例用户、要求与历史编辑、撤销、临时例外确认、同店加菜、换店整车确认及刷新恢复。“恢复示例”可重新体验。模拟提交不会自动记为已经吃过，不产生真实订单或付款。

## 启用真实AI

复制`.env.example`为本机`.env`，设置`AI_MODE=real`、有效的`OPENAI_API_KEY`和账户可用的`FOOD_ASSISTANT_MODEL`，再重启`npm start`。模板中的`gpt-5.4-mini`是候选型号，本项目尚未实际验证其账户权限、响应质量、延迟或费用。请仅在本机/托管后端配置凭证。

接口调用OpenAI Responses API和严格JSON Schema，程序继续校验词表、来源和操作范围。只发送必要的饮食上下文；`store:false`。没有固定成功响应，也不会自动重试。默认20秒超时，原条件和输入保留，用户可重试或手动编辑。

当前表达默认本餐，明确持续性才建议长期。取消食材排除、调整已有硬约束、放宽避重或提出临时例外，沿用统一确认流程。模糊部分追问，独立明确部分可先应用。历史备注始终先作为待确认建议；历史的“今天”仅属于历史那餐，不自动变成本餐或长期要求。切用户、开始新餐或修改要求/上下文后，过期结果不能覆盖新条件。

健康接口首次实际调用成功前始终标为未验证；测试注入只用于测试进程。完整配置与接口说明见[AI接入说明](docs/AI_SETUP.md)。

## 验证

```sh
npm test
npm run test:report
npm run check:inputs
npm run build
npm run test:ai
```

- 应用测试101项通过，含40项原始推荐/购物车预期、18项AI接口/状态测试及6项发布边界测试。`test:report`写入`docs/validation/round5.json`、`round5.tap`及源码指纹。
- F10、F11及确认/取消/撤销、历史缓存确认、澄清追问已通过Chrome受控响应测试，证据在`round5-browser.json`。这验证交互与恢复，不代表真实模型理解通过。另有实际本地未配置接口检查。
- 本版核心回归记录为`round5-regression.json`，编辑与加菜回归为`round5-editing.json`。包括360/390/768/1440宽度，以及`/food-demo/`仓库子路径的静态选餐提交。
- `check:inputs`核对10份原始材料SHA-256；`build`生成公开资源白名单内的`dist/`，不包含服务器适配器、凭证或测试答案。
- `test:ai`在配置齐全时实际调用模型24次，记录请求、响应、模型、耗时、用量及程序应用前后状态。未配置时24项均为`not_run`，报告`blocked`并以非零状态退出；有调用成本。当前真实模型用例0通过、0失败、24未执行。

浏览器测试需要本机Chrome和单独安装的`playwright-core`，运行产品不需要它。设置`PLAYWRIGHT_MODULE`为其包目录，保持服务运行，执行：

```sh
node scripts/browser-check.mjs
node scripts/round3-browser.mjs round5
node scripts/round4-browser.mjs round5
```

`APP_URL`可设置核心/AI脚本的服务地址，默认`http://localhost:3000`。编辑回归脚本使用默认3000端口。受控响应截图上标注测试性质；`round5-manual-*.png`为实际未配置模式截图。

原始Python参考核对脚本只验证数据和参考计算，不代替应用验收。使用`python -X utf8 fixtures/verify_fixtures.py`可单独执行。

## 项目结构与部署

| 位置 | 职责 |
| --- | --- |
| `src/domain/` | 要求合并、历史避重、供给/规格、推荐、费用、AI契约校验 |
| `src/state/` | 统一事件、确认、撤销、用户隔离、草稿与订单快照 |
| `src/ai/adapter.js` | 仅服务端使用的真实模型适配器 |
| `server.js` | 资源白名单、健康检查、同源JSON AI接口、请求上限 |
| `public/` | 推荐、规格、编辑、AI输入与历史建议、模拟订单页面 |
| `tests/`、`scripts/` | 独立预期测试、浏览器检查、真实模型验收、静态构建 |
| `docs/PROGRESS.md` | 当前状态、证据和后续事项 |

源码仓库：[wantingworking-oss/food-assistant-demo](https://github.com/wantingworking-oss/food-assistant-demo)。`.github/workflows/pages.yml`在main推送时测试、核对原始输入、构建并发布dist；PR只检查构建。仓库Settings → Pages → Source需选择GitHub Actions。实际发布状态见[发布记录](docs/DEPLOYMENT.md)，仅在上线并打开验证后提供体验链接。

默认Pages运行手动模式。若有AI后端，仓库Actions变量`PUBLIC_API_BASE`配置为其HTTPS origin；后端设置`ALLOWED_ORIGINS`及`AI_ACCESS_TOKEN`。访问者在页面填写体验访问码，模型API密钥始终只在后端。Node整站托管和Docker配置也已准备；Docker环境尚未实际运行。[GitHub Pages官方工作流说明](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)

页面底部“体验异常场景（模拟）”可模拟售罄、恢复可售和配送费调整。变动只影响当前用户本餐，保留商品与备注；重新核对当前明细后才允许提交。开始新餐或恢复示例会清除模拟供给变更。

F01—F15已在本版执行，F10/F11涉及AI的返回采用受控测试响应，不计真实AI语义通过。异常和跨来源接口记录见`docs/validation/round5-release.json`。A01—A24仍为24未执行，完整AI版需后端配置、实际模型验收与线上验证。详见[开发进度](docs/PROGRESS.md)。
