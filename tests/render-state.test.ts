import {test} from 'node:test';
import assert from 'node:assert/strict';
import '../render-state.js';
const Buffer=(globalThis as any).CellworldRenderBuffer;
function world(revision:number,x:number,extra:Record<string,unknown>={}){
 return {revision,generation:0,running:true,cells:[{id:1,x,y:10,alive:true,eaten:3,flash:0}],...extra};
}
test('rendering interpolates received positions and leaves authoritative snapshots untouched',()=>{
 const b=new Buffer(),first=world(1,0),next=world(2,20),saved=structuredClone(next);
 b.push(first,0);b.push(next,500);assert.equal(b.sample(500)[0].x,0);assert.equal(b.sample(750)[0].x,10);assert.equal(b.sample(1000)[0].x,20);
 assert.deepEqual(next,saved);assert.equal(b.sample(100000)[0].x,20);assert.equal(b.moving,false);
});
test('new snapshot starts from the visible position, including network jitter, without extrapolation',()=>{
 const b=new Buffer();b.push(world(1,0),0);b.push(world(2,20),500);const visible=b.sample(750)[0].x;
 b.push(world(3,40),750);assert.equal(b.sample(750)[0].x,visible);assert.ok(b.sample(900)[0].x>visible);assert.ok(b.sample(900)[0].x<40);
 b.push(world(4,100),10000);assert.ok(b.duration<=1000);assert.equal(b.sample(20000)[0].x,100);
});
test('pause, step while paused, reset and recovery snap without blending historical states',()=>{
 const b=new Buffer();b.push(world(1,0),0);b.push(world(2,20),500);
 b.push(world(3,25,{running:false}),600);assert.equal(b.sample(600)[0].x,25);assert.equal(b.moving,false);
 b.push(world(4,30,{running:false}),700);assert.equal(b.sample(700)[0].x,30);
 b.push(world(5,80,{generation:1}),800);assert.equal(b.sample(800)[0].x,80);
 b.push(world(6,100,{generation:1}),900,10000);assert.equal(b.sample(900)[0].x,100);assert.equal(b.moving,false);
 b.push(world(7,110,{generation:1}),1000,0);assert.equal(b.sample(1000)[0].x,110);
});
test('stale and duplicate snapshots cannot rewind or restart animation; death uses latest state immediately',()=>{
 const b=new Buffer();b.push(world(1,0),0);b.push(world(2,20),500);b.sample(750);
 assert.equal(b.push(world(1,999),750),false);assert.equal(b.push(world(2,999),750),false);assert.equal(b.sample(750)[0].x,10);
 const dead=world(3,30);dead.cells[0].alive=false;dead.cells[0].eaten=101;b.push(dead,800);
 assert.equal(b.sample(800)[0].alive,false);assert.equal(b.sample(800)[0].x,30);assert.equal(b.sample(800)[0].eaten,101);
});
test('unchanged or all-dead positions do not keep a frame loop alive',()=>{
 const b=new Buffer();b.push(world(1,0),0);b.push(world(2,0),500);assert.equal(b.moving,false);
 const dead=world(3,20);dead.cells[0].alive=false;b.push(dead,1000);assert.equal(b.moving,false);
});
