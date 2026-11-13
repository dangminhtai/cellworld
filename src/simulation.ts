import type { World, Food } from './types';
export const W=900,H=585,N=100,MAXFOODS=700;
export const clamp=(x:number,a:number,b:number)=>Math.min(b,Math.max(a,x));
const distance=(a:{x:number;y:number},b:{x:number;y:number})=>(a.x-b.x)**2+(a.y-b.y)**2;
export function rand(s:World,a=0,b=1){s.seed=(Math.imul(s.seed,1664525)+1013904223)>>>0;return a+(b-a)*s.seed/4294967296}
export function food(s:World,x=rand(s,8,W-8),y=rand(s,8,H-8)):Food{return {id:s.nextFood++,x,y}}
export function createWorld(now:number):World {
const s:World={schema:1,seed:2026,cells:[],foods:[],nextFood:1,t:0,debt:0,running:true,speed:1,rate:1,wall:now,revision:0,generation:0};
s.cells=Array.from({length:N},(_,i)=>({id:i+1,x:rand(s,10,W-10),y:rand(s,10,H-10),direction:rand(s,-Math.PI,Math.PI),velocity:rand(s,18,33),turnIn:rand(s,1.5,5.5),target:null,eaten:0,alive:true,flash:0}));
s.foods=Array.from({length:180},()=>food(s));return s;
}
export function tick(s: World, dt = 1/30){
let {cells, foods, rate, debt, t} = s;
const random=(a=0,b=1)=>rand(s,a,b);
const makeFood=()=>food(s);
t+=dt;debt+=5*rate*dt;
while(debt>=1){if(foods.length<MAXFOODS)foods.push(makeFood());debt--}
for(const c of cells){
if(!c.alive)continue;
c.flash=Math.max(0,c.flash-dt);
let index=-1,best=90*90;
if(c.target !== null){let i=foods.findIndex(f=>f.id===c.target);if(i>=0&&distance(c,foods[i])<=best){index=i;best=distance(c,foods[i])}else c.target=null}
if(index===-1){for(let i=0;i<foods.length;i++){let d=distance(c,foods[i]);if(d<best){best=d;index=i}}}
if(index>=0){
const f=foods[index];c.target=f.id;
if(best<49){
foods.splice(index,1);c.target=null;c.eaten++;c.flash=.5;
if(c.eaten>100){c.alive=false;continue}
}else{
let desired=Math.atan2(f.y-c.y,f.x-c.x);
let delta=Math.atan2(Math.sin(desired-c.direction),Math.cos(desired-c.direction));
c.direction+=clamp(delta,-3.3*dt,3.3*dt);
}
}else{
c.target=null;c.turnIn-=dt;
if(c.turnIn<=0){c.direction=random(-Math.PI,Math.PI);c.turnIn=random(1.5,5.5)}
}
c.x+=Math.cos(c.direction)*c.velocity*dt;c.y+=Math.sin(c.direction)*c.velocity*dt;
if(c.x<6||c.x>W-6){c.x=clamp(c.x,6,W-6);c.direction=Math.PI-c.direction}
if(c.y<6||c.y>H-6){c.y=clamp(c.y,6,H-6);c.direction=-c.direction}
}
s.t=t;s.debt=debt;
}

// Integer 100ms wall quanta; each quantum always executes exactly 3 * speed ticks.
// Batch boundaries never affect the PRNG or floating-point operation order.
export function advance(s:World,now:number,maxQuanta=100,budgetMs=Infinity){
const start=performance.now();let n=0;
while(s.wall+100<=now && n<maxQuanta){
if(s.running)for(let i=0;i<3*s.speed;i++)tick(s);
s.wall+=100;n++;
if(performance.now()-start>=budgetMs)break;
}
if(n)s.revision++;return Math.max(0,now-s.wall);
}
