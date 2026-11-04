// Public, read-only gateway. R2 bucket itself may remain private.
function headers(object) {
  return new Headers({
    'Content-Type':'image/png','X-Content-Type-Options':'nosniff',
    'Access-Control-Allow-Origin':'*','Access-Control-Expose-Headers':'ETag,Content-Length,Content-Range',
    'Cache-Control':'public, max-age=86400','Accept-Ranges':'bytes',
    'ETag':object.httpEtag,'Content-Length':String(object.size)
  });
}
function byteRange(value,size) {
  const m=/^bytes=(\d*)-(\d*)$/.exec(value);
  if(!m || (!m[1]&&!m[2]))return null;
  const start=m[1]?Number(m[1]):Math.max(0,size-Number(m[2]));
  const end=m[1]?(m[2]?Math.min(Number(m[2]),size-1):size-1):size-1;
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>end||start>=size)return null;
  return {offset:start,length:end-start+1};
}
export default {
  async fetch(request,env) {
    const url=new URL(request.url);
    if(!/^\/media\/[A-Za-z0-9_-]{1,180}\.png$/.test(url.pathname))return new Response('Not found',{status:404});
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,HEAD,OPTIONS','Access-Control-Allow-Headers':'Range,If-None-Match'}});
    if(!['GET','HEAD'].includes(request.method))return new Response('Read only',{status:405,headers:{Allow:'GET, HEAD, OPTIONS'}});
    const key=url.pathname.slice(1),rangeHeader=request.headers.get('Range'),etag=request.headers.get('If-None-Match');
    if(request.method==='HEAD'||rangeHeader||etag) {
      const meta=await env.IMAGES.head(key);
      if(!meta)return new Response('Not found',{status:404});
      const h=headers(meta);
      if(etag && (etag==='*'||etag.split(',').map(s=>s.trim().replace(/^W\//,'')).includes(meta.httpEtag))){h.delete('Content-Length');return new Response(null,{status:304,headers:h});}
      if(request.method==='HEAD')return new Response(null,{headers:h});
      if(rangeHeader){
        const range=byteRange(rangeHeader,meta.size);
        if(!range){h.set('Content-Range','bytes */'+meta.size);h.delete('Content-Length');return new Response(null,{status:416,headers:h});}
        const object=await env.IMAGES.get(key,{range});
        if(!object)return new Response('Not found',{status:404});
        h.set('Content-Length',String(range.length));h.set('Content-Range',`bytes ${range.offset}-${range.offset+range.length-1}/${meta.size}`);
        return new Response(object.body,{status:206,headers:h});
      }
    }
    const object=await env.IMAGES.get(key);
    if(!object)return new Response('Not found',{status:404});
    return new Response(object.body,{headers:headers(object)});
  }
};
