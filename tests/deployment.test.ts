import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {verifyTargets} from '../scripts/deployment-targets.mjs';
const url='https://cellworld-backend.example.workers.dev';
const fresh={backendUrl:url,pagesId:null,backendTag:null};
const page={name:'cellworld',id:'page-id'},worker={id:'cellworld-backend',tag:'worker-tag'};
test('deployment refuses unrelated names, unrecorded projects, wrong identity, missing resources and wrong backend account URL',()=>{
 assert.doesNotThrow(()=>verifyTargets(fresh,null,null,url));
 assert.throws(()=>verifyTargets(fresh,page,null,url));assert.throws(()=>verifyTargets(fresh,null,worker,url));
 const known={...fresh,pagesId:page.id,backendTag:worker.tag};assert.doesNotThrow(()=>verifyTargets(known,page,worker,url));
 assert.throws(()=>verifyTargets(known,{...page,id:'different'},worker,url));assert.throws(()=>verifyTargets(known,page,{...worker,tag:'different'},url));
 assert.throws(()=>verifyTargets(known,null,worker,url));assert.throws(()=>verifyTargets(known,page,null,url));assert.throws(()=>verifyTargets(fresh,null,null,'https://other.example'));
 assert.throws(()=>verifyTargets(known,{name:'choicungnhau',id:page.id},worker,url));
 assert.doesNotThrow(()=>verifyTargets(fresh,page,worker,url,{record:true}));assert.throws(()=>verifyTargets(known,page,{...worker,tag:'different'},url,{record:true}));
});
test('PowerShell production approval gate precedes any resource writes; backend deployment precedes frontend',()=>{
 const config=JSON.parse(readFileSync('wrangler.jsonc','utf8'));
 assert.equal(config.durable_objects.code_update_strategy.mode,'immediate','new frontend endpoints must not wait for an old active object to hibernate');
 const script=readFileSync('scripts/deploy.ps1','utf8');const gate=script.indexOf('if (-not $ApproveProduction)');
 const create=script.indexOf('npx wrangler pages project create'),backend=script.indexOf('npx wrangler deploy --config'),frontend=script.indexOf('npx wrangler pages deploy');
 assert.ok(gate>0&&gate<create&&create<backend&&backend<frontend);assert.match(script,/pages deploy dist --project-name cellworld --branch main/);assert.doesNotMatch(script,/project-name choicungnhau/);
});
