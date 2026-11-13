import type { Env } from './types';
export { WorldObject } from './world-object';
export default {
  async fetch(req:Request,env:Env):Promise<Response>{
    const origin=req.headers.get('Origin');
    const allowed=env.ALLOWED_ORIGINS.split(',').map(s=>s.trim());
    if(origin&&!allowed.includes(origin))return new Response('Origin denied',{status:403});
    const path=new URL(req.url).pathname;
    if(!['/api/state','/api/admin','/api/controls','/ws'].includes(path))return new Response('Not found',{status:404});
    if(req.method==='OPTIONS')return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':origin??allowed[0],'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type','Vary':'Origin'}});
    const res=await env.WORLD.get(env.WORLD.idFromName('canonical-world-v1')).fetch(req);
    if(res.status===101)return res;
    const result=new Response(res.body,res);
    if(origin)result.headers.set('Access-Control-Allow-Origin',origin);
    result.headers.set('Vary','Origin');result.headers.set('Cache-Control','no-store');return result;
  }
};
