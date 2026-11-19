# DeepSeek真实验收记录（0.6.1）

2026-11-20（Asia/Shanghai），用户明确允许使用当前DeepSeek充值余额完成本轮连通与语义验收。配置和余额只做只读检查，金额与密钥不纳入公开报告。

首次完整运行18项通过、6项失败。失败涉及删除操作携带多余值、食材字段名、把“其他不变”变成额外操作、混淆本餐与长期范围、历史条件提取遗漏。首次记录为validation/round6-ai-first.json，补充诊断为round6-ai-diagnostics.json；初版运行器未保存部分被校验器拒绝的原文，不能据此推测其具体输出。

修复采用通用操作字段表、空值规则、当前范围与确认规则、历史提取规则和JSON Schema字段枚举；未修改24条原始用例及预期。生成温度降为0，历史解析缓存版本升为1.1.0。程序仍拒绝不符合契约的输出，没有将错误字段静默改成成功。

随后完整重跑A01—A24：24通过、0失败、0未执行。最终报告validation/round6-ai.json包含实际请求、模型输出原文、模型/耗时/用量、应用前后状态与确认效果。供应商为DeepSeek，模型为deepseek-flash，使用官方Chat Completions与JSON模式；未把验收答案放入模型输入。

浏览器还通过两次真实模型请求验证新表述：“这顿主食选面食，鸡肉先避开”生成本餐要求并完成21元模拟订单；“这顿花生可以，长期不改”在确认后才写入本次例外，长期排除仍保留。证据为validation/round6-live-browser.json、round6-live-desktop.png、round6-live-mobile.png。

116项程序测试、受控AI交互回归与真实模型验收各有独立记录。测试、静态构建和GitHub发布不调用付费模型。真实验收报告属于本轮实测，不保证未来模型输出始终相同，公开后端与线上真实流程另有独立证据。

线上已完成：Render免费Node服务托管、后端DeepSeek密钥和体验访问码、精确前端来源，以及GitHub工作流的PUBLIC_API_BASE配置。公开前端实际通过真实要求解析到21元模拟订单，以及本次例外确认；HTTP预检、无访问码及非法来源防护通过。证据为round6-online.json、round6-online-live-browser.json、round6-hosted-guards.json。

界面后续修正确认/取消结果提示及Esc取消状态，适配器和24条语义所使用的契约保持不变。详细响应只保存在本地；GitHub公开round6-ai-public.json汇总。
