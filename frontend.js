"use strict";
const $=id=>document.getElementById(id),canvas=$("canvas"),ctx=canvas.getContext("2d");
const W=900,H=585,N=100;
let cells=[],foods=[],selected=null,selectedId=null,t=0,world=null,authorized=false,token='',socket,attempt=0,lastMessage=0,recoveryMs=Infinity;
let revision=-1;
const status=$("network"),sync=$("sync");
const local=['localhost','127.0.0.1'].includes(location.hostname);
const endpoint=window.CELLWORLD_API || (local?'http://127.0.0.1:8787':'');
function controls(){
const enabled=authorized&&socket?.readyState===WebSocket.OPEN&&recoveryMs<100;
document.querySelectorAll('.controls button,.controls input').forEach(b=>b.disabled=!enabled);
$("step").disabled=!enabled||world?.running;
$("admin").textContent=authorized?'Khóa quản trị':'Mở quản trị';
if(world){$("pause").textContent=world.running?'⏸ Tạm dừng':'▶ Tiếp tục';$("rate").value=world.rate*100;$("rateLabel").textContent=Math.round(world.rate*100)+'%';document.querySelectorAll('.speed').forEach(b=>b.classList.toggle('active',Number(b.dataset.speed)===world.speed));}
}
async function command(value){
if(!authorized)return;
try{const res=await fetch(endpoint+'/api/admin',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(value)});
if(!res.ok){if(res.status===401){authorized=false;token='';controls();}throw Error(await res.text());}
}catch(e){sync.textContent='Lệnh thất bại: '+e.message;}
}
function connect(){
if(!endpoint){status.textContent='Chưa cấu hình backend';sync.textContent='Đặt CELLWORLD_API trong config.js (xem README).';controls();return;}
status.textContent='Đang kết nối…';
try{const url=new URL('/ws',endpoint);url.protocol=url.protocol==='https:'?'wss:':'ws:';socket=new WebSocket(url);
socket.onmessage=e=>{try{const data=JSON.parse(e.data);if(data.type!=='snapshot'||data.world.schema!==1)return;
lastMessage=Date.now();attempt=0;status.textContent='Đã kết nối';
if(data.world.revision<revision)return;
revision=data.world.revision;world=data.world;cells=world.cells;foods=world.foods;t=world.t;selected=cells.find(c=>c.id===selectedId)||null;
recoveryMs=data.recoveryMs;sync.textContent=recoveryMs>=100?'Đang khôi phục: còn '+(recoveryMs/1000).toFixed(1)+' giây thực':'Đã đồng bộ · revision '+revision+(data.adminConfigured?' · khách chỉ xem':' · quản trị chưa cấu hình');
controls();update();draw();}catch{sync.textContent='Dữ liệu không hợp lệ';socket.close();}};
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
for(const c of cells){
if(!c.alive)continue;
ctx.fillStyle=c.flash>0?"#f7eb8e":c.eaten>=90?"#eb8585":c.eaten>=60?"#f3be83":"#81e2c5";
ctx.globalAlpha=.16;ctx.beginPath();ctx.arc(c.x,c.y,9,0,Math.PI*2);ctx.fill();
ctx.globalAlpha=1;ctx.beginPath();ctx.arc(c.x,c.y,4,0,Math.PI*2);ctx.fill();
}
if(selected){
ctx.strokeStyle=selected.alive?"#c7f59d":"#e78585";ctx.lineWidth=1.4;ctx.setLineDash([5,5]);ctx.beginPath();ctx.arc(selected.x,selected.y,90,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
ctx.beginPath();ctx.arc(selected.x,selected.y,12,0,Math.PI*2);ctx.stroke();
ctx.fillStyle="#eafdd2";ctx.font="14px monospace";ctx.fillText("C-"+selected.id,selected.x+15,selected.y-10);
}
}
function update(){
const alive=cells.filter(c=>c.alive);
$("alive").textContent=alive.length;$("dead").textContent=N-alive.length;$("foods").textContent=foods.length;
$("average").textContent=alive.length?(alive.reduce((n,c)=>n+c.eaten,0)/alive.length).toFixed(1):"0";
$("clock").textContent=String(Math.floor(t/60)).padStart(2,"0")+":"+String(Math.floor(t)%60).padStart(2,"0");
if(selected)$("inspect").textContent="Tế bào #"+selected.id+" | "+(selected.alive?"Còn sống":"Đã chết")+" | Ăn "+selected.eaten+" hạt | Bán kính 90px"+(selected.alive?"":" | Chết ở hạt thứ 101");
}

$("admin").onclick=async()=>{
if(authorized){authorized=false;token='';controls();return;}
const entered=prompt('Nhập admin token (chỉ giữ trong bộ nhớ tab, không lưu):');if(!entered)return;
try{const r=await fetch(endpoint+'/api/admin',{headers:{Authorization:'Bearer '+entered}});if(!r.ok)throw Error('Không được cấp quyền hoặc chưa cấu hình ADMIN_TOKEN');token=entered;authorized=true;controls();}catch(e){sync.textContent=e.message;}
};
$("pause").onclick=()=>command({type:'pause',running:!world.running});
$("step").onclick=()=>command({type:'step'});
$("reset").onclick=()=>{if(confirm('Tạo lại thế giới chung cho TẤT CẢ người xem?'))command({type:'reset'});};
$("rate").onchange=e=>command({type:'rate',value:Number(e.target.value)/100});
document.querySelectorAll('.speed').forEach(b=>b.onclick=()=>command({type:'speed',value:Number(b.dataset.speed)}));
canvas.addEventListener('pointerdown',e=>{
const r=canvas.getBoundingClientRect(),x=(e.clientX-r.left)*W/r.width,y=(e.clientY-r.top)*H/r.height;
let near=null,best=400;
for(const c of cells){if(!c.alive)continue;const d=(c.x-x)**2+(c.y-y)**2;if(d<best){near=c;best=d;}}
selected=near;selectedId=near?.id??null;
if(!near){$("inspect").textContent=authorized?'Đang gửi yêu cầu thêm thức ăn.':'Chạm một tế bào để xem. Khách không thể thêm thức ăn.';command({type:'food',x,y});}
draw();update();
});
controls();draw();connect();
