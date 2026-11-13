import { mkdir, copyFile, writeFile } from 'node:fs/promises';
const endpoint=process.env.CELLWORLD_API||'';
if(endpoint){const u=new URL(endpoint);if(!['https:','http:'].includes(u.protocol)||u.pathname!=='/'||u.username||u.password||u.search||u.hash)throw Error('CELLWORLD_API must be an HTTP(S) origin');}
await mkdir('dist',{recursive:true});
for(const name of ['index.html','frontend.js','render-state.js'])await copyFile(name,`dist/${name}`);
await writeFile('dist/config.js',`window.CELLWORLD_API = ${JSON.stringify(endpoint)};\n`);
await writeFile('dist/_headers','/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n/config.js\n  Cache-Control: no-store\n/index.html\n  Cache-Control: no-cache\n');
console.log(`Frontend built; backend: ${endpoint||'not configured (localhost fallback only)'}`);
