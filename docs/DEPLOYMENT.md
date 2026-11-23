# ����������

��ǰ0.8.0ǰ�˺�Render��˾��Ѹ��£������������ȣ�û�з�����������������ʱ�����û�ѡ�����ʾ����͡�[���湹������](https://github.com/wantingworking-oss/food-assistant-demo/actions/runs/45130742248)�ɹ�������17����ͨ��������֤�ݼ�validation/round8-deployment.json��round8-online.json��

�ѷ�����[�����ʲô �� ��������](https://wantingworking-oss.github.io/food-assistant-demo/)��Դ�룺[food-assistant-demo](https://github.com/wantingworking-oss/food-assistant-demo)��

ǰ��ͨ��GitHub Pages������ʵDeepSeek������[Render���](https://food-assistant-deepseek.onrender.com/api/health)��������ǰΪ�û�ȷ�Ϲ������е��¼������ʵ����û�д�������ʵ�������ݿ⡣DeepSeek�����������˺���

0.8.0�������֣������СA����Ҫ���µġ���������Ҫ�󡱣�չ�������ڵġ�AI��������롱�����뱾��˽���ļ������������.txt���е����ݲ����棬��������ʳҪ�󡣷�����ֻ�ڵ�ǰ��ǩҳ���棻API Key����Render���л����ͱ���.env�У�������Pages���ֿ⡢��ͼ�򽻸��������豣�ֱ������Ի����������ʹ�����ϰ档

## ʵ����֤

- ��ǰ0.8.0��133��������ͨ����15���������̡�16��Ҫ�󵯴���ԭ�к��ġ��༭���쳣��������ͨ����10��ԭʼ����SHA-256���䡣R02/R16չʾ˳������������޶���
- 0.6.1��ʷ��¼������A01��A24��ʵDeepSeek��������24ͨ��������GitHubǰ�˵�Render/DeepSeek����ʵ����ģ���µ�ͨ����0.8.0ʹ���ܿ�AI��Ӧ�����Ƽ���ҳ�����̣��������ʵ��˷��������������û����������ģ�͵��á�
- ����ҳ��ѡ�͡����ѡ��ˢ�»ָ����޷�����ָ���390px����ͨ����������Դ�뱾�ط���Դ���ֽ�һ�¡�
- ���OPTIONSԤ��204����ȷ������Դ���޷�����401��������Դ403ͨ������Ϊ��Щ����������ģ�͡�

��ǰ�ύ�벿��֤�ݼ�validation/round8-deployment.json��round8-online.json��0.6.1��ʷ��¼��round6-deployment.json��round6-online.json��round6-hosted-guards.json������ģ��ԭ�������������ı������أ���������Ϊround6-ai-public.json�������ļ����ڲ�����Docker���գ���ǰ��������û��Docker����������������δִ�С�

## ��������������

main���ʹ���.github/workflows/pages.yml�����ԡ�ԭ�����顢������������PRֻ��顣SourceΪGitHub Actions��������PUBLIC_API_BASEĬ��ָ��ǰRender origin���ֿ�Actions����ͬ��ֵ�ɸ��ǡ���ͨnpm run build�����øñ����������ֶ�ģʽ�ľ�̬����

Renderʹ��Node 24.22.1����������npm test && npm run check:inputs������node server.js��HOST=0.0.0.0������ƽ̨PORT���������AI_MODE=real��AI_PROVIDER=deepseek��DEEPSEEK_API_KEY��FOOD_ASSISTANT_MODEL=deepseek-flash��AI_TIMEOUT_MS=20000��AI_ACCESS_TOKEN��ALLOWED_ORIGINS��Ϊhttps://wantingworking-oss.github.io���������ֿ�·����

[Render�������](https://dashboard.render.com/web/srv-dbvln060tbcc738tcjmg)������������Environment�й��������ĺ���ȴ��µĲ�����Ч��ģ��Key������벻Ҫд��Actions����PUBLIC_API_BASE��ǰ�����á�

## ���ʵ���״η���

[Render�ٷ�˵��](https://render.com/docs/free)������15���Ӻ����ߣ��ٷ���Լ��һ��������������״�AI����ʱ���ȴ������ԣ�ԭҪ������뱣����Ҳ�ɼ����ֶ������������Դ��ƽ̨���������ƣ�����֤�������ߡ�

�����̼ҡ���Ʒ����ʷ�Ͷ�����Ϊģ�⣬��������ʵ���ס��������ڵ�ǰ�����ʾ�������ṩ�˻�����豸ͬ����

## �����ؿ�

˫��start-local.cmd������ĿĿ¼ִ��npm start���ٷ���http://localhost:3000���������������������̱�����������ǰ������ʵAI����������������顣

0.8.0����״̬������¼��validation/round8-deployment.json��δ��֤���·������ܸ������ֳɹ���¼��

����Render����ͨ������Git�ֿ�URL��������Ҫ�ֶ��������ύ��������autoDeploy��־�������Git�ṩ�����ӡ�����ͨ�����з�����2571d3eaeda94bf90725f9aa18ee4f33280c3d71���ѵ���live���˶�0.8.0����״̬����Դ���������ĵ������ռ�¼�ύ�����ظ������ˡ�
