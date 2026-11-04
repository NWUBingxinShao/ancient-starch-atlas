export const FACET_KEYS=['context','plant','material','process','certainty'];
export const MISSING='__missing__';
export const emptyFilters=()=>Object.fromEntries(FACET_KEYS.map(k=>[k,'']));
export function matchesFacets(meta,filters){return FACET_KEYS.every(k=>!filters[k]||(filters[k]===MISSING?!(meta?.facets?.[k]?.length):meta?.facets?.[k]?.includes(filters[k])));}
export function validateBox(b){return Array.isArray(b)&&b.length===4&&b.every(Number.isFinite)&&b[0]>=0&&b[1]>=0&&b[0]<b[2]&&b[1]<b[3]&&b[2]<=1&&b[3]<=1;}
export function activeHotspots(entry,figure){return entry?.image_sha256===figure.image_sha256&&Array.isArray(entry.entries)?entry.entries.filter(e=>typeof e.id==='string'&&typeof e.label==='string'&&Array.isArray(e.boxes)&&e.boxes.length&&e.boxes.every(validateBox)):[];}
export function figureLink(figure,base,panel=''){
 const u=new URL(base);u.hash='';u.search='';u.hash=new URLSearchParams({figure:figure.id,...(panel?{panel}:{})}).toString();return u.href;
}
export function citation(figure,paper,base,{panel='',panelId=panel,date=new Date()}={}){
 const day=[date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
 return `${paper.citation_original}\n图版：图${figure.number}${panel?'，分图'+panel:''}；PDF文件第${figure.pdf_pages?.join('、')||'未标注'}页。\n淀粉粒考古图版库；图版ID：${figure.id}；图像SHA-256：${figure.image_sha256}。\n${figureLink(figure,base,panelId)}\n访问日期：${day}。`;
}
export function parseLibrary(raw){
 let value;try{value=typeof raw==='string'?JSON.parse(raw):raw;}catch{throw new Error('资料夹文件不是有效JSON');}
 if(value?.schema!=='atlas-library/1'||!Array.isArray(value.figures)||!Array.isArray(value.searches)||value.figures.length>2000||value.searches.length>200)throw new Error('资料夹格式或数量不正确');
 const seen=new Set();const figures=[];
 for(const x of value.figures){if(typeof x.id!=='string'||!x.id||x.id.length>220||seen.has(x.id))continue;seen.add(x.id);figures.push({id:x.id,image_sha256:String(x.image_sha256||'').slice(0,64),note:String(x.note||'').slice(0,4000),group:String(x.group||'').slice(0,100),addedAt:String(x.addedAt||'').slice(0,40)});}
 const searches=value.searches.filter(x=>x&&typeof x.id==='string'&&x.filters&&typeof x.filters==='object').map(x=>({id:x.id.slice(0,100),name:String(x.name||'未命名检索').slice(0,120),filters:Object.fromEntries(['q','year','type','sourceLanguage','sort','site',...FACET_KEYS].map(k=>[k,typeof x.filters[k]==='string'?x.filters[k].slice(0,500):''])),addedAt:String(x.addedAt||'').slice(0,40)}));
 return {schema:'atlas-library/1',figures,searches};
}
export function mergeLibrary(current,incoming){const result=parseLibrary(current),other=parseLibrary(incoming),ids=new Set(result.figures.map(f=>f.id)),searchIds=new Set(result.searches.map(s=>s.id));for(const f of other.figures)if(!ids.has(f.id)){result.figures.push(f);ids.add(f.id);}for(const s of other.searches)if(!searchIds.has(s.id)){result.searches.push(s);searchIds.add(s.id);}if(result.figures.length>2000||result.searches.length>200)throw new Error('资料夹超过可保存数量');return result;}
export function escapedMarkdown(value){return String(value||'').replace(/[\\`*_[\]<>]/g,'\\$&');}
