import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const web=path.join(root,'website');
const problems=[];
async function files(directory){
 const result=[];
 for(const entry of await fs.readdir(directory,{withFileTypes:true})){
  if(entry.name==='.git')continue;
  const file=path.join(directory,entry.name);
  if(entry.isDirectory())result.push(...await files(file));else result.push(file);
 }
 return result;
}
const forbiddenFields=new Set(['editorial_review','site_audit','source_review_status','translation_status','translation_checks','panel_status','library_status','title_extraction','title_translation_note','caption_zh_origin','caption_en_origin','editorial_image_provenance','recovery_provenance','position_review','placement_times']);
function inspect(value,location){
 if(typeof value==='string'){
  if(/(?:^|[\s"'(])(?:[A-Za-z]:[\/]|file:\/\/|\\[A-Za-z]|\/Users\/|\/home\/|\/root\/|\/var\/www\/)/.test(value))problems.push(`Local path in ${location}`);
 }else if(Array.isArray(value))value.forEach((v,i)=>inspect(v,`${location}[${i}]`));
 else if(value&&typeof value==='object')for(const [key,item]of Object.entries(value)){
  if(forbiddenFields.has(key))problems.push(`Publication metadata field ${key} in ${location}`);
  inspect(item,`${location}.${key}`);
 }
}
const all=await files(web);
for(const file of all){
 const rel=path.relative(web,file);
 if(/(?:^|[\/])(?:private|admin|originals|\.models|node_modules)(?:[\/]|$)|\.(?:csv|sqlite|db|pdf|xlsx?|pem|key|p12|pfx|log)$/i.test(rel))problems.push(`Unexpected public file: ${rel}`);
 if(file.endsWith('.html')){
  const html=await fs.readFile(file,'utf8');
  for(const [,url]of html.matchAll(/(?:src|href)="([^"#]+)"/g)){
   if(/^(?:https?:|mailto:|data:|\/)/.test(url))continue;
   const target=path.resolve(path.dirname(file),decodeURIComponent(url.split(/[?#]/)[0]));
   try{await fs.access(target);}catch{problems.push(`Missing resource in ${rel}: ${url}`);}
  }
 }
 if(file.endsWith('.json'))inspect(JSON.parse(await fs.readFile(file,'utf8')),rel);
}
const tracked=await files(root);
for(const file of tracked){
 const rel=path.relative(root,file);
 if(/(?:^|[\/])(?:private|admin|\.ssh|\.aws|\.aliyun)(?:[\/]|$)|\.(?:pem|key|p12|pfx|sqlite|db|xlsx?)$/i.test(rel))problems.push(`Private file in repository: ${rel}`);
 if(!/\.(?:md|txt|js|mjs|json|jsonc|html|css|ya?ml)$/.test(file))continue;
 const text=await fs.readFile(file,'utf8');
 if(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----\r?\n[A-Za-z0-9+/=\r\n]+-----END/.test(text)||/\b(?:LTAI|AKIA)[A-Za-z0-9]{12,}\b|\bgh[pousr]_[A-Za-z0-9]{20,}\b|\bgithub_pat_[A-Za-z0-9_]{20,}\b/.test(text))problems.push(`Credential marker in ${rel}`);
}
const context={window:{}};
vm.runInNewContext(await fs.readFile(path.join(web,'config.js'),'utf8'),context);
const config=context.window.ATLAS_CONFIG,media=config?.mediaBaseUrl;
if(!config||config.apiBaseUrl)problems.push('Static catalog configuration is invalid.');
if(media!==''&&media!=='/'&&(!/^https:\/\//.test(media)||/\/media\/?$/.test(media)))problems.push('Media base must be a site root.');
for(const relative of ['wrangler.jsonc','r2-worker/wrangler.jsonc']){
 try{
  const file=path.join(root,relative),deployment=JSON.parse(await fs.readFile(file,'utf8'));
  if(!deployment.r2_buckets?.some(b=>b.binding==='IMAGES'&&b.bucket_name))problems.push(`Missing IMAGES binding: ${relative}`);
  if(deployment.assets?.binding!=='ASSETS'||!deployment.assets?.run_worker_first?.includes('/media/*'))problems.push(`Missing media route: ${relative}`);
  if(path.resolve(path.dirname(file),deployment.assets?.directory||'')!==web)problems.push(`Invalid website directory: ${relative}`);
  await fs.access(path.resolve(path.dirname(file),deployment.main));
 }catch(error){problems.push(`Invalid configuration ${relative}: ${error.message}`);}
}
const catalog=JSON.parse(await fs.readFile(path.join(web,'data/catalog.json'),'utf8'));
const creditsContext={window:{}};
vm.runInNewContext(await fs.readFile(path.join(web,'credits-literature.js'),'utf8'),creditsContext);
const credits=creditsContext.window.STARCH_ATLAS_LITERATURE;
if(!credits||Object.keys(credits).some(key=>key!=='roster')||!Array.isArray(credits.roster)||credits.roster.some(name=>typeof name!=='string'))problems.push('Credits must contain the public author roster.');
if(catalog.sites.some(site=>typeof site.is_study_site!=='boolean'))problems.push('Study-site classification is missing.');
const manifest=JSON.parse(await fs.readFile(path.join(root,'media-manifest.json'),'utf8'));
const mediaByKey=new Map(manifest.map(row=>[row.key,row]));
if(catalog.figures.length!==manifest.length||mediaByKey.size!==manifest.length)problems.push('Figure and media manifest counts differ.');
for(const figure of catalog.figures){
 try{await fs.access(path.join(web,figure.thumbnail));}catch{problems.push(`Missing preview: ${figure.id}`);}
 const image=new URL(figure.image_url,'https://ancientstarch.cn/');
 const entry=mediaByKey.get(image.pathname.slice(1));
 if(!entry||entry.sha256!==figure.image_sha256||entry.bytes!==figure.image_bytes)problems.push(`Media manifest mismatch: ${figure.id}`);
 if(image.searchParams.get('v')!==figure.image_sha256.slice(0,12))problems.push(`Image version mismatch: ${figure.id}`);
}
if(problems.length){console.error([...new Set(problems)].join('\n'));process.exitCode=1;}
else console.log(JSON.stringify({result:'passed',websiteFiles:all.length,figures:catalog.figures.length,paperRecords:catalog.papers.length,studySites:catalog.sites.filter(site=>site.is_study_site).length,mediaManifest:manifest.length},null,2));
