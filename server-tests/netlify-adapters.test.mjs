import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { createDatabase, normalizeResult } from '../netlify/server/database.mjs';
import { createStorage } from '../netlify/server/storage.mjs';

test('PostgreSQL adapter normalizes BIGINT counters and commits or rolls back actual transactions', async t => {
  const engine = new PGlite(); t.after(() => engine.close());
  let released=0;
  const pool={query:(sql,params)=>engine.query(sql,params),connect:async()=>({query:(sql,params)=>engine.query(sql,params),release:()=>released++})};
  const db=createDatabase(pool);
  await db.query('CREATE TABLE adapter_test (id INTEGER PRIMARY KEY, created_at BIGINT, login_count INTEGER)');
  await db.transaction(async tx=>{await tx.query('INSERT INTO adapter_test VALUES($1,$2,$3)',[1,1792222222222,2]);});
  await assert.rejects(db.transaction(async tx=>{await tx.query('INSERT INTO adapter_test VALUES(2,0,0)');throw new Error('rollback fixture');}),/rollback fixture/);
  const result=await db.query('SELECT * FROM adapter_test');
  assert.deepEqual(result.rows,[{id:1,created_at:1792222222222,login_count:2}]);
  assert.equal(released,2);
  assert.deepEqual(normalizeResult({rows:[{total:'123',last_login_at:null,name:'123'}]}).rows,[{total:123,last_login_at:null,name:'123'}]);
});

test('Blob adapter uses private named keys, bytes/metadata and strong reads', async()=>{
  const stored=new Map();
  const sdk={
    async set(key,bytes,{metadata}){stored.set(key,{data:Uint8Array.from(bytes).buffer,metadata});},
    async getWithMetadata(key,options){assert.equal(options.type,'arrayBuffer');assert.equal(options.consistency,'strong');return stored.get(key)??null;},
    async delete(key){stored.delete(key);},
  };
  const storage=createStorage(sdk);
  assert.equal(await storage.get('missing.png'),null);
  await storage.put('fixture.png',new Uint8Array([1,2,3]),{mime:'image/png',width:1,height:1});
  assert.deepEqual(await storage.get('fixture.png'),{data:new Uint8Array([1,2,3]),metadata:{mime:'image/png',width:1,height:1}});
  await storage.delete('fixture.png'); assert.equal(await storage.get('fixture.png'),null);
});
