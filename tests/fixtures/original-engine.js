// Original browser engine from baseline 100-cell implementation; regression oracle.
const W=900,H=585,N=100,MAXFOODS=700;
let seed=2026,cells=[],foods=[],selected=null,t=0,running=true,speed=1,rate=1,debt=0,lag=0,previous=0,uiDelay=0;
const random=(a=0,b=1)=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return a+(b-a)*seed/4294967296};
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const makeFood=(x=random(8,W-8),y=random(8,H-8))=>({x,y});
const distance=(a,b)=>(a.x-b.x)**2+(a.y-b.y)**2;
seed=2026;t=0;debt=0;lag=0;speed=1;rate=1;running=true;selected=null;
cells=Array.from({length:N},(_,i)=>({id:i+1,x:random(10,W-10),y:random(10,H-10),direction:random(-Math.PI,Math.PI),velocity:random(18,33),turnIn:random(1.5,5.5),target:null,eaten:0,alive:true,flash:0}));
foods=Array.from({length:180},()=>makeFood());
function tick(dt){
t+=dt;debt+=5*rate*dt;
while(debt>=1){if(foods.length<MAXFOODS)foods.push(makeFood());debt--}
for(const c of cells){
if(!c.alive)continue;
c.flash=Math.max(0,c.flash-dt);
let index=-1,best=90*90;
if(c.target){let i=foods.indexOf(c.target);if(i>=0&&distance(c,foods[i])<=best){index=i;best=distance(c,foods[i])}else c.target=null}
if(index===-1){for(let i=0;i<foods.length;i++){let d=distance(c,foods[i]);if(d<best){best=d;index=i}}}
if(index>=0){
const f=foods[index];c.target=f;
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
}
