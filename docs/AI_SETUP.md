# 第四轮AI接入与验收说明

版本0.5.0，2026-11-20（Asia/Shanghai）。代码已接入，真实模型尚未调用；批次4的完成条件尚未满足。

## 配置与启动

在项目根目录复制`.env.example`为`.env`，设置：

| 变量 | 内容 |
| --- | --- |
| `AI_MODE` | `real`启用实际模型调用；默认`disabled` |
| `OPENAI_API_KEY` | 账户实际可用的API凭证，仅保存在本机或托管后端 |
| `FOOD_ASSISTANT_MODEL` | 可用型号；模板候选为`gpt-5.4-mini`，实际可用性待验证 |
| `AI_TIMEOUT_MS` | 默认20000毫秒，可配置1—120000；页面最多等待22秒 |
| `PORT` | 默认3000，本地仅监听127.0.0.1 |

重新启动`npm start`后打开本地页面。仅配置密钥不会显示“真实AI已连接”；第一次有效实际响应通过校验后才显示成功，健康检查附上最近成功的模型、时间、耗时与用量。错误响应不会带回上游请求头或密钥。

模型接口基于[OpenAI结构化输出文档](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses)，型号候选见[官方模型说明](https://developers.openai.com/api/docs/models/gpt-5.4-mini)。结构化输出保障格式，不能代替真实语义验收。

## 运行契约

`POST /api/interpret`，`Content-Type: application/json`。同源请求，正文最多64KiB，用户输入最多500字。服务全局最多两路模型调用，无自动重试。默认仅监听本机；对外部署设置HOST=0.0.0.0，并配置AI_ACCESS_TOKEN。远程来源通过ALLOWED_ORIGINS精确列出。

请求含`request_id`、`task_id`、`requirements_version`、`mode`、`text`、必要饮食`context`和至多6条`history_notes`。历史备注ID与文本由服务端对照原始示例资料，不接受客户端扩大词表或替换来源；发送内容剔除无关字段。模式为`user_input`或`history_notes`。

模型只返回`status`、`operations`、`clarifications`、`unsupported_parts`、`record_annotations`、`error`。服务端校验后回填请求身份。浏览器与状态层再次核对请求、用户、任务和要求版本，不匹配即丢弃。操作仍交给原有规则规划器，不让模型计算费用、改规格或下单。

历史建议按用户、解析器版本和历史来源/纠正内容缓存；切用户隔离，来源变化失效，重新整理可显式刷新。归属纠正须点击确认。履约信息仅展示，不写饮食偏好。取消订单中的饮食备注可成为待确认线索，非本人记录不推断本人偏好。

## 真实验收

配置后执行`npm run test:ai`。它读取原始A01—A24作为测试输入，期望仅供断言，未作为模型输入。逐项保存实际响应、调用用量、状态效果、待确认状态和确认后的效果至`docs/validation/round5-ai.json`。已实现语义与最终条件断言；需要结合原始预期逐项审阅实际输出，发现遗漏仍应记为失败。

未配置时不会调用模型，会写出24项`not_run`、总体`blocked`并返回非零退出状态。实际调用失败则记录失败，不补固定响应。不要将测试记录中的调用成功等同于已在线部署。

当前环境缺少上述真实配置，实际模型名、调用范围、延迟、用量和语义质量均未验证。18项AI自动测试使用注入传输或真实本地HTTP；浏览器F10/F11使用受控响应；都不计入真实A用例通过数量。

## GitHub衔接

静态构建只保留浏览器模块和示例数据。设置构建变量PUBLIC_API_BASE为AI后端的HTTPS origin，前端使用该后端的/api/health及/api/interpret；默认空值沿用同源地址。后端设置ALLOWED_ORIGINS为前端origin（例如https://wantingworking-oss.github.io，不含仓库路径），并配置AI_ACCESS_TOKEN。访问者在页面“AI服务访问码”中填写体验访问码，只存当前标签页，不是OpenAI密钥。

健康接口可公开读取是否需要访问码；实际模型调用须校验Bearer访问码，CORS仅回显允许来源。访问码用于小范围Demo，不提供真实账户或个人权限管理。完整部署步骤见DEPLOYMENT.md。
