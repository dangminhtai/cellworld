import { clamp, createWorld, food, MAXFOODS, rand, tick, W, H } from './simulation';
import type { World } from './types';
export function isPublicControl(value:unknown):boolean {
  if(!value || typeof value!=='object')return false;
  const type=(value as Record<string,unknown>).type;
  return type==='speed'||type==='rate';
}
export function action(s:World, value:unknown):World {
  if(!value || typeof value!=='object')throw new Error('Invalid action');
  const a=value as Record<string,unknown>;
  switch(a.type){
    case 'pause': if(typeof a.running!=='boolean')throw Error('running'); s.running=a.running; break;
    case 'speed': if(![1,5,10].includes(a.value as number))throw Error('speed');s.speed=a.value as number;break;
    case 'rate': if(typeof a.value!=='number'||!Number.isFinite(a.value)||a.value<0||a.value>2)throw Error('rate');s.rate=a.value;break;
    case 'step': if(s.running)throw Error('Pause first');for(let i=0;i<30;i++)tick(s);break;
    case 'food':
      if(typeof a.x!=='number'||typeof a.y!=='number'||!Number.isFinite(a.x)||!Number.isFinite(a.y)||a.x<0||a.x>W||a.y<0||a.y>H)throw Error('position');
      for(let i=0;i<8&&s.foods.length<MAXFOODS;i++)s.foods.push(food(s,clamp(a.x+rand(s,-25,25),5,W-5),clamp(a.y+rand(s,-25,25),5,H-5)));break;
    case 'reset': {const fresh=createWorld(s.wall);fresh.revision=s.revision;fresh.generation=s.generation+1;s=fresh;break;}
    default: throw Error('Unknown action');
  }
  s.revision++;return s;
}
