import { DurableObject } from 'cloudflare:workers';
import { advance, createWorld } from './simulation';
import { action, isPublicControl } from './actions';
import type { Env, World } from './types';

export class WorldObject extends DurableObject<Env> {
  private world!:World;
  private lastAction=0;
  private lastPublicAction=0;
  constructor(ctx:DurableObjectState,env:Env){
    super(ctx,env);
    ctx.blockConcurrencyWhile(async()=>{
      const saved=await ctx.storage.get<World>('world');
      if(saved && saved.schema!==1)throw Error('Unsupported world schema; refusing reset');
      this.world=saved??createWorld(Date.now());
      if(!saved)await ctx.storage.put('world',this.world);
    });
  }
  private snapshot(){return {type:'snapshot',world:this.world,recoveryMs:Math.max(0,Date.now()-this.world.wall),adminConfigured:!!this.env.ADMIN_TOKEN};}
  private broadcast(){const msg=JSON.stringify(this.snapshot());for(const ws of this.ctx.getWebSockets()){try{ws.send(msg)}catch{ws.close(1011,'Resync');}}}
  private async cycle(){
    const target=Date.now();
    const remaining=advance(this.world,target,100,8);
    await this.ctx.storage.put('world',this.world);
    if(this.ctx.getWebSockets().length || Date.now()-this.world.wall>=100)await this.ctx.storage.setAlarm(Date.now()+500);
    return remaining;
  }
  async fetch(req:Request){
    // Serialize requests AND alarms across storage awaits, including mutations.
    return this.ctx.blockConcurrencyWhile(async()=>{
      const url=new URL(req.url);
      if(url.pathname==='/api/admin'||url.pathname==='/api/controls'){
        const publicControl=url.pathname==='/api/controls';
        if(!publicControl){
          if(!this.env.ADMIN_TOKEN || req.headers.get('Authorization')!==`Bearer ${this.env.ADMIN_TOKEN}`)return new Response('Unauthorized',{status:401});
          if(req.method==='GET')return Response.json({authorized:true});
        }
        if(req.method!=='POST')return new Response('Method',{status:405});
        const last=publicControl?this.lastPublicAction:this.lastAction;
        if(Date.now()-last<250)return new Response('Rate limited',{status:429,headers:{'Retry-After':'1'}});
        if(publicControl)this.lastPublicAction=Date.now();else this.lastAction=Date.now();
        if(Number(req.headers.get('content-length'))>2048)return new Response('Too large',{status:413});
        const reader=req.body?.getReader();let raw='';let bytes=0;const decoder=new TextDecoder();
        if(reader)while(true){const chunk=await reader.read();if(chunk.done)break;bytes+=chunk.value.byteLength;if(bytes>2048){await reader.cancel();return new Response('Too large',{status:413});}raw+=decoder.decode(chunk.value,{stream:true});}
        raw+=decoder.decode();
        let value:unknown;
        try{value=JSON.parse(raw);}catch{return new Response('Invalid JSON',{status:400});}
        if(publicControl&&!isPublicControl(value))return new Response('Only speed and food rate are public',{status:403});
        // Compare against the fixed entry timestamp, not a newer timestamp after
        // storage I/O; otherwise a completed quantum can spuriously become stale.
        const remaining=await this.cycle();
        if(remaining>=100)return new Response('Recovery in progress; retry after synchronization',{status:409});
        try{this.world=action(this.world,value);}catch{return new Response('Invalid action',{status:400});}
        await this.ctx.storage.put('world',this.world);this.broadcast();return Response.json({revision:this.world.revision});
      }
      if(req.method!=='GET')return new Response('Method',{status:405});
      await this.cycle();
      if(url.pathname==='/ws'){
        if(req.headers.get('Upgrade')?.toLowerCase()!=='websocket')return new Response('WebSocket required',{status:426});
        if(this.ctx.getWebSockets().length>=100)return new Response('World full',{status:503});
        const pair=new WebSocketPair();this.ctx.acceptWebSocket(pair[1]);
        pair[1].send(JSON.stringify(this.snapshot()));
        await this.ctx.storage.setAlarm(Date.now()+500);
        return new Response(null,{status:101,webSocket:pair[0]});
      }
      return Response.json(this.snapshot(),{headers:{'Cache-Control':'no-store'}});
    });
  }
  async alarm(){await this.ctx.blockConcurrencyWhile(async()=>{await this.cycle();this.broadcast();});}
  webSocketMessage(ws:WebSocket){ws.close(1008,'Read-only stream');}
  webSocketClose(ws:WebSocket,code:number,reason:string){ws.close(code,reason);}
  webSocketError(ws:WebSocket){ws.close(1011,'Reconnect');}
}
