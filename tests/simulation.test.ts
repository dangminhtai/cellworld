import {test} from 'node:test';
import assert from 'node:assert/strict';
import {advance,createWorld,food,tick} from '../src/simulation';
import {action} from '../src/actions';

function isolated(){const s=createWorld(0);s.rate=0;s.foods=[];s.cells.slice(1).forEach(c=>c.alive=false);const c=s.cells[0];Object.assign(c,{x:450,y:290,direction:0,velocity:20,turnIn:3,target:null});return s;}
test('initial world has exactly 100 unique cells and no food, no reproduction',()=>{
 const s=createWorld(0);assert.equal(s.cells.length,100);assert.equal(new Set(s.cells.map(c=>c.id)).size,100);assert.equal(s.foods.length,0);
 advance(s,60000,1000);assert.equal(s.cells.length,100);
});
test('straight random wandering turns after 1.5–5.5s and reflects boundaries',()=>{
 const s=isolated(),c=s.cells[0];for(let i=0;i<30;i++)tick(s);assert.equal(c.direction,0);assert.ok(c.x>469&&c.x<471);
 c.turnIn=0;tick(s);assert.notEqual(c.direction,0);assert.ok(c.turnIn>=1.5&&c.turnIn<=5.5);
 c.x=895;c.direction=0;tick(s);assert.equal(c.x,894);assert.equal(c.direction,Math.PI);
});
test('90 world-pixel detection boundary preserves original strict search and inclusive retained target',()=>{
 const s=isolated(),c=s.cells[0];const f=food(s,450,380.001);s.foods=[f];tick(s);assert.equal(c.target,null);
 c.x=450;c.y=290;f.y=380;tick(s);assert.equal(c.target,null); // original new-target search is < 90²
 c.x=450;c.y=290;f.y=379.999;tick(s);assert.equal(c.target,f.id);assert.ok(c.direction>0);
 c.x=450;c.y=290;f.y=380;tick(s);assert.equal(c.target,f.id);
});
test('one food cannot be consumed twice, including competing cells',()=>{
 const s=isolated();s.cells[1].alive=true;Object.assign(s.cells[1],{x:450,y:290});s.foods=[food(s,450,290)];tick(s);
 assert.equal(s.cells[0].eaten+s.cells[1].eaten,1);assert.equal(s.foods.length,0);tick(s);assert.equal(s.cells[0].eaten+s.cells[1].eaten,1);
});
test('survives meal 100, dies only on 101, dead cells cannot move or eat',()=>{
 const s=isolated(),c=s.cells[0];c.eaten=99;s.foods=[food(s,c.x,c.y)];tick(s);assert.equal(c.eaten,100);assert.equal(c.alive,true);
 s.foods=[food(s,c.x,c.y)];tick(s);assert.equal(c.eaten,101);assert.equal(c.alive,false);
 const saved=structuredClone(c);s.foods=[food(s,c.x,c.y)];tick(s);assert.deepEqual(c,saved);assert.equal(s.foods.length,1);
});
test('no aging, starvation or collision death',()=>{
 const s=createWorld(0);s.foods=[];s.rate=0;s.cells.forEach(c=>{c.x=450;c.y=290;});advance(s,120000,2000);assert.ok(s.cells.every(c=>c.alive&&c.eaten===0));
});
test('save/restore keeps food target identity, PRNG, clock and all counters exactly',()=>{
 const s=createWorld(0);advance(s,5000);const copy=JSON.parse(JSON.stringify(s));assert.deepEqual(copy,s);
 advance(s,10000);advance(copy,10000);assert.deepEqual(copy,s);
});
test('same interval never advances twice; sub-quantum wall time is retained',()=>{
 const s=createWorld(0);advance(s,159);assert.equal(s.wall,100);const saved=structuredClone(s);advance(s,159);assert.deepEqual(s,saved);advance(s,200);assert.equal(s.wall,200);
});
test('deterministic long catch-up resumes after every persisted batch and changes no event order',()=>{
 const full=createWorld(0),batched=createWorld(0);advance(full,180000,10000);
 let resumed=batched;while(resumed.wall<180000){advance(resumed,180000,7);resumed=JSON.parse(JSON.stringify(resumed));}
 // Revision counts successful publications, so differs with batch count.
 resumed.revision=full.revision;assert.deepEqual(resumed,full);
});
test('pause, speed, step, rate, reset generation and action validation',()=>{
 let s=createWorld(0);action(s,{type:'pause',running:false});advance(s,5000);assert.equal(s.t,0);assert.equal(s.wall,5000);
 action(s,{type:'step'});assert.ok(Math.abs(s.t-1)<1e-10);action(s,{type:'speed',value:10});action(s,{type:'pause',running:true});advance(s,6000);assert.ok(Math.abs(s.t-11)<1e-9);
 for(const speed of [50,100]){action(s,{type:"speed",value:speed});assert.equal(s.speed,speed);}
 for(const a of [{type:'speed',value:11},{type:'rate',value:NaN},{type:'food',x:Infinity,y:0},{type:'unknown'},{type:'step'}]){const before=structuredClone(s);assert.throws(()=>action(s,a));assert.deepEqual(s,before);}
 const rev=s.revision;s=action(s,{type:'reset'});assert.equal(s.generation,1);assert.equal(s.revision,rev+1);assert.equal(s.cells.length,100);assert.equal(s.wall,6000);
});
test('same-size cells block movement, and larger cells eat smaller cells on contact',()=>{
 const s=isolated(),c=s.cells[0],other=s.cells[1];
 Object.assign(other,{alive:true,x:459,y:290,velocity:0});
 tick(s,1);assert.ok(c.x<=451);assert.equal(other.alive,true);
 Object.assign(c,{x:450,direction:0,eaten:20});
 tick(s,1);assert.equal(other.alive,false);
});
test('blocked cells drop their food target and move away before searching again',()=>{
 const s=isolated(),c=s.cells[0],other=s.cells[1];
 Object.assign(other,{alive:true,x:458,y:290,velocity:0});
 s.foods=[food(s,480,290)];
 tick(s);
 assert.equal(c.target,null);
 assert.ok((c.avoidUntil??0)>s.t);
 const x=c.x;
 tick(s);
 assert.ok(c.x<x);
 assert.equal(c.target,null);
});
test('fresh contact can produce one child and the fixed cap allows replacement after multiple deaths',()=>{
 for(const deaths of [0,1,5]){
  const s=createWorld(0);
  const [a,b]=s.cells;
  Object.assign(a,{x:100,y:100,direction:0,velocity:30,turnIn:3});
  Object.assign(b,{x:108,y:100,velocity:0,turnIn:3});
  s.cells.slice(2).forEach((c,i)=>Object.assign(c,{x:250+(i%10)*50,y:50+Math.floor(i/10)*50,velocity:0,alive:i>=deaths}));
  s.seed=2;s.rate=0;
  // Keep the living population one below 100 in both scenarios.
  if(deaths===5)for(let i=0;i<4;i++)s.cells.push({...s.cells[7+i],id:101+i,y:570});
  tick(s);
  assert.equal(s.cells.filter(c=>c.alive).length,100);
  assert.equal(s.cells.length,deaths===0?100:deaths===1?101:105);
  if(deaths===1)assert.ok(s.cells.at(-1)?.sex);
 }
});
