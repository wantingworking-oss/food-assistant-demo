# 部署与体验

已发布：[今天吃什么 · 在线体验](https://wantingworking-oss.github.io/food-assistant-demo/)。仓库：[food-assistant-demo](https://github.com/wantingworking-oss/food-assistant-demo)。

当前发布形态为GitHub Pages手动体验。0.6.1已在本地完成116项应用测试、24条真实DeepSeek语义验收与实际浏览器AI流程；线上AI后端尚未托管。发布的准确提交、工作流与线上复验记录见validation/round6-deployment.json、round6-online.json。

模型密钥只存在本机.env；本轮付费调用经用户授权。Render已连接，目标工作区待确认；后续托管现有Node服务时，密钥仍应配置为后端运行时环境变量。尚未部署后端，不宣称线上AI已经可用。


## GitHub Pages手动体验

1. 项目全部源码放在仓库根目录，保留`.github/workflows/pages.yml`。
2. 在仓库Settings → Pages的Build and deployment下，将Source设为GitHub Actions。
3. 推送main或手动执行“Check and deploy demo”。build先执行应用测试、原10份材料指纹检查、构建；deploy发布dist到github-pages环境。PR不会发布。
4. 在Actions确认build和deploy成功，打开该次deploy输出的地址验证进入助手、选餐和模拟提交。

默认不用任何密钥，AI明确未配置。此版本的商家、价格、历史与交易均为模拟；所有草稿在当前浏览器本地保存，三组用户用于示例隔离。

依据：[GitHub Pages自定义工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)、[官方deploy-pages](https://github.com/actions/deploy-pages)、[configure-pages的enablement权限要求](https://github.com/actions/configure-pages/blob/main/action.yml)。首次启用Pages需要仓库设置；普通工作流GITHUB_TOKEN不能代替该首次设置。

## 可选：完整AI体验

GitHub Pages不能运行Node后端。可把本项目Node服务部署到支持Node 24的服务，或使用提供的Dockerfile。运行命令为`node server.js`，监听平台PORT；HOST设置为0.0.0.0。

后端环境变量：AI_MODE=real、AI_PROVIDER=deepseek、DEEPSEEK_API_KEY、FOOD_ASSISTANT_MODEL=deepseek-flash、AI_ACCESS_TOKEN，以及ALLOWED_ORIGINS（例如https://wantingworking-oss.github.io）。访问码由体验者填写；不要把模型密钥或体验访问码写到PUBLIC_API_BASE、前端资源或Actions变量中。

在GitHub仓库Settings → Secrets and variables → Actions → Variables中新增PUBLIC_API_BASE，值为后端HTTPS origin，例如https://your-backend.example（示意值，不是已部署地址），重新运行发布。后端允许来源必须是前端origin，不含/food-assistant-demo/路径，不使用通配符。

已在本机通过两个origin的实际HTTP/CORS/预检和访问码流程；供应商返回为测试注入，没有发生真实模型调用。真实模型需执行`npm run test:ai`并审阅A01—A24，以及在实际托管环境复验。本机DeepSeek真实测试已经通过；当前需完成后端托管与线上验证。DeepSeek官方API按量计费，不保证免费；详细步骤见DEEPSEEK_SETUP.md。

Docker运行示意：`docker build -t food-assistant .`，然后通过平台环境变量配置并映射3000端口。此开发环境没有Docker，未验证容器实际构建或启动；不要将配置文件存在视为容器验收通过。

## 本地重开

双击start-local.cmd，或在项目目录执行npm start，保持进程运行后访问http://localhost:3000。该地址只能访问当前运行机器；电脑关机或进程退出后不会继续提供服务。
