# 部署与体验（0.6.1）

已发布：[今天吃什么 · 在线体验](https://wantingworking-oss.github.io/food-assistant-demo/)。源码：[food-assistant-demo](https://github.com/wantingworking-oss/food-assistant-demo)。

前端通过GitHub Pages部署，真实DeepSeek请求由[Render后端](https://food-assistant-deepseek.onrender.com/api/health)处理。当前为用户确认工作区中的新加坡免费实例；没有创建付费实例或数据库。DeepSeek按请求消耗账号余额。

进入助手，展开“AI服务访问码”，输入本机私有文件“体验访问码.txt”中的内容并保存，再输入饮食要求。访问码只在当前标签页保存；API Key仅在Render运行环境和本机.env中，不进入Pages、仓库、截图或交付包。无需保持本机电脑或服务开启即可使用线上版。

## 实际验证

- 116项程序测试通过，10份原始输入SHA-256不变。
- 本地A01—A24真实DeepSeek语义验收24通过；公开GitHub前端到Render/DeepSeek的真实请求、21元模拟订单、本次例外确认通过。
- 公开页面选餐、规格补选、刷新恢复、无访问码恢复及390px布局通过；线上资源与本地发布源码字节一致。
- 后端OPTIONS预检204、正确允许来源、无访问码401、其他来源403通过，不为这些防护检查调用模型。

准确提交和部署证据见validation/round6-deployment.json、round6-online.json、round6-hosted-guards.json。逐条模型原文与请求上下文保留本地；公开汇总为round6-ai-public.json。配置文件存在不等于Docker验收：当前开发环境没有Docker，容器构建和启动未执行。

## 发布与运行配置

main推送触发.github/workflows/pages.yml：测试、原输入检查、构建、发布；PR只检查。Source为GitHub Actions。工作流PUBLIC_API_BASE默认指向当前Render origin，仓库Actions变量同名值可覆盖。普通npm run build不设置该变量，生成手动模式的静态包。

Render使用Node 24.22.1，构建命令npm test && npm run check:inputs，启动node server.js，HOST=0.0.0.0并监听平台PORT。后端配置AI_MODE=real、AI_PROVIDER=deepseek、DEEPSEEK_API_KEY、FOOD_ASSISTANT_MODEL=deepseek-flash、AI_TIMEOUT_MS=20000、AI_ACCESS_TOKEN；ALLOWED_ORIGINS仅为https://wantingworking-oss.github.io，不包含仓库路径。

[Render服务管理](https://dashboard.render.com/web/srv-dbvln060tbcc738tcjmg)。环境变量在Environment中管理；更改后需等待新的部署生效。模型Key与访问码不要写入Actions变量PUBLIC_API_BASE或前端配置。

## 免费实例首次访问

[Render官方说明](https://render.com/docs/free)：空闲15分钟后休眠，再访问约需一分钟启动。如果首次AI请求超时，等待后重试；原要求和输入保留，也可继续手动操作。免费资源受平台月用量限制，不保证持续在线。

所有商家、商品、历史和订单均为模拟，不产生真实交易。保存用于当前浏览器示例，不提供账户或跨设备同步。

## 本地重开

双击start-local.cmd，或项目目录执行npm start，再访问http://localhost:3000。本地运行依赖本机进程保持启动；当前本地真实AI服务继续保留供体验。
