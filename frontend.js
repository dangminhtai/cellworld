"use strict";
const $=id=>document.getElementById(id),canvas=$("canvas"),ctx=canvas.getContext("2d");
const W=900,H=585,N=100;
let cells=[],foods=[],selected=null,selectedId=null,t=0,world=null,socket,attempt=0,lastMessage=0,recoveryMs=Infinity;
let revision=-1;
let editingRate=false,recovering=true;
const commandVersion={};
const renderBuffer=new CellworldRenderBuffer();
let renderedCells=[],animationFrame=null;
function scheduleDraw(){
if(animationFrame!==null||document.hidden)return;
animationFrame=requestAnimationFrame(renderFrame);
}
function renderFrame(now){
animationFrame=null;renderedCells=renderBuffer.sample(now);draw();
if(renderBuffer.moving)scheduleDraw();
}
document.addEventListener('visibilitychange',()=>{
if(document.hidden){if(animationFrame!==null)cancelAnimationFrame(animationFrame);animationFrame=null;}
else scheduleDraw();
});
const status=$("network"),sync=$("sync");
const local=['localhost','127.0.0.1'].includes(location.hostname);
const endpoint=window.CELLWORLD_API || (local?'http://127.0.0.1:8787':'');
function controls(){
const connected=socket?.readyState===WebSocket.OPEN&&!recovering;
document.querySelectorAll('.controls button,.controls input').forEach(b=>b.disabled=!connected);
$("step").disabled=!connected||world?.running;
if(world){$("pause").textContent=world.running?'⏸ Tạm dừng':'▶ Tiếp tục';if(!editingRate){$("rate").value=world.rate*100;$("rateLabel").textContent=Math.round(world.rate*100)+'%';}document.querySelectorAll('.speed').forEach(b=>b.classList.toggle('active',Number(b.dataset.speed)===world.speed));}
}
async function command(value){
const version=commandVersion[value.type]=(commandVersion[value.type]||0)+1;
const send=()=>fetch(endpoint+'/api/controls',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)});
try{let res=await send();
for(let retry=0;[429,409].includes(res.status)&&retry<8;retry++){
await res.text();await new Promise(resolve=>setTimeout(resolve,350));
if(version!==commandVersion[value.type])return false;
res=await send();
}
if(!res.ok)throw Error(await res.text());
return true;
}catch(e){sync.textContent='Lệnh thất bại: '+e.message;return false;}
}
function connect(){
if(!endpoint){status.textContent='Chưa cấu hình backend';sync.textContent='Đặt CELLWORLD_API trong config.js (xem README).';controls();return;}
status.textContent='Đang kết nối…';
try{const url=new URL('/ws',endpoint);url.protocol=url.protocol==='https:'?'wss:':'ws:';socket=new WebSocket(url);
socket.onmessage=e=>{try{const data=JSON.parse(e.data);if(data.type!=='snapshot'||data.world.schema!==1)return;
lastMessage=Date.now();attempt=0;status.textContent='Đã kết nối';
if(data.world.revision<revision)return;
revision=data.world.revision;world=data.world;cells=world.cells;foods=world.foods;t=world.t;selected=cells.find(c=>c.id===selectedId)||null;
recoveryMs=data.recoveryMs;recovering=data.recovering??(recoveryMs>=100);sync.textContent=recovering?'Đang khôi phục: còn '+(recoveryMs/1000).toFixed(1)+' giây thực':'Đã đồng bộ · revision '+revision+' · mọi người cùng điều khiển thế giới';
renderBuffer.push(world,performance.now(),recovering?Math.max(100,recoveryMs):0);
controls();update();scheduleDraw();}catch{sync.textContent='Dữ liệu không hợp lệ';socket.close();}};
socket.onclose=()=>{status.textContent='Mất kết nối · đang thử lại';controls();setTimeout(connect,Math.min(30000,500*2**Math.min(attempt++,6))+Math.random()*300);};
socket.onerror=()=>socket.close();
}catch(e){status.textContent='Backend URL không hợp lệ';sync.textContent=e.message;}
}
setInterval(()=>{if(socket?.readyState===WebSocket.OPEN&&lastMessage&&Date.now()-lastMessage>15000)socket.close();},5000);
function draw(){
ctx.fillStyle="#0c252b";ctx.fillRect(0,0,W,H);
ctx.strokeStyle="rgba(129,222,186,.07)";ctx.beginPath();
for(let x=0;x<W;x+=45){ctx.moveTo(x,0);ctx.lineTo(x,H)}
for(let y=0;y<H;y+=45){ctx.moveTo(0,y);ctx.lineTo(W,y)}ctx.stroke();
ctx.fillStyle="#e2e9a2";for(const f of foods)ctx.fillRect(f.x-1.5,f.y-1.5,3,3);
for(const c of renderedCells){
if(!c.alive)continue;
const radius=c.eaten>=60?6:c.eaten>=20?5:4;
ctx.fillStyle=c.eaten>=60?"#eb6868":c.eaten>=20?"#f7eb8e":"#81e2a0";
ctx.beginPath();ctx.arc(c.x,c.y,radius,0,Math.PI*2);ctx.fill();
}
const focus=renderedCells.find(c=>c.id===selectedId);
if(focus){
ctx.strokeStyle=focus.alive?"#c7f59d":"#e78585";ctx.lineWidth=1.4;ctx.setLineDash([5,5]);ctx.beginPath();ctx.arc(focus.x,focus.y,90,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
ctx.beginPath();ctx.arc(focus.x,focus.y,12,0,Math.PI*2);ctx.stroke();
ctx.fillStyle="#eafdd2";ctx.font="14px monospace";ctx.fillText("C-"+focus.id,focus.x+15,focus.y-10);
}
}
function update(){
const alive=cells.filter(c=>c.alive);
$("alive").textContent=alive.length;$("dead").textContent=N-alive.length;$("foods").textContent=foods.length;
$("average").textContent=alive.length?(alive.reduce((n,c)=>n+c.eaten,0)/alive.length).toFixed(1):"0";
$("clock").textContent=String(Math.floor(t/60)).padStart(2,"0")+":"+String(Math.floor(t)%60).padStart(2,"0");
if(selected)$("inspect").textContent="Tế bào #"+selected.id+" | "+(selected.alive?"Còn sống":"Đã chết")+" | Ăn "+selected.eaten+" hạt | Bán kính 90px"+(selected.alive?"":"");
}

$("pause").onclick=()=>command({type:'pause',running:!world.running});
$("step").onclick=()=>command({type:'step'});
$("reset").onclick=()=>{if(confirm('Tạo lại thế giới chung cho TẤT CẢ người xem?'))command({type:'reset'});};
$("rate").onpointerdown=()=>{editingRate=true;};
$("rate").oninput=e=>{editingRate=true;$("rateLabel").textContent=e.target.value+'%';};
$("rate").onpointerup=()=>{editingRate=false;};
$("rate").onblur=()=>{editingRate=false;controls();};
$("rate").onchange=e=>{editingRate=false;command({type:'rate',value:Number(e.target.value)/100});};
document.querySelectorAll('.speed').forEach(b=>b.onclick=()=>command({type:'speed',value:Number(b.dataset.speed)}));
canvas.addEventListener('pointerdown',e=>{
const r=canvas.getBoundingClientRect(),x=(e.clientX-r.left)*W/r.width,y=(e.clientY-r.top)*H/r.height;
let near=null,best=400;
for(const c of renderedCells){if(!c.alive)continue;const d=(c.x-x)**2+(c.y-y)**2;if(d<best){near=c;best=d;}}
selectedId=near?.id??null;selected=cells.find(c=>c.id===selectedId)||null;
if(!near){$("inspect").textContent='Đang gửi yêu cầu thêm thức ăn.';command({type:'food',x,y});}
scheduleDraw();update();
});
controls();scheduleDraw();connect();
