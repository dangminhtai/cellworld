// Intentional live speed/rate changes. Never sends admin actions or resets.
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
let changedSpeed=false,changedRate=false;
try{
 const pages=[await browser.newPage(),await browser.newPage({viewport:{width:390,height:844}})];
 for(const page of pages){await page.goto('https://cellworld.pages.dev/');await page.waitForFunction(()=>document.querySelector('#network')?.textContent==='Đã kết nối');}
 await pages[0].locator('.speed[data-speed="10"]').click();changedSpeed=true;
 for(const page of pages)await page.waitForFunction(()=>document.querySelector('.speed[data-speed="10"]')?.classList.contains('active'),{},{timeout:20000});
 await pages[1].locator('#rate').press('End');changedRate=true;
 for(const page of pages)await page.waitForFunction(()=>document.querySelector('#rateLabel')?.textContent==='200%',{},{timeout:20000});
 const actual=await get();assert.equal(actual.speed,10);assert.equal(actual.rate,2);assert.equal(actual.generation,original.generation);assert.ok(actual.t>=original.t);
 await pages[1].reload();await pages[1].waitForFunction(()=>document.querySelector('.speed[data-speed="10"]')?.classList.contains('active')&&document.querySelector('#rateLabel')?.textContent==='200%');
 for(const page of pages){assert.equal(await page.locator('#reset').isDisabled(),true);assert.equal(await page.locator('#pause').isDisabled(),true);}
 console.log('PASS live: unauthenticated desktop/mobile changed 10x and 200% food; both observed persisted shared settings after F5; pause/reset remain locked.');
}finally{
 await browser.close();
 // Do not overwrite a different setting selected by another visitor meanwhile.
 if(changedSpeed&&(await get()).speed===10)await change('speed',original.speed);
 if(changedRate&&(await get()).rate===2)await change('rate',original.rate);
 console.log('Restored previous settings where still equal to test values. No reset or food creation sent.');
}
