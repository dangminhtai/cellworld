// Read-only preflight. Credentials remain in process memory and never reach output/files.
import { execFileSync } from 'node:child_process';
import { readFile,writeFile } from 'node:fs/promises';
import { verifyTargets } from './deployment-targets.mjs';
const wrangler=args=>{
  try{return JSON.parse(execFileSync(process.execPath,['node_modules/wrangler/bin/wrangler.js',...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));}
  catch{throw Error('Wrangler authentication command failed; output withheld to protect credentials. Run wrangler login / whoami separately.');}
};
try{
  const config=JSON.parse(await readFile('deployment.local.json','utf8'));
  if(!/^[a-f0-9]{32}$/.test(config.accountId))throw Error('Set a verified accountId in deployment.local.json');
  if(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_ACCOUNT_ID!==config.accountId)throw Error('CLOUDFLARE_ACCOUNT_ID mismatch');
  const who=wrangler(['whoami','--json']);
  if(!who.accounts?.some(a=>a.id===config.accountId))throw Error('Selected account is not in authenticated memberships');
  const auth=wrangler(['auth','token','--json']);
  if(!auth.token)throw Error('Use an OAuth/API token, global API keys are unsupported');
  async function api(path,allowMissing=false){
    const r=await fetch(`https://api.cloudflare.com/client/v4/accounts/${config.accountId}/${path}`,{headers:{Authorization:`Bearer ${auth.token}`}});
    if(allowMissing&&r.status===404)return null;
    const j=await r.json();if(!r.ok||!j.success)throw Error(`Cloudflare ${path}: HTTP ${r.status}; verify Pages + Workers Scripts permissions`);return j.result;
  }
  const [p,workers,subdomain]=await Promise.all([api('pages/projects/cellworld',true),api('workers/scripts'),api('workers/subdomain')]);
  const w=workers.find(w=>w.id==='cellworld-backend');
  const expected=`https://cellworld-backend.${subdomain.subdomain}.workers.dev`;
  const record=process.argv.includes('--record');
  verifyTargets(config,p,w,expected,{record});
  if(record){
    // Only invoked after the guarded deployment/creation command succeeded.
    if(p)config.pagesId=p.id;if(w)config.backendTag=w.tag;
    await writeFile('deployment.local.json',JSON.stringify(config,null,2)+'\n');
  }
  console.log(JSON.stringify({accountId:config.accountId,project:'cellworld',worker:'cellworld-backend',pagesExists:!!p,backendExists:!!w,backendUrl:expected}));
}catch(e){console.error('Preflight blocked: '+e.message);process.exit(1);}
