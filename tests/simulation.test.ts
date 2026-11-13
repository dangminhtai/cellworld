import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {advance,createWorld,food,tick} from '../src/simulation';
import {action} from '../src/actions';

function isolated(){const s=createWorld(0);s.rate=0;s.foods=[];s.cells.slice(1).forEach(c=>c.alive=false);const c=s.cells[0];Object.assign(c,{x:450,y:290,direction:0,velocity:20,turnIn:3,target:null});return s;}
test('initial world has exactly 100 unique cells and 180 food, no reproduction',()=>{
 const s=createWorld(0);assert.equal(s.cells.length,100);assert.equal(new Set(s.cells.map(c=>c.id)).size,100);assert.equal(s.foods.length,180);
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
 for(const a of [{type:'speed',value:11},{type:'rate',value:NaN},{type:'food',x:Infinity,y:0},{type:'unknown'},{type:'step'}]){const before=structuredClone(s);assert.throws(()=>action(s,a));assert.deepEqual(s,before);}
 const rev=s.revision;s=action(s,{type:'reset'});assert.equal(s.generation,1);assert.equal(s.revision,rev+1);assert.equal(s.cells.length,100);assert.equal(s.wall,6000);
});
test('extracted engine matches untouched original rules for 60 simulated seconds',()=>{
 const original=readFileSync(new URL('./fixtures/original-engine.js',import.meta.url),'utf8');
 const context=vm.createContext({});vm.runInContext(original+';for(let i=0;i<1800;i++)tick(1/30);globalThis.result=JSON.stringify({seed,t,debt,cells,foods});',context);
 const expected=JSON.parse(context.result),s=createWorld(0);for(let i=0;i<1800;i++)tick(s);
 assert.equal(s.seed,expected.seed);assert.equal(s.t,expected.t);assert.equal(s.debt,expected.debt);
 assert.deepEqual(s.foods.map(({x,y})=>({x,y})),expected.foods);
 assert.deepEqual(s.cells.map(c=>({...c,target:c.target===null?null:(({x,y})=>({x,y}))(s.foods.find(f=>f.id===c.target)!)})),expected.cells);
});
