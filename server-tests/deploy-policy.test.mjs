import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createPageHandler } from '../netlify/functions/page.mjs';
import { buildContext, previewBlocked } from '../server/deploy-policy.mjs';
import { publicArticlePresentation } from '../server/article-display.mjs';

test('unconfirmed preview build stops before application checks and metadata never queries a database',async()=>{
  const result=spawnSync(process.execPath,['scripts/check-deploy-context.mjs'],{cwd:new URL('../',import.meta.url),env:{...process.env,CONTEXT:'deploy-preview',PREVIEW_DATA_ISOLATED:'false'},encoding:'utf8'});
  assert.notEqual(result.status,0);assert.match(result.stderr,/PREVIEW_DATA_NOT_CONFIRMED/);
  let calls=0;
  const shell=await readFile(new URL('../index.html',import.meta.url),'utf8');
  const handler=createPageHandler({loadShell:async()=>shell,database:()=>{calls++;throw new Error('Database must not initialize');},env:{CONTEXT:'deploy-preview'}});
  assert.equal((await handler(new Request('https://preview.example/khoa-hoc/secret-draft'))).status,503);
  assert.equal(calls,0);
  assert.equal(previewBlocked({CONTEXT:'branch-deploy'}),true);
  assert.deepEqual(buildContext({CONTEXT:'production',RESEND_API_KEY:'test-secret'}),{context:'production',previewDataIsolated:false});
});

test('editorial presentation preserves stored content and metadata while applying only confirmed text edits',()=>{
  const original={title:'[CALLING FOR A HOT DRINK]',slug:'calling-for-a-hot-drink',category:'toan-hoc',blocks:[{type:'paragraph',text:'cùng nhậu dạo bước\\nĐoạn nguồn chưa đầy đủ.'}]};
  const before=JSON.stringify(original), shown=publicArticlePresentation(original);
  assert.equal(JSON.stringify(original),before);
  assert.equal(shown.originalTitle,original.title);assert.equal(shown.category,'toan-hoc');assert.equal(shown.sourceUrl,null);
  assert.match(shown.blocks[0].text,/cùng nhau dạo bước\n/);assert.equal(shown.editorialReview.status,'needs-source');
  assert.ok(!shown.blocks[0].text.includes('nghiên cứu cho thấy'));
});
