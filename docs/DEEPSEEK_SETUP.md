# DeepSeek接入（0.6.0）

本轮按用户选择接入DeepSeek。适配代码与自动化测试完成，实际DeepSeek密钥及账号额度尚待配置；未宣称真实语义验收通过。

## 本机配置

1. 到[DeepSeek控制台](https://platform.deepseek.com/api_keys)创建新API Key。
2. 在资源管理器打开本项目，双击configure-deepseek.cmd。
3. 在隐藏输入中粘贴新Key并回车；看到“Saved locally”后关闭窗口。
4. 重启npm start，运行npm run doctor检查配置；只有执行npm run test:ai才会实际调用模型。

脚本仅写本机.env，保留其他已有设置，不输出密钥。可以取消空输入。不要在聊天或仓库中填写真实Key。若密钥曾发到聊天，先在控制台撤销并换新。

配置项：AI_PROVIDER=deepseek、DEEPSEEK_API_KEY、AI_MODE=real、FOOD_ASSISTANT_MODEL=deepseek-flash、AI_TIMEOUT_MS=20000。OpenAI模式有单独的OPENAI_API_KEY；不混用、不自动回退。

## 费用与质量

[官方价格页](https://api-docs.deepseek.com/quick_start/pricing/)显示API按量计费；有赠送余额时优先扣赠送余额，但并未承诺所有账号持续免费。DeepSeek网页聊天与本项目调用的API是不同入口。接入代码本身不能保证免费额度。

[官方JSON输出说明](https://api-docs.deepseek.com/guides/json_mode/)要求JSON模式和明确的JSON提示。程序还会逐项校验Schema、字段值、来源证据、作用范围和确认流程。JSON可解析不等于24条语义全部通过。

## 诊断与验收

`npm run doctor`只检查配置或后端健康，不调用模型，不输出Key。`ready`表示配置齐全，不能当作AI已经验证。

`npm run test:ai`按A01—A24执行真实调用，检查输出及状态效果，记录round6-ai.json。未配置时24项not_run、总体blocked。余额、鉴权、限流或连接错误后停止后续请求，避免重复调用。没有固定成功响应。

验收线上后端时，在本机设置AI_TEST_BASE_URL为后端HTTPS origin，并设置AI_ACCESS_TOKEN为体验访问码。此方式只向自己的后端发送访问码，不发送任何供应商密钥。后端未提供的用量字段写null，不推测费用或模型用量。

## GitHub Pages与后端

Pages继续托管前端，不能运行服务端模型调用。真实AI需要托管Node后端，环境中配置DeepSeek密钥、HOST=0.0.0.0、允许来源ALLOWED_ORIGINS及AI_ACCESS_TOKEN。然后将仓库Actions变量PUBLIC_API_BASE设为后端HTTPS origin，重新发布。

供应商密钥仅保存在后端；前端填写的是体验访问码。当前尚未配置可用的公开DeepSeek后端，因此线上仍明确显示手动模式。
