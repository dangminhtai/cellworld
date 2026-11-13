// Read-only production check: never sends administrative commands.
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
const browser=await chromium.launch({headless:true});
try{
 const a=await browser.newPage(),b=await browser.newPage();
 const open=async page=>{await page.goto('https://cellworld.pages.dev/');await page.waitForFunction(()=>document.querySelector('#network')?.textContent==='Đã kết nối',{},{timeout:60000});await page.waitForFunction(()=>globalThis.eval('recoveryMs < 100'),{},{timeout:120000});};
 const state=page=>page.evaluate(()=>JSON.parse(JSON.stringify(globalThis.eval('world'))));
 await open(a);const before=await state(a);await a.waitForTimeout(1500);await a.reload();await a.waitForFunction(()=>document.querySelector('#network')?.textContent==='Đã kết nối');const after=await state(a);
 assert.equal(after.generation,before.generation);assert.ok(after.t>=before.t);assert.ok(after.nextFood>=before.nextFood);
 assert.deepEqual(after.cells.map(c=>c.id),before.cells.map(c=>c.id));
 for(let i=0;i<100;i++){assert.ok(after.cells[i].eaten>=before.cells[i].eaten);if(!before.cells[i].alive)assert.equal(after.cells[i].alive,false);}
 await open(b);const other=await state(b);assert.equal(other.generation,after.generation);assert.deepEqual(other.cells.map(c=>c.id),after.cells.map(c=>c.id));
 assert.equal(await a.locator('#reset').isDisabled(),true);assert.equal(await b.locator('#reset').isDisabled(),true);
 console.log('PASS production F5: generation, IDs, monotonic time/food counters; two read-only browsers share the canonical generation.');
}finally{await browser.close();}
