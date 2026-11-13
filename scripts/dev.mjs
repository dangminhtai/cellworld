import { spawn } from 'node:child_process';
import { createServer } from 'vite';
const worker=spawn(process.execPath,['node_modules/wrangler/bin/wrangler.js','dev','--ip','127.0.0.1','--port','8787','--persist-to','.wrangler/state'],{stdio:'inherit'});
const vite=await createServer({server:{host:'127.0.0.1',port:5173,strictPort:true},build:{outDir:'dist'}});
await vite.listen();vite.printUrls();
const close=async()=>{worker.kill();await vite.close();process.exit();};
worker.on('exit',close);process.on('SIGINT',close);process.on('SIGTERM',close);
