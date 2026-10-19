import { createCloudHandler } from '../server/app.mjs';
import { netlifyDatabase } from '../server/database.mjs';
import { netlifyStorage } from '../server/storage.mjs';
import { runtimeSettings } from '../server/deploy-context.mjs';
import { previewBlocked } from '../../server/deploy-policy.mjs';

let handler;
export default async function(request) {
  try {
    const env = await runtimeSettings();
    if (previewBlocked(env)) return Response.json({error:{code:'PREVIEW_DATA_NOT_CONFIRMED',message:'API xem thử đang tắt. Cần xác nhận database kiểm thử tách biệt trước khi bật.'}},{status:503,headers:{'Cache-Control':'no-store','Netlify-CDN-Cache-Control':'no-store'}});
    handler ??= createCloudHandler({ db: netlifyDatabase(), storage: netlifyStorage(), env });
    return await handler(request);
  } catch {
    // Configuration errors must not expose database URLs, keys or stack traces.
    return Response.json({ error: { code: 'SERVICE_NOT_READY', message: 'Máy chủ chưa kết nối được dữ liệu. Chủ website hãy kiểm tra Database và Function logs trong Netlify.' } }, {
      status: 503, headers: { 'Cache-Control': 'no-store', 'Netlify-CDN-Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
    });
  }
}
