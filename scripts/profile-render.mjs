// Read-only rendering/network probe. Does not send administrative commands.
import { chromium } from '@playwright/test';
const browser=await chromium.launch({headless:true});
try {
  const page=await browser.newPage();
  if(process.env.PROFILE_BACKEND)await page.route('**/config.js',route=>route.fulfill({contentType:'application/javascript',body:`window.CELLWORLD_API=${JSON.stringify(process.env.PROFILE_BACKEND)};`}));
  await page.addInitScript(()=>{
    window.__renderProfile={frames:[],messages:[],longTasks:[],errors:[]};
    const p=window.__renderProfile;
    const fill=CanvasRenderingContext2D.prototype.fillRect;
    CanvasRenderingContext2D.prototype.fillRect=function(x,y,w,h){
      if(w===900&&h===585)p.frames.push(performance.now());
      return fill.call(this,x,y,w,h);
    };
    const Native=window.WebSocket;
    window.WebSocket=class extends Native {
      constructor(...args){super(...args);this.addEventListener('message',e=>{
        try{const d=JSON.parse(e.data);p.messages.push({at:performance.now(),bytes:new TextEncoder().encode(e.data).length,revision:d.world.revision,t:d.world.t,recoveryMs:d.recoveryMs,alive:d.world.cells.filter(c=>c.alive).length});}catch{}
      });}
    };
    new PerformanceObserver(list=>{for(const e of list.getEntries())p.longTasks.push(e.duration);}).observe({type:'longtask',buffered:true});
    window.addEventListener('error',e=>p.errors.push(e.message));
  });
  await page.goto(process.env.PROFILE_URL||'https://cellworld.pages.dev/');
  await page.waitForFunction(()=>document.querySelector('#network')?.textContent==='Đã kết nối');
  await page.evaluate(()=>{const p=window.__renderProfile;p.frames=[];p.messages=[];p.longTasks=[];p.started=performance.now();});
  await page.waitForTimeout(8000);
  const result=await page.evaluate(()=>{
    const p=window.__renderProfile,seconds=(performance.now()-p.started)/1000;
    const gaps=p.messages.slice(1).map((m,i)=>m.at-p.messages[i].at).sort((a,b)=>a-b);
    return {seconds,draws:p.frames.length,drawsPerSecond:p.frames.length/seconds,snapshots:p.messages.length,snapshotGapMedianMs:gaps[Math.floor(gaps.length/2)],snapshotGapMaxMs:Math.max(0,...gaps),bytesPerSecond:p.messages.reduce((n,m)=>n+m.bytes,0)/seconds,longTasks:p.longTasks.length,maxLongTaskMs:Math.max(0,...p.longTasks),first:p.messages[0],last:p.messages.at(-1),errors:p.errors};
  });
  console.log(JSON.stringify(result,null,2));
}finally{await browser.close();}
