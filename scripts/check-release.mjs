import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const web=path.join(root,'website'),draft=process.argv.includes('--draft');
async function files(directory){const result=[];for(const entry of await fs.readdir(directory,{withFileTypes:true})){const file=path.join(directory,entry.name);if(entry.isDirectory())result.push(...await files(file));else result.push(file);}return result;}
const all=await files(web),problems=[];
for(const file of all){
 const rel=path.relative(web,file),stat=await fs.stat(file);
 if(file.toLowerCase().endsWith('.csv'))problems.push(`首版暂不公开 CSV：${rel}`);
 if(stat.size>25*1024*1024)problems.push(`文件超过静态托管大小限制：${rel}`);
 if(/(?:^|[\\/])(?:private|admin|originals|\.models|node_modules)(?:[\\/]|$)|\.(?:sqlite|db|pdf|xlsx|pem|key)$/i.test(rel))problems.push(`展示目录包含维护文件：${rel}`);
 if(file.endsWith('.html')){
  const html=await fs.readFile(file,'utf8');
  for(const [,url] of html.matchAll(/(?:src|href)="([^"#]+)"/g)){
   if(/^(?:https?:|mailto:|data:|\/)/.test(url))continue;
   const target=path.resolve(path.dirname(file),decodeURIComponent(url.split(/[?#]/)[0]));
   try{await fs.access(target);}catch{problems.push(`${rel} 缺少资源：${url}`);}
  }
 }
 if(file.endsWith('.json')){
  const data=JSON.parse(await fs.readFile(file,'utf8'));
  const inspect=value=>{if(typeof value==='string'&&/(?:^|[\s"'(])(?:[A-Za-z]:[\\/]|\\\\[A-Za-z])/.test(value))problems.push(`数据含本机路径：${rel}`);else if(Array.isArray(value))value.forEach(inspect);else if(value&&typeof value==='object')Object.values(value).forEach(inspect);};inspect(data);
 }
}
const context={window:{}};
vm.runInNewContext(await fs.readFile(path.join(web,'config.js'),'utf8'),context);
const config=context.window.ATLAS_CONFIG,media=config?.mediaBaseUrl;
if(!config||config.apiBaseUrl)problems.push('静态展示版的 apiBaseUrl 应为空。');
if(!draft&&(!media||!/^https:\/\//.test(media)||/example\.(?:org|com|net)|你的|your-/i.test(media)||/\/media\/?$/.test(media)))problems.push('请先填写实际 mediaBaseUrl（HTTPS 根地址，末尾不带 /media）。');
const catalog=JSON.parse(await fs.readFile(path.join(web,'data/catalog.json'),'utf8'));
const manifest=JSON.parse(await fs.readFile(path.join(root,'待上传原图清单.json'),'utf8'));
if(catalog.figures.length!==manifest.length)problems.push('公开图版数量与原图清单不一致。');
for(const figure of catalog.figures){try{await fs.access(path.join(web,figure.thumbnail));}catch{problems.push(`缺少预览：${figure.id}`);}}
if(problems.length){console.error([...new Set(problems)].join('\n'));process.exitCode=1;}
else console.log(JSON.stringify({result:'passed',mode:draft?'draft':'production',files:all.length,figures:catalog.figures.length,mediaConfigured:!!media},null,2));
