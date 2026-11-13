import type { World, Food, Cell } from './types';
export const W=900,H=585,N=100,MAXFOODS=700;
export const clamp=(x:number,a:number,b:number)=>Math.min(b,Math.max(a,x));
const distance=(a:{x:number;y:number},b:{x:number;y:number})=>(a.x-b.x)**2+(a.y-b.y)**2;
const radius=(c:Cell)=>c.eaten>=60?10:c.eaten>=20?5:4;

function separate(c:Cell, cells:Cell[]){
 const r=radius(c);
 const margin=Math.max(6,r);
 c.x=clamp(c.x,margin,W-margin);
 c.y=clamp(c.y,margin,H-margin);
 const fits=(x:number,y:number)=>cells.every(other=>other===c||!other.alive||
  (x-other.x)**2+(y-other.y)**2>=(r+radius(other))**2);
 if(fits(c.x,c.y))return;
 for(let offset=1;;offset++){
  for(let angle=0;angle<8;angle++){
   const x=clamp(c.x+offset*Math.cos(angle*Math.PI/4),margin,W-margin);
   const y=clamp(c.y+offset*Math.sin(angle*Math.PI/4),margin,H-margin);
   if(fits(x,y)){c.x=x;c.y=y;return;}
  }
 }
}

function move(c:Cell,cells:Cell[],dt:number,onContact:(other:Cell)=>void){
 const margin=Math.max(6,radius(c));
 const nextX=c.x+Math.cos(c.direction)*c.velocity*dt;
 const nextY=c.y+Math.sin(c.direction)*c.velocity*dt;
 const dx=clamp(nextX,margin,W-margin)-c.x,dy=clamp(nextY,margin,H-margin)-c.y;
 const lengthSquared=dx*dx+dy*dy;
 if(!lengthSquared){
  if(nextX<margin||nextX>W-margin)c.direction=Math.PI-c.direction;
  if(nextY<margin||nextY>H-margin)c.direction=-c.direction;
  return;
 }
 let stop=1;
 let blocker:Cell|undefined;
 let predatorAt=Infinity;
 const prey:{cell:Cell;at:number}[]=[];
 for(const other of cells){
  if(other===c||!other.alive)continue;
  const x=other.x-c.x,y=other.y-c.y;
  const reach=radius(c)+radius(other);
  const projection=x*dx+y*dy;
  if(projection<=0)continue;
  const discriminant=projection**2-lengthSquared*(x*x+y*y-reach**2);
  if(discriminant<=0)continue;
  const at=Math.max(0,(projection-Math.sqrt(discriminant))/lengthSquared);
  if(at>1)continue;
  if(radius(c)>radius(other))prey.push({cell:other,at});
  else if(radius(c)<radius(other))predatorAt=Math.min(predatorAt,at);
  else if(at-1e-8<stop){stop=Math.max(0,at-1e-8);blocker=other;}
 }
 if(predatorAt<=stop){c.alive=false;stop=predatorAt;}
 for(const hit of prey)if(hit.at<=stop)hit.cell.alive=false;
 c.x+=dx*stop;c.y+=dy*stop;
 if(blocker&&c.alive)onContact(blocker);
 if(stop<1){c.direction+=Math.PI;return true;}
 else {
  if(nextX<margin||nextX>W-margin)c.direction=Math.PI-c.direction;
  if(nextY<margin||nextY>H-margin)c.direction=-c.direction;
 }
}

