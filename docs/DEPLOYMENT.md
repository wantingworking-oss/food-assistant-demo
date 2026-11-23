# 部署与体验

当前0.8.0前端和Render后端均已更新，面条主餐优先；没有符合条件的面条主餐时，经用户选择才显示替代餐。[本版构建发布](https://github.com/wantingworking-oss/food-assistant-demo/actions/runs/45130742248)成功，线上17项检查通过。完整证据见validation/round8-deployment.json、round8-online.json。

已发布：[今天吃什么 · 在线体验](https://wantingworking-oss.github.io/food-assistant-demo/)。源码：[food-assistant-demo](https://github.com/wantingworking-oss/food-assistant-demo)。

前端通过GitHub Pages部署，真实DeepSeek请求由[Render后端](https://food-assistant-deepseek.onrender.com/api/health)处理。当前为用户确认工作区中的新加坡免费实例；没有创建付费实例或数据库。DeepSeek按请求消耗账号余额。

0.8.0进入助手，点击“小A已有要求”下的“调整本餐要求”，展开弹窗内的“AI服务访问码”，输入本机私有文件“体验访问码.txt”中的内容并保存，再输入饮食要求。访问码只在当前标签页保存；API Key仅在Render运行环境和本机.env中，不进入Pages、仓库、截图或交付包。无需保持本机电脑或服务开启即可使用线上版。

## 实际验证

- 当前0.8.0共133项程序测试通过，15项面条流程、16项要求弹窗及原有核心、编辑、异常浏览器检查通过；10份原始输入SHA-256不变。R02/R16展示顺序按新需求独立修订。
- 0.6.1历史记录：本地A01—A24真实DeepSeek语义验收24通过，公开GitHub前端到Render/DeepSeek的真实请求及模拟下单通过。0.8.0使用受控AI响应验收推荐和页面流程，另检查真实后端访问码防护；本轮没有新增付费模型调用。
- 公开页面选餐、规格补选、刷新恢复、无访问码恢复及390px布局通过；线上资源与本地发布源码字节一致。
- 后端OPTIONS预检204、正确允许来源、无访问码401、其他来源403通过，不为这些防护检查调用模型。

当前提交与部署证据见validation/round8-deployment.json、round8-online.json；0.6.1历史记录见round6-deployment.json、round6-online.json、round6-hosted-guards.json。逐条模型原文与请求上下文保留本地；公开汇总为round6-ai-public.json。配置文件存在不等于Docker验收：当前开发环境没有Docker，容器构建和启动未执行。

## 发布与运行配置

main推送触发.github/workflows/pages.yml：测试、原输入检查、构建、发布；PR只检查。Source为GitHub Actions。工作流PUBLIC_API_BASE默认指向当前Render origin，仓库Actions变量同名值可覆盖。普通npm run build不设置该变量，生成手动模式的静态包。

Render使用Node 24.22.1，构建命令npm test && npm run check:inputs，启动node server.js，HOST=0.0.0.0并监听平台PORT。后端配置AI_MODE=real、AI_PROVIDER=deepseek、DEEPSEEK_API_KEY、FOOD_ASSISTANT_MODEL=deepseek-flash、AI_TIMEOUT_MS=20000、AI_ACCESS_TOKEN；ALLOWED_ORIGINS仅为https://wantingworking-oss.github.io，不包含仓库路径。

[Render服务管理](https://dashboard.render.com/web/srv-dbvln060tbcc738tcjmg)。环境变量在Environment中管理；更改后需等待新的部署生效。模型Key与访问码不要写入Actions变量PUBLIC_API_BASE或前端配置。

## 免费实例首次访问

[Render官方说明](https://render.com/docs/free)：空闲15分钟后休眠，再访问约需一分钟启动。如果首次AI请求超时，等待后重试；原要求和输入保留，也可继续手动操作。免费资源受平台月用量限制，不保证持续在线。

所有商家、商品、历史和订单均为模拟，不产生真实交易。保存用于当前浏览器示例，不提供账户或跨设备同步。

## 本地重开

双击start-local.cmd，或项目目录执行npm start，再访问http://localhost:3000。本地运行依赖本机进程保持启动；当前本地真实AI服务继续保留供体验。

0.8.0发布状态独立记录在validation/round8-deployment.json；未验证的新发布不能复用上轮成功记录。

现有Render服务通过公开Git仓库URL创建，需要手动部署新提交；仅设置autoDeploy标志不能替代Git提供商连接。本次通过现有服务部署2571d3eaeda94bf90725f9aa18ee4f33280c3d71，已到达live并核对0.8.0健康状态及资源。后续仅文档和验收记录提交无需重复部署后端。
