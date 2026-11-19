# 0.5.0部署与体验

已发布：[今天吃什么 · 在线体验](https://wantingworking-oss.github.io/food-assistant-demo/)。仓库：[food-assistant-demo](https://github.com/wantingworking-oss/food-assistant-demo)。

[GitHub Actions构建与部署](https://github.com/wantingworking-oss/food-assistant-demo/actions/runs/44592694224)均成功。云端Node 24.22.2、Ubuntu 26.04下101项测试通过，10份原始输入核对通过。已实际用Chrome打开线上页面，核对发布资源字节，完成21元选餐提交与刷新、28元补规格、静态AI未配置恢复及390px布局。证据见validation/round5-deployment.json、round5-online.json。

当前上线形态为手动体验。商家、价格、历史和订单均为模拟；真实AI仍缺后端凭证与托管配置。首次上传曾遗漏HTML/CSS，已补齐并逐一核对83份源码；后续成功构建已解决该问题。


## GitHub Pages手动体验

1. 项目全部源码放在仓库根目录，保留`.github/workflows/pages.yml`。
2. 在仓库Settings → Pages的Build and deployment下，将Source设为GitHub Actions。
3. 推送main或手动执行“Check and deploy demo”。build先执行101项测试、原10份材料指纹检查、构建；deploy发布dist到github-pages环境。PR不会发布。
4. 在Actions确认build和deploy成功，打开该次deploy输出的地址验证进入助手、选餐和模拟提交。

默认不用任何密钥，AI明确未配置。此版本的商家、价格、历史与交易均为模拟；所有草稿在当前浏览器本地保存，三组用户用于示例隔离。

依据：[GitHub Pages自定义工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)、[官方deploy-pages](https://github.com/actions/deploy-pages)、[configure-pages的enablement权限要求](https://github.com/actions/configure-pages/blob/main/action.yml)。首次启用Pages需要仓库设置；普通工作流GITHUB_TOKEN不能代替该首次设置。

## 可选：完整AI体验

GitHub Pages不能运行Node后端。可把本项目Node服务部署到支持Node 24的服务，或使用提供的Dockerfile。运行命令为`node server.js`，监听平台PORT；HOST设置为0.0.0.0。

后端环境变量：AI_MODE=real、OPENAI_API_KEY、FOOD_ASSISTANT_MODEL、AI_ACCESS_TOKEN，以及ALLOWED_ORIGINS（例如https://wantingworking-oss.github.io）。访问码由体验者填写；不要把模型密钥或体验访问码写到PUBLIC_API_BASE、前端资源或Actions变量中。

在GitHub仓库Settings → Secrets and variables → Actions → Variables中新增PUBLIC_API_BASE，值为后端HTTPS origin，例如https://your-backend.example（示意值，不是已部署地址），重新运行发布。后端允许来源必须是前端origin，不含/food-assistant-demo/路径，不使用通配符。

已在本机通过两个origin的实际HTTP/CORS/预检和访问码流程；供应商返回为测试注入，没有发生真实模型调用。真实模型需执行`npm run test:ai`并审阅A01—A24，以及在实际托管环境复验。当前缺少模型凭证、型号及后端托管配置。

Docker运行示意：`docker build -t food-assistant .`，然后通过平台环境变量配置并映射3000端口。此开发环境没有Docker，未验证容器实际构建或启动；不要将配置文件存在视为容器验收通过。

## 本地重开

双击start-local.cmd，或在项目目录执行npm start，保持进程运行后访问http://localhost:3000。该地址只能访问当前运行机器；电脑关机或进程退出后不会继续提供服务。
