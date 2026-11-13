import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type { World } from '../src/types';

const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
test('workerd: auth, CORS, shared WebSockets, persistence, restart and bounded recovery',async t=>{
 // Test-only RPC seeds a durable timestamp; never included in the production Worker.
 const bundled=await build({stdin:{contents:`import worker from './src/worker';import {WorldObject} from './src/world-object';export default worker;export class TestWorldObject extends WorldObject {async seedWorld(world){await this.ctx.storage.put('world',world);}}`,resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'browser',external:['cloudflare:workers']});
 const dir=await mkdtemp(join(tmpdir(),'cellworld-test-'));
 const options={...convertV4MiniflareOptions({modules:true,script:bundled.outputFiles[0].text,compatibilityDate:'2026-11-01',durableObjects:{WORLD:{className:'TestWorldObject',useSQLite:true}},bindings:{ADMIN_TOKEN:'test-only-not-production',ALLOWED_ORIGINS:'http://127.0.0.1:5173,https://cellworld.pages.dev'}}),resourcePersistencePath:dir};
 let mf=new Miniflare(options);
 const get=async()=>{const r=await mf.dispatchFetch('http://world/api/state');assert.equal(r.status,200);return await r.json() as any;};
 const admin=async(data:unknown)=>mf.dispatchFetch('http://world/api/admin',{method:'POST',headers:{Authorization:'Bearer test-only-not-production','Content-Type':'application/json'},body:JSON.stringify(data)});
 const control=async(data:unknown)=>mf.dispatchFetch('http://world/api/controls',{method:'POST',headers:{Origin:'https://cellworld.pages.dev','Content-Type':'application/json'},body:JSON.stringify(data)});
 try{
  const initial=await get();assert.equal(initial.world.cells.length,100);
  await t.test('concurrent requests advance the elapsed wall interval only once',async()=>{
   await Promise.all(Array.from({length:8},get));const after=await get();
   assert.ok(Math.abs((after.world.t-initial.world.t)-(after.world.wall-initial.world.wall)/1000)<1e-8);
  });
  await t.test('unauthorized and cross-origin writes cannot reset canonical state',async()=>{
   for(const headers of [{},{Authorization:'Bearer wrong'}]){const r=await mf.dispatchFetch('http://world/api/admin',{method:'POST',headers,body:'{"type":"reset"}'});assert.equal(r.status,401);}
   const denied=await mf.dispatchFetch('http://world/api/admin',{method:'POST',headers:{Origin:'https://evil.example',Authorization:'Bearer test-only-not-production'},body:'{"type":"reset"}'});assert.equal(denied.status,403);
   const preflight=await mf.dispatchFetch('http://world/api/admin',{method:'OPTIONS',headers:{Origin:'https://cellworld.pages.dev'}});assert.equal(preflight.headers.get('Access-Control-Allow-Origin'),'https://cellworld.pages.dev');assert.equal((await get()).world.generation,0);
  });
  let pauseResponse=await admin({type:'pause',running:false});
  for(let i=0;pauseResponse.status===409&&i<40;i++){await sleep(270);pauseResponse=await admin({type:'pause',running:false});}
  assert.equal(pauseResponse.status,200);
  const paused=await get();
  await t.test('two clients and F5/reconnection share exact paused world',async()=>{
   const a=await mf.dispatchFetch('http://world/ws',{headers:{Upgrade:'websocket'}}),b=await mf.dispatchFetch('http://world/ws',{headers:{Upgrade:'websocket'}});
   assert.equal(a.status,101);assert.equal(b.status,101);
   const snapshot=(ws:any)=>new Promise<any>(resolve=>{ws.addEventListener('message',(e:any)=>resolve(JSON.parse(e.data)),{once:true});ws.accept();});
   const [sa,sb]=await Promise.all([snapshot(a.webSocket),snapshot(b.webSocket)]);
   assert.deepEqual(sa.world.cells,sb.world.cells);assert.equal(sa.world.t,paused.world.t);
   a.webSocket!.close();b.webSocket!.close();const refresh=await get();assert.equal(refresh.world.t,paused.world.t);assert.deepEqual(refresh.world.cells,paused.world.cells);
  });
  await t.test('validated and rate-limited admin actions',async()=>{
   await sleep(260);assert.equal((await admin({type:'speed',value:999})).status,400);
   assert.equal((await admin({type:'reset'})).status,429);await sleep(260);
   assert.equal((await admin({type:'food',x:20,y:20})).status,200);
   assert.equal((await get()).world.foods.length,paused.world.foods.length+8);
  });
  await t.test('public speed/rate are validated, persisted and shared; other actions remain protected',async()=>{
   assert.equal((await control({type:'speed',value:10})).status,200);
   assert.equal((await control({type:'rate',value:1.7})).status,429);await sleep(260);
   assert.equal((await control({type:'rate',value:1.7})).status,200);
   const state=await get();assert.equal(state.world.speed,10);assert.equal(state.world.rate,1.7);assert.equal(state.world.t,paused.world.t);
   for(const value of [{type:'speed',value:11},{type:'speed',value:'10'},{type:'rate',value:-1},{type:'rate',value:2.1}]){
    await sleep(260);assert.equal((await control(value)).status,400);
   }
   for(const value of [{type:'reset'},{type:'pause',running:true},{type:'step'},{type:'food',x:20,y:20}]){
    await sleep(260);assert.equal((await control(value)).status,403);
   }
   const after=await get();assert.equal(after.world.generation,state.world.generation);assert.equal(after.world.running,false);assert.deepEqual(after.world.foods,state.world.foods);assert.equal(after.world.speed,10);assert.equal(after.world.rate,1.7);
   const denied=await mf.dispatchFetch('http://world/api/controls',{method:'POST',headers:{Origin:'https://evil.example'},body:'{"type":"speed","value":1}'});assert.equal(denied.status,403);
   assert.equal((await mf.dispatchFetch('http://world/api/controls')).status,405);
  });
  const before=await get();await mf.dispose();mf=new Miniflare(options);
  await t.test('SQLite survives actual workerd shutdown and recreation',async()=>{
   const after=await get();assert.equal(after.world.t,before.world.t);assert.deepEqual(after.world.cells,before.world.cells);assert.deepEqual(after.world.foods,before.world.foods);assert.equal(after.world.seed,before.world.seed);assert.ok(after.world.wall>=before.world.wall);assert.equal(after.world.speed,10);assert.equal(after.world.rate,1.7);
  });
  await mf.dispose();
  // Seed a deliberately old durable timestamp while the object is not running.
  mf=new Miniflare(options);const ns=await mf.getDurableObjectNamespace('WORLD');const id=ns.idFromName('canonical-world-v1');
  const saved=structuredClone(before.world) as World;saved.running=true;saved.wall=Date.now()-86400000;await (ns.get(id) as any).seedWorld(saved);await mf.dispose();mf=new Miniflare(options);
  await t.test('day-long inactivity exposes backlog and persists bounded progress across interruption',async()=>{
   const a=await get();assert.ok(a.recoveryMs>86000000);assert.ok(a.world.wall-saved.wall<=10000);assert.ok(a.world.t>saved.t);
   await mf.dispose();mf=new Miniflare(options);const b=await get();assert.ok(b.world.wall>a.world.wall);assert.ok(b.world.t>a.world.t);assert.equal(b.world.generation,saved.generation);assert.equal(b.world.cells.length,100);
   const denied=await admin({type:'reset'});assert.equal(denied.status,409);
  });
  await t.test('public controls also work when ADMIN_TOKEN is not configured',async()=>{
   const noAdmin=new Miniflare({...convertV4MiniflareOptions({modules:true,script:bundled.outputFiles[0].text,compatibilityDate:'2026-11-01',durableObjects:{WORLD:{className:'TestWorldObject',useSQLite:true}},bindings:{ALLOWED_ORIGINS:'https://cellworld.pages.dev'}}),resourcePersistencePath:join(dir,'no-admin')});
   try{
    let r=await noAdmin.dispatchFetch('http://world/api/controls',{method:'POST',body:'{"type":"rate","value":0}'});
    for(let i=0;r.status===409&&i<20;i++){await sleep(260);r=await noAdmin.dispatchFetch('http://world/api/controls',{method:'POST',body:'{"type":"rate","value":0}'});}
    assert.equal(r.status,200);const s=await(await noAdmin.dispatchFetch('http://world/api/state')).json() as any;
    assert.equal(s.adminConfigured,false);assert.equal(s.world.rate,0);
    assert.equal((await noAdmin.dispatchFetch('http://world/api/admin',{method:'POST',body:'{"type":"reset"}'})).status,401);
   }finally{await noAdmin.dispose();}
  });
 }finally{await mf.dispose();await rm(dir,{recursive:true,force:true});}
});
