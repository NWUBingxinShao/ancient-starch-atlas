// A small HEAD check avoids repeatedly downloading the full research catalog.
export async function fetchCatalog(url,revision=''){
 const u=new URL(url,globalThis.location?.href||'http://localhost/');
 if(revision)u.searchParams.set('_atlas_revision',revision);
 const r=await fetch(u.href,{cache:'no-store'});
 if(!r.ok)throw Error('Catalog HTTP '+r.status);
 const c=await r.json();
 if(!c.built_at||!Array.isArray(c.figures)||!Array.isArray(c.papers)||!Array.isArray(c.sites))throw Error('Invalid catalog');
 return c;
}
export async function catalogSignature(url){
 try{const r=await fetch(url,{method:'HEAD',cache:'no-store'});if(!r.ok)return '';const h=r.headers;
 return h.get('etag')|| (h.get('last-modified')?[h.get('last-modified'),h.get('content-length')].join('|'):'');
 }catch{return '';}
}
export function createCatalogSync({currentVersion,signature,load,apply,canApply=()=>true}){
 let running=false,seen='';
 return {async check(force=false){
  if(running||!canApply())return false;running=true;
  try{const sig=await signature();if(!force&&sig&&sig===seen)return false;
   const fresh=await load();if(!canApply())return false;
   if(fresh.built_at!==currentVersion()){await apply(fresh);seen=sig;return true;}
   seen=sig;return false;
  }catch{return false;}finally{running=false;}
 }};
}
