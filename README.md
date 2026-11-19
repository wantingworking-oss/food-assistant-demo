# 今天吃什么 · 个人外卖决策助手

当前版本0.6.1。本地DeepSeek真实接入已验证：A01—A24全部通过，浏览器真实请求完成选餐、模拟下单和本次破例确认。手动选餐、编辑、加菜、刷新恢复及模拟提交可独立体验。GitHub Pages已连接Render真实DeepSeek后端，使用AI需填写体验访问码。

在线体验：[打开今天吃什么](https://wantingworking-oss.github.io/food-assistant-demo/)（GitHub Pages前端 + Render后端，已实测真实AI）。

## 本地体验

需要Node.js 22或以上；实际验证Windows、Node.js 24.15.0、Chrome 157。零第三方运行依赖，无须安装依赖。

在项目目录执行：

```sh
npm start
```

打开[本地体验](http://localhost:3000)；[服务状态](http://localhost:3000/api/health)显示版本与AI配置状态。也可双击`start-local.cmd`启动。体验期间须保持服务进程运行；关闭终端、退出运行环境或重启电脑后需要重新启动。端口占用可在`.env`中设置其他PORT。

进入助手后，番茄炒蛋饭可直接确认21元模拟订单；时蔬豆腐餐需要补选主食，面食规格总价28元。支持三组示例用户、要求与历史编辑、撤销、临时例外确认、同店加菜、换店整车确认及刷新恢复。“恢复示例”可重新体验。模拟提交不会自动记为已经吃过，不产生真实订单或付款。

## 接入DeepSeek

在资源管理器中双击`configure-deepseek.cmd`，输入DeepSeek控制台新生成的API Key，输入过程隐藏。脚本仅将`DEEPSEEK_API_KEY`、`AI_PROVIDER=deepseek`、`FOOD_ASSISTANT_MODEL=deepseek-flash`等设置写入本机被忽略的`.env`。请勿将真实Key写入仓库或聊天。

DeepSeek官方API按量计费，有赠送余额时优先扣赠送余额；不能保证注册即送额度或永久免费。仅完成API适配不等于已经免费调用或完成语义验收。[官方价格](https://api-docs.deepseek.com/quick_start/pricing/)

配置后重启`npm start`，运行`npm run doctor`查看配置是否齐全。诊断不发送模型请求，不显示密钥；`ready`只代表配置齐全。运行`npm run test:ai`才会执行真实24条验收，可能消耗账号余额。

DeepSeek使用官方Chat Completions接口、JSON模式，输出继续接受本项目Schema、词表、证据和作用范围校验。JSON模式只保证格式，实际语义仍需逐条验收。无自动重试，截断、空JSON、拒绝、余额不足、限流和网络故障均可恢复到手动模式。取消明确排除、放宽约束和历史建议继续走原确认流程。

OpenAI兼容保留为显式选项`AI_PROVIDER=openai`，使用独立的`OPENAI_API_KEY`；可通过OpenAI Developers安全配置流程管理。不会把一家的密钥发送给另一家，也不会自动切到付费供应商。

详见[DeepSeek接入说明](docs/DEEPSEEK_SETUP.md)及[线上体验步骤](docs/ONLINE_EXPERIENCE.md)。

## 验证

```sh
npm test
npm run test:report
npm run check:inputs
npm run build
npm run doctor
npm run test:ai
```

- 应用测试116项通过，含原40项推荐/购物车预期，另有8项DeepSeek、5项配置/线上验收客户端及2项模型证据测试。`test:report`写入`docs/validation/round6.json`、`round6.tap`及源码指纹。
- F10、F11及确认/取消/撤销、历史缓存确认、澄清追问已通过Chrome受控响应测试，证据在`round6-browser.json`。这验证交互与恢复，不代表真实模型理解通过。另有独立未配置服务的实际HTTP检查，不读取本机真实凭证。
- 本版核心回归记录为`round6-regression.json`，编辑与加菜回归为`round6-editing.json`。包括360/390/768/1440宽度，以及`/food-demo/`仓库子路径的静态选餐提交。
- `check:inputs`核对10份原始材料SHA-256；`build`生成公开资源白名单内的`dist/`，不包含服务器适配器、凭证或测试答案。
- `test:ai`在配置齐全时逐条实际调用模型（最多24次），记录请求、响应、模型、耗时、用量及程序应用前后状态。支持使用`AI_TEST_BASE_URL`验收实际托管后端；认证、额度或连接故障后停止后续调用。未配置时24项均为`not_run`，报告`blocked`并以非零状态退出；有调用成本。当前真实DeepSeek用例24通过、0失败、0未执行。首次运行18通过、6失败；修复通用操作契约和历史提取提示后，完整重跑通过。原验收预期未修改。

浏览器测试需要本机Chrome和单独安装的`playwright-core`，运行产品不需要它。设置`PLAYWRIGHT_MODULE`为其包目录，保持服务运行，执行：

```sh
node scripts/browser-check.mjs round6
node scripts/round3-browser.mjs round6
node scripts/round4-browser.mjs round6
```

`APP_URL`可设置核心/AI脚本的服务地址，默认`http://localhost:3000`。编辑回归脚本使用默认3000端口。受控响应截图上标注测试性质；`round6-manual-*.png`为独立未配置服务截图。`round6-live-browser.json`及`round6-live-*.png`记录实际DeepSeek浏览器调用。`node scripts/live-ai-browser.mjs`会额外发出两次真实请求，有调用成本，不包含在npm test或发布工作流内。

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

当前Pages默认连接`https://food-assistant-deepseek.onrender.com`；工作流允许用仓库Actions变量`PUBLIC_API_BASE`覆盖。普通`npm run build`仍生成独立手动体验包。后端已设置`ALLOWED_ORIGINS`及`AI_ACCESS_TOKEN`。访问者在页面填写体验访问码，模型API密钥始终只在后端。Node整站托管和Docker配置也已准备；Docker环境尚未实际运行。[GitHub Pages官方工作流说明](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)

页面底部“体验异常场景（模拟）”可模拟售罄、恢复可售和配送费调整。变动只影响当前用户本餐，保留商品与备注；重新核对当前明细后才允许提交。开始新餐或恢复示例会清除模拟供给变更。

F01—F15已在本版执行，F10/F11涉及AI的返回采用受控测试响应，不计真实AI语义通过。异常和跨来源接口记录见`docs/validation/round6-release.json`。A01—A24已在本地真实DeepSeek通过；公开GitHub页面到Render及DeepSeek的真实选餐、模拟下单和本次例外确认也已验证。详见[开发进度](docs/PROGRESS.md)。

逐条真实模型原文、饮食上下文与请求标识仅保留本地验收文件；GitHub公开汇总见`docs/validation/round6-ai-public.json`。确认、取消及Esc关闭弹窗后，AI面板同步显示结果，避免继续提示等待确认。
