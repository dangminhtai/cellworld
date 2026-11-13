import { DurableObject } from 'cloudflare:workers';
import { advance, createWorld, ensureMonster } from './simulation';
import { action } from './actions';
import type { Env, World } from './types';

export class WorldObject extends DurableObject<Env> {
  private world!:World;
  private lastAction=0;
  private recovering=false;
  constructor(ctx:DurableObjectState,env:Env){
    super(ctx,env);
    ctx.blockConcurrencyWhile(async()=>{
      const saved=await ctx.storage.get<World>('world');
      if(saved && saved.schema!==1)throw Error('Unsupported world schema; refusing reset');
      this.world=saved??createWorld(Date.now());
      ensureMonster(this.world);
      if(!saved)await ctx.storage.put('world',this.world);
    });
  }
  private snapshot(){return {type:'snapshot',world:this.world,recoveryMs:Math.max(0,Date.now()-this.world.wall),recovering:this.recovering};}
  private broadcast(){const msg=JSON.stringify(this.snapshot());for(const ws of this.ctx.getWebSockets()){try{ws.send(msg)}catch{ws.close(1011,'Resync');}}}
  private async cycle(){
    const target=Date.now();
    ensureMonster(this.world);
    // Scale the catch-up allowance while bounding each alarm cycle.
    const remaining=advance(this.world,target,100,Math.min(80,8*this.world.speed));
    this.recovering=remaining>=100;
    await this.ctx.storage.put('world',this.world);
    if(this.ctx.getWebSockets().length || Date.now()-this.world.wall>=100)await this.ctx.storage.setAlarm(Date.now()+500);
    return remaining;
  }
  async fetch(req:Request){
    // Serialize requests AND alarms across storage awaits, including mutations.
    return this.ctx.blockConcurrencyWhile(async()=>{
      const url=new URL(req.url);
      if(url.pathname==='/api/controls'){
        if(req.method!=='POST')return new Response('Method',{status:405});
        if(Date.now()-this.lastAction<250)return new Response('Rate limited',{status:429,headers:{'Retry-After':'1'}});
        this.lastAction=Date.now();
        if(Number(req.headers.get('content-length'))>2048)return new Response('Too large',{status:413});
        const reader=req.body?.getReader();let raw='';let bytes=0;const decoder=new TextDecoder();
        if(reader)while(true){const chunk=await reader.read();if(chunk.done)break;bytes+=chunk.value.byteLength;if(bytes>2048){await reader.cancel();return new Response('Too large',{status:413});}raw+=decoder.decode(chunk.value,{stream:true});}
        raw+=decoder.decode();
        let value:unknown;
        try{value=JSON.parse(raw);}catch{return new Response('Invalid JSON',{status:400});}
        // Compare against the fixed entry timestamp, not a newer timestamp after
        // storage I/O; otherwise a completed quantum can spuriously become stale.
        const remaining=await this.cycle();
        const command=value as {type?:string;value?:number}|null;
        const loweringSpeed=command?.type==='speed' && typeof command.value==='number' && command.value<this.world.speed;
        if(remaining>=100&&!loweringSpeed)return new Response('Recovery in progress; retry after synchronization',{status:409});
        try{this.world=action(this.world,value);ensureMonster(this.world);}catch{return new Response('Invalid action',{status:400});}
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
  webSocketClose(ws:WebSocket){ws.close(1000,'Closed');}
  webSocketError(ws:WebSocket){ws.close(1011,'Reconnect');}
}
