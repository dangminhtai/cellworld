// Intentional live speed/rate/pause checks. Never resets or creates food.
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
const backend='https://cellworld-backend.dmt826321.workers.dev';
const get=async()=>{const r=await fetch(backend+'/api/state');assert.equal(r.status,200);return (await r.json()).world;};
const change=async(type,value)=>{
  for(let i=0;i<16;i++){
    const r=await fetch(backend+'/api/controls',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://cellworld.pages.dev'},body:JSON.stringify({type,value})});
    if(r.ok)return;
    if(![409,429].includes(r.status))throw Error(`Control ${type}: ${r.status} ${await r.text()}`);
    await new Promise(resolve=>setTimeout(resolve,400));
  }
  throw Error('World busy/recovering; public-control verification incomplete');
};
const original=await get();const browser=await chromium.launch({headless:true});
let changedSpeed=false,changedRate=false,changedPause=false;
const diagnostics=[];
try{
 const pages=[await browser.newPage(),await browser.newPage({viewport:{width:390,height:844}})];
 for(const page of pages){page.on('response',r=>{if(r.url().endsWith('/api/controls'))diagnostics.push({status:r.status(),body:r.request().postData()});});page.on('pageerror',e=>diagnostics.push({error:e.message}));await page.goto('https://cellworld.pages.dev/');await page.waitForFunction(()=>document.querySelector('#network')?.textContent==='Đã kết nối');}
 await pages[0].locator('.speed[data-speed="10"]').click();changedSpeed=true;
 for(const page of pages)await page.waitForFunction(()=>document.querySelector('.speed[data-speed="10"]')?.classList.contains('active'),{},{timeout:20000});
 await pages[1].locator('#rate').press('End');changedRate=true;
 for(const page of pages)await page.waitForFunction(()=>document.querySelector('#rateLabel')?.textContent==='200%',{},{timeout:20000});
 const actual=await get();assert.equal(actual.speed,10);assert.equal(actual.rate,2);assert.equal(actual.generation,original.generation);assert.ok(actual.t>=original.t);
 await pages[1].reload();await pages[1].waitForFunction(()=>document.querySelector('.speed[data-speed="10"]')?.classList.contains('active')&&document.querySelector('#rateLabel')?.textContent==='200%');
 for(const page of pages){assert.equal(await page.locator('#reset').isDisabled(),false);assert.equal(await page.locator('#pause').isDisabled(),false);assert.equal(await page.locator('#admin').count(),0);}
 if((await get()).running){await pages[0].locator('#pause').click();changedPause=true;for(const page of pages)await page.waitForFunction(()=>document.querySelector('#pause')?.textContent?.includes('Tiếp tục'));assert.equal((await get()).running,false);}
 console.log('PASS live: all controls unlocked without login; 10x/food settings synchronize and survive F5; pause synchronizes to both browsers. Reset was not invoked.');
}catch(e){const s=await get();console.error(JSON.stringify({diagnostics,actual:{speed:s.speed,rate:s.rate,t:s.t,generation:s.generation}}));throw e;
}finally{
 await browser.close();
 // Do not overwrite a different setting selected by another visitor meanwhile.
 if(changedSpeed&&(await get()).speed===10)await change('speed',original.speed);
 if(changedRate&&(await get()).rate===2)await change('rate',original.rate);
 if(changedPause&&(await get()).running===false)await change('pause',original.running);
 console.log('Restored previous settings where still equal to test values. No reset or food creation sent.');
}
