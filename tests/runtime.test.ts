import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {World} from '../src/types';
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));

test('workerd: all controls public, validation, CORS, shared state and durable recovery',async t=>{
 const bundled=await build({stdin:{contents:`import worker from './src/worker';import {WorldObject} from './src/world-object';export default worker;export class TestWorldObject extends WorldObject {async seedWorld(world){await this.ctx.storage.put('world',world);}}`,resolveDir:process.cwd()},bundle:true,write:false,format:'esm',external:['cloudflare:workers']});
 const dir=await mkdtemp(join(tmpdir(),'cellworld-test-'));
 const options={...convertV4MiniflareOptions({modules:true,script:bundled.outputFiles[0].text,compatibilityDate:'2026-11-01',durableObjects:{WORLD:{className:'TestWorldObject',useSQLite:true}},bindings:{ALLOWED_ORIGINS:'https://cellworld.pages.dev'}}),resourcePersistencePath:dir};
 let mf=new Miniflare(options);
 const get=async()=>{const r=await mf.dispatchFetch('http://world/api/state');assert.equal(r.status,200);return await r.json() as any;};
 const send=(value:unknown)=>mf.dispatchFetch('http://world/api/controls',{method:'POST',headers:{Origin:'https://cellworld.pages.dev','Content-Type':'application/json'},body:JSON.stringify(value)});
 const change=async(value:unknown)=>{let r=await send(value);for(let i=0;[409,429].includes(r.status)&&i<40;i++){await sleep(270);r=await send(value);}return r;};
 try{
  const initial=await get();
  await t.test('concurrent requests never double-advance time; admin route and metadata are gone',async()=>{
   await Promise.all(Array.from({length:8},get));const after=await get();
   assert.ok(Math.abs((after.world.t-initial.world.t)-(after.world.wall-initial.world.wall)/1000)<1e-8);
   assert.equal('adminConfigured' in after,false);assert.equal((await mf.dispatchFetch('http://world/api/admin')).status,404);
  });
  await t.test('CORS rejects unrelated origins and permits controls preflight',async()=>{
   const denied=await mf.dispatchFetch('http://world/api/controls',{method:'POST',headers:{Origin:'https://evil.example'},body:'{"type":"reset"}'});assert.equal(denied.status,403);
   const preflight=await mf.dispatchFetch('http://world/api/controls',{method:'OPTIONS',headers:{Origin:'https://cellworld.pages.dev'}});assert.equal(preflight.headers.get('Access-Control-Allow-Origin'),'https://cellworld.pages.dev');assert.equal((await get()).world.generation,0);
  });
  await t.test('live timer streams snapshots and recovers monotonic revisions after restart',async()=>{
   const response=await mf.dispatchFetch('http://world/ws',{headers:{Upgrade:'websocket'}});
   assert.equal(response.status,101);
   const snapshots:any[]=[];
   response.webSocket!.addEventListener('message',(e:any)=>snapshots.push(JSON.parse(e.data)));
   response.webSocket!.accept();
   await sleep(1500);
   assert.ok(snapshots.length>=6,'live snapshots should arrive more often than checkpoints');
   const latest=snapshots.at(-1).world;
   assert.ok(snapshots.every((s,i)=>i===0||s.world.revision>=snapshots[i-1].world.revision));
   await mf.dispose();mf=new Miniflare(options);
   const recovered=await get();
   assert.ok(recovered.world.wall>=latest.wall);
   assert.ok(recovered.world.revision>=latest.revision);
   assert.equal(recovered.world.generation,latest.generation);
  });
  assert.equal((await change({type:'pause',running:false})).status,200);const paused=await get();
  await t.test('two WebSockets and reconnect share exact paused state',async()=>{
   const responses=await Promise.all([1,2].map(()=>mf.dispatchFetch('http://world/ws',{headers:{Upgrade:'websocket'}})));
   const snapshots=await Promise.all(responses.map(r=>{assert.equal(r.status,101);return new Promise<any>(resolve=>{r.webSocket!.addEventListener('message',(e:any)=>resolve(JSON.parse(e.data)),{once:true});r.webSocket!.accept();});}));
   assert.deepEqual(snapshots[0].world.cells,snapshots[1].world.cells);for(const r of responses)r.webSocket!.close();
   const refreshed=await get();assert.equal(refreshed.world.t,paused.world.t);assert.deepEqual(refreshed.world.cells,paused.world.cells);
  });
  await t.test('every control works without a token, including step, manual food and reset',async()=>{
   assert.equal((await change({type:'speed',value:10})).status,200);assert.equal((await change({type:'rate',value:1.7})).status,200);
   assert.equal((await change({type:'food',x:20,y:20})).status,200);const fed=await get();assert.equal(fed.world.foods.length,paused.world.foods.length+8);
   assert.equal((await change({type:'step'})).status,200);assert.ok(Math.abs((await get()).world.t-paused.world.t-1)<1e-8);
   assert.equal((await change({type:'reset'})).status,200);const reset=await get();assert.equal(reset.world.generation,1);assert.equal(reset.world.cells.length,100);assert.equal(reset.world.speed,1);assert.equal(reset.world.rate,1);
   assert.equal((await change({type:'pause',running:false})).status,200);
   assert.equal((await change({type:'speed',value:10})).status,200);assert.equal((await change({type:'rate',value:1.7})).status,200);
  });
  await t.test('public controls retain validation, mutation rate limits and method checks',async()=>{
   await sleep(270);assert.equal((await send({type:'speed',value:11})).status,400);assert.equal((await send({type:'reset'})).status,429);
   for(const value of [{type:'rate',value:-1},{type:'pause',running:'yes'},{type:'food',x:-1,y:0},{type:'unknown'}]){await sleep(270);assert.equal((await send(value)).status,400);}
   assert.equal((await mf.dispatchFetch('http://world/api/controls')).status,405);
  });
  const before=await get();await mf.dispose();mf=new Miniflare(options);
  await t.test('SQLite survives actual workerd shutdown with settings and exact paused state',async()=>{
   const after=await get();assert.equal(after.world.t,before.world.t);assert.deepEqual(after.world.cells,before.world.cells);assert.deepEqual(after.world.foods,before.world.foods);assert.equal(after.world.seed,before.world.seed);assert.equal(after.world.speed,10);assert.equal(after.world.rate,1.7);assert.equal(after.world.generation,1);
  });
  await mf.dispose();mf=new Miniflare(options);const ns=await mf.getDurableObjectNamespace('WORLD');const saved=structuredClone(before.world) as World;saved.running=true;saved.wall=Date.now()-86400000;await(ns.get(ns.idFromName('canonical-world-v1')) as any).seedWorld(saved);await mf.dispose();mf=new Miniflare(options);
  await t.test('bounded day-long recovery persists across interruption and blocks premature controls',async()=>{
   const a=await get();assert.ok(a.recoveryMs>86000000);assert.ok(a.world.wall-saved.wall<=10000);
   await mf.dispose();mf=new Miniflare(options);const b=await get();assert.ok(b.world.wall>a.world.wall);assert.ok(b.world.t>a.world.t);assert.equal(b.world.generation,saved.generation);assert.deepEqual(b.world.cells.slice(0,saved.cells.length).map(c=>c.id),saved.cells.map(c=>c.id));assert.ok(b.world.cells.filter(c=>c.alive).length<=100);assert.equal((await send({type:'reset'})).status,409);
  });
 }finally{await mf.dispose();await rm(dir,{recursive:true,force:true});}
});
