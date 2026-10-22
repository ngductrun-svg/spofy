import { previewBlocked } from '../server/deploy-policy.mjs';
if (previewBlocked(process.env)) throw new Error('PREVIEW_DATA_NOT_CONFIRMED: Dừng build trước migration. Chủ project phải xác nhận database test tách biệt và đặt PREVIEW_DATA_ISOLATED=true trong đúng context preview.');
console.log('Deploy context preflight: PASS');
