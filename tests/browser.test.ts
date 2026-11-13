import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {build} from 'esbuild';
import {createServer} from 'vite';

test('real browsers: shared world, F5, read-only controls, admin, reconnect and mobile selection',{timeout:60000},async()=>{
 const bundle=await build({entryPoints:['src/worker.ts'],bundle:true,write:false,format:'esm',external:['cloudflare:workers']});
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-11-01',bindings:{ADMIN_TOKEN:'browser-test-token',ALLOWED_ORIGINS:'http://127.0.0.1:5199'},durableObjects:{WORLD:{className:'WorldObject',useSQLite:true}}}));
 const backend=String(await mf.ready).replace(/\/$/,'');
 const vite=await createServer({server:{host:'127.0.0.1',port:5199,strictPort:true}});await vite.listen();
 const browser=await chromium.launch({headless:true});const errors:string[]=[];
 try{
  const a=await browser.newPage(),b=await browser.newPage({viewport:{width:390,height:844}});
  for(const page of [a,b]){page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(url=>{
   (window as any).testBackend=url;(window as any).canvasDraws=0;(window as any).snapshotCount=0;
   const fill=CanvasRenderingContext2D.prototype.fillRect;
   CanvasRenderingContext2D.prototype.fillRect=function(x,y,w,h){if(w===900&&h===585)(window as any).canvasDraws++;return fill.call(this,x,y,w,h);};
   const Native=window.WebSocket;window.WebSocket=class extends Native{constructor(url:string){super(url);this.addEventListener('message',()=>{(window as any).snapshotCount++;});}};
  },backend);await page.route('**/config.js',route=>route.fulfill({contentType:'application/javascript',body:`window.CELLWORLD_API=${JSON.stringify(backend)};`}));await page.goto('http://127.0.0.1:5199/');await page.waitForFunction(()=>document.querySelector('#network')?.textContent==='Đã kết nối');}
  await a.waitForFunction(()=>(window as any).snapshotCount>=3);
  const smoothBefore=await a.evaluate(()=>({draws:(window as any).canvasDraws,messages:(window as any).snapshotCount}));
  await a.waitForTimeout(1200);
  const smoothAfter=await a.evaluate(()=>({draws:(window as any).canvasDraws,messages:(window as any).snapshotCount}));
  assert.ok(smoothAfter.draws-smoothBefore.draws>20,'moving canvas must render between network messages');
  assert.ok(smoothAfter.draws-smoothBefore.draws>(smoothAfter.messages-smoothBefore.messages)*5,'smooth rendering must not require more snapshots');
  assert.equal(await a.locator('#pause').isDisabled(),true);assert.equal(await b.locator('#reset').isDisabled(),true);
  a.once('dialog',d=>d.accept('browser-test-token'));await a.locator('#admin').click();await a.waitForFunction(()=>!(document.querySelector('#pause') as HTMLButtonElement).disabled);
  await a.locator('#pause').click();await a.waitForFunction(()=>document.querySelector('#pause')?.textContent?.includes('Tiếp tục'));await b.waitForFunction(()=>document.querySelector('#pause')?.textContent?.includes('Tiếp tục'));
  const state=()=>a.evaluate(()=>JSON.parse(JSON.stringify((globalThis as any).eval('world'))));
  const paused=await state();assert.equal(paused.running,false);
  const other=await b.evaluate(()=>JSON.parse(JSON.stringify((globalThis as any).eval('world'))));assert.deepEqual(paused.cells,other.cells);assert.equal(paused.t,other.t);
  await a.reload();await a.waitForFunction(()=>document.querySelector('#network')?.textContent==='Đã kết nối');const refreshed=await state();assert.deepEqual(refreshed.cells,paused.cells);assert.equal(refreshed.t,paused.t);assert.equal(refreshed.generation,paused.generation);assert.equal(await a.locator('#reset').isDisabled(),true);
  // Select a visible cell using canonical coordinates scaled into a narrow canvas.
  const c=paused.cells.find((c:any)=>c.alive);const rect=await b.locator('canvas').boundingBox();assert.ok(rect);
  await b.mouse.click(rect.x+c.x/900*rect.width,rect.y+c.y/585*rect.height);assert.match(await b.locator('#inspect').innerText(),/Tế bào #/);
  // Terminate the actual socket; exponential reconnect must resynchronize.
  await a.evaluate(()=>{(globalThis as any).eval('socket.close()');});await a.waitForFunction(()=>document.querySelector('#network')?.textContent==='Đã kết nối');assert.equal((await state()).t,paused.t);
  assert.deepEqual(errors,[]);
 }finally{await browser.close();await vite.close();await mf.dispose();}
});