export function rand(s:World,a=0,b=1){s.seed=(Math.imul(s.seed,1664525)+1013904223)>>>0;return a+(b-a)*s.seed/4294967296}
export function food(s:World,x=rand(s,8,W-8),y=rand(s,8,H-8)):Food{return {id:s.nextFood++,x,y}}
export function createWorld(now:number):World {
const s:World={schema:1,seed:2026,cells:[],foods:[],nextFood:1,t:0,debt:0,running:true,speed:1,rate:1,wall:now,revision:0,generation:0};
s.cells=Array.from({length:N},(_,i)=>({id:i+1,sex:i%2===0?"male":"female",x:rand(s,10,W-10),y:rand(s,10,H-10),direction:rand(s,-Math.PI,Math.PI),velocity:rand(s,18,33),turnIn:rand(s,1.5,5.5),target:null,eaten:0,alive:true,flash:0}));
for(const c of s.cells)separate(c,s.cells);
return s;
}
function reproduce(s:World,a:Cell,b:Cell){
 if(!a.alive||!b.alive||sex(a)===sex(b))return;
 const dead=s.cells.filter(c=>!c.alive).length;
 if(s.cells.length-dead>=N||rand(s)>=0.5)return;
 const x=(a.x+b.x)/2,y=(a.y+b.y)/2;
 for(let angle=0;angle<8;angle++){
  const px=clamp(x+20*Math.cos(angle*Math.PI/4),6,W-6);
  const py=clamp(y+20*Math.sin(angle*Math.PI/4),6,H-6);
  if(s.cells.some(c=>c.alive&&distance(c,{x:px,y:py})<(radius(c)+4)**2))continue;
  s.cells.push({id:s.cells.at(-1)!.id+1,sex:rand(s)<0.5?'male':'female',x:px,y:py,
   direction:rand(s,-Math.PI,Math.PI),velocity:rand(s,18,33),turnIn:rand(s,1.5,5.5),
   target:null,eaten:0,alive:true,flash:0});
  return;
 }
}

const sex=(c:Cell)=>c.sex??(c.id%2?'male':'female');

export function tick(s: World, dt = 1/30){
let {cells, foods, rate, debt, t} = s;
const random=(a=0,b=1)=>rand(s,a,b);
const makeFood=()=>food(s);
t+=dt;debt+=5*rate*dt;
while(debt>=1){if(foods.length<MAXFOODS)foods.push(makeFood());debt--}
const contacts=s.contacts??={};
for(const [key,[a,b]] of Object.entries(contacts)){
 const first=cells[a-1],second=cells[b-1];
 if(!first?.alive||!second?.alive||distance(first,second)>(radius(first)+radius(second)+0.001)**2)delete contacts[key];
}
const encounters:[Cell,Cell][]=[];
for(const c of cells){
if(!c.alive)continue;
c.flash=Math.max(0,c.flash-dt);
const avoiding=(c.avoidUntil??0)>t;
let index=-1,best=90*90;
if(!avoiding && c.target !== null){let i=foods.findIndex(f=>f.id===c.target);if(i>=0&&distance(c,foods[i])<=best){index=i;best=distance(c,foods[i])}else c.target=null}
if(!avoiding && index===-1){for(let i=0;i<foods.length;i++){let d=distance(c,foods[i]);if(d<best){best=d;index=i}}}
if(index>=0){
const f=foods[index];c.target=f.id;
if(best<Math.max(7,radius(c))**2){
const previousRadius=radius(c);
foods.splice(index,1);c.target=null;c.eaten++;c.flash=.5;
if(c.eaten>100){c.alive=false;continue}
if(radius(c)!==previousRadius)separate(c,cells);
}else{
let desired=Math.atan2(f.y-c.y,f.x-c.x);
let delta=Math.atan2(Math.sin(desired-c.direction),Math.cos(desired-c.direction));
c.direction+=clamp(delta,-3.3*dt,3.3*dt);
}
}else{
if(!avoiding) c.target=null;c.turnIn-=dt;
if(!avoiding && c.turnIn<=0){c.direction=random(-Math.PI,Math.PI);c.turnIn=random(1.5,5.5)}
}
separate(c,cells);
if(move(c,cells,dt,other=>{
 const a=Math.min(c.id,other.id),b=Math.max(c.id,other.id),key=a+':'+b;
 if(sex(c)!==sex(other)&&!contacts[key]){
  contacts[key]=[a,b];
  encounters.push([c,other]);
 }
}) && c.alive){
 c.target=null;
 c.direction+=random(-Math.PI/4,Math.PI/4);
 c.avoidUntil=t+random(0.5,1);
}
}
for(const [a,b] of encounters)reproduce(s,a,b);
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
