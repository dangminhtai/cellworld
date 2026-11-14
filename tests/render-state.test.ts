import {test} from 'node:test';
import assert from 'node:assert/strict';
import '../render-state.js';
const Buffer=(globalThis as any).CellworldRenderBuffer;
function world(revision:number,x:number,extra:Record<string,unknown>={}){
 return {revision,generation:0,running:true,cells:[{id:1,x,y:10,alive:true,eaten:3}],
 monster:{x:x+10,y:20},...extra};
}
test('buffer interpolates cells and monster with two frames of delay, without mutating snapshots',()=>{
 const b=new Buffer(),next=world(2,10),saved=structuredClone(next);
 b.push(world(1,0),0);b.push(next,100);
 assert.equal(b.sample(200)[0].x,0);
 assert.equal(b.sample(250)[0].x,5);
 assert.equal(b.monster.x,15);
 assert.equal(b.sample(300)[0].x,10);
 assert.equal(b.moving,false);
 assert.deepEqual(next,saved);
});
test('jitter and recovery keep buffered motion instead of snapping',()=>{
 const b=new Buffer();
 b.push(world(1,0),0);
 b.push(world(2,10),100,100000);
 b.push(world(3,25),250,99900);
 const x=b.sample(300)[0].x;
 assert.ok(x>0&&x<10);
 assert.ok(b.sample(400)[0].x>x);
 assert.equal(b.sample(10000)[0].x,25);
 assert.equal(b.monster.x,35);
 assert.equal(b.moving,false);
});
test('pause, paused step, reset and long disconnection clear old interpolation',()=>{
 const b=new Buffer();
 b.push(world(1,0),0);b.push(world(2,10),100);
 b.push(world(3,20,{running:false}),150);
 assert.equal(b.sample(150)[0].x,20);
 assert.equal(b.monster.x,30);
 assert.equal(b.moving,false);
 b.push(world(4,30,{running:false}),200);
 assert.equal(b.sample(200)[0].x,30);
 b.push(world(5,40,{generation:1}),250);
 assert.equal(b.sample(250)[0].x,40);
 b.push(world(6,100,{generation:1}),5000);
 assert.equal(b.sample(5000)[0].x,100);
});
test('revision ordering, death and births use the latest authoritative state',()=>{
 const b=new Buffer();
 b.push(world(1,0),0);b.push(world(2,10),100);
 assert.equal(b.push(world(1,999),150),false);
 assert.equal(b.push(world(2,999),150),false);
 const dead=world(3,20);dead.cells[0].alive=false;
 b.push(dead,200);assert.equal(b.sample(200)[0].alive,false);
 assert.equal(b.sample(200)[0].x,20);
 const born=world(4,30);born.cells=[{id:2,x:30,y:10,alive:true,eaten:0}];
 b.push(born,300);
 assert.equal(b.sample(300)[0].id,2);
 assert.equal(b.sample(300)[0].x,30);
});
test('monster continues animating when all cells have died and buffer stays bounded',()=>{
 const b=new Buffer();
 b.push(world(1,0,{cells:[]}),0);
 b.push(world(2,10,{cells:[]}),100);
 assert.equal(b.moving,true);
 b.sample(250);assert.equal(b.monster.x,15);
 for(let i=3;i<100;i++)b.push(world(i,i),i*100);
 assert.ok(b.frames.length<=32);
 b.sample(20000);assert.equal(b.moving,false);
});
