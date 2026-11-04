import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './worker.mjs';
const bytes=new Uint8Array([137,80,78,71,13,10,26,10,9,10]);
const meta={size:bytes.length,httpEtag:'"test-etag"'};
const env={IMAGES:{head:async key=>key==='media/S001-F01.png'?meta:null,get:async(key,options)=>key==='media/S001-F01.png'?{...meta,body:options?.range?bytes.slice(options.range.offset,options.range.offset+options.range.length):bytes}:null}};
const call=(method,path,headers)=>worker.fetch(new Request('https://images.example'+path,{method,headers}),env);
test('full file and HEAD preserve size and type',async()=>{let r=await call('GET','/media/S001-F01.png');assert.equal(r.status,200);assert.deepEqual(new Uint8Array(await r.arrayBuffer()),bytes);r=await call('HEAD','/media/S001-F01.png');assert.equal(r.headers.get('Content-Length'),'10');assert.equal((await r.arrayBuffer()).byteLength,0);});
test('range, suffix and unsatisfiable range',async()=>{let r=await call('GET','/media/S001-F01.png',{'Range':'bytes=0-3'});assert.equal(r.status,206);assert.equal(r.headers.get('Content-Range'),'bytes 0-3/10');assert.equal((await r.arrayBuffer()).byteLength,4);r=await call('GET','/media/S001-F01.png',{'Range':'bytes=-2'});assert.deepEqual(new Uint8Array(await r.arrayBuffer()),bytes.slice(-2));r=await call('GET','/media/S001-F01.png',{'Range':'bytes=20-30'});assert.equal(r.status,416);});
test('conditional request avoids a second body download',async()=>{let r=await call('GET','/media/S001-F01.png',{'If-None-Match':'"test-etag"'});assert.equal(r.status,304);assert.equal((await r.arrayBuffer()).byteLength,0);});
test('no write endpoint, listing or arbitrary files',async()=>{assert.equal((await call('POST','/media/S001-F01.png')).status,405);for(const p of ['/','/private/editorial.sqlite','/media/index.json','/media/UNKNOWN.png'])assert.equal((await call('GET',p)).status,404);});

test('website and originals share one host without forwarding image failures to HTML',async()=>{
 const staticRequests=[];
 const combined={...env,ASSETS:{fetch:async request=>{staticRequests.push(new URL(request.url).pathname);return new Response('<html>atlas</html>',{headers:{'Content-Type':'text/html'}});}}};
 for(const p of ['/','/credits','/config.js'])assert.equal((await worker.fetch(new Request('https://atlas.example'+p),combined)).status,200);
 const image=await worker.fetch(new Request('https://atlas.example/media/S001-F01.png'),combined);
 assert.equal(image.headers.get('Content-Type'),'image/png');
 assert.deepEqual(new Uint8Array(await image.arrayBuffer()),bytes);
 for(const p of ['/media/UNKNOWN.png','/media/index.json'])assert.equal((await worker.fetch(new Request('https://atlas.example'+p),combined)).status,404);
 assert.deepEqual(staticRequests,['/','/credits','/config.js']);
});

test('missing R2 binding is an explicit uncached service error',async()=>{
 const response=await worker.fetch(new Request('https://atlas.example/media/S001-F01.png'),{});
 assert.equal(response.status,503);assert.equal(response.headers.get('Cache-Control'),'no-store');
});
