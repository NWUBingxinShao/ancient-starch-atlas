/** Pointer gestures shared by the map and plate viewer. Image pixels stay intact. */
export function pinchTransform(start,from,to,minScale,maxScale){
 const scale=Math.max(minScale,Math.min(maxScale,start.scale*to.distance/Math.max(1,from.distance)));
 const ratio=scale/start.scale;
 return {scale,x:to.x-(from.x-start.x)*ratio,y:to.y-(from.y-start.y)*ratio};
}
export function bindPanZoom(node,{getTransform,setTransform,minScale,maxScale,centered=false,onTap,onHover,blocked=()=>false}){
 const pointers=new Map();let baseline=null,moved=false,suppressClickUntil=0;
 const point=e=>{const r=node.getBoundingClientRect();return {x:e.clientX-r.left-(centered?r.width/2:0),y:e.clientY-r.top-(centered?r.height/2:0)};};
 const pair=()=>{const [a,b]=[...pointers.values()];return {x:(a.x+b.x)/2,y:(a.y+b.y)/2,distance:Math.hypot(a.x-b.x,a.y-b.y)};};
 function reset(){baseline=pointers.size>1?{transform:{...getTransform()},pair:pair()}:
  pointers.size?{transform:{...getTransform()},point:[...pointers.values()][0]}:null;}
 node.addEventListener('pointerdown',e=>{
  if(blocked()||e.button!==0)return;if(!pointers.size)moved=false;
  pointers.set(e.pointerId,point(e));if(pointers.size>1)moved=true;reset();
  // Keep a stationary hotspot clickable. Once a drag or pinch begins, the stage
  // captures the pointer so the image cannot jump when crossing panel borders.
  if(!e.target.closest?.('.panel-hotspot')||pointers.size>1)node.setPointerCapture(e.pointerId);
 },true);
 node.addEventListener('pointermove',e=>{
  if(blocked())return;if(!pointers.has(e.pointerId)){onHover?.(e);return;}
  const p=point(e);pointers.set(e.pointerId,p);
  if(pointers.size>1){moved=true;setTransform(pinchTransform(baseline.transform,baseline.pair,pair(),minScale,maxScale));}
  else {const dx=p.x-baseline.point.x,dy=p.y-baseline.point.y;
   if(Math.hypot(dx,dy)>5)moved=true;
   if(moved){node.setPointerCapture(e.pointerId);setTransform({...baseline.transform,x:baseline.transform.x+dx,y:baseline.transform.y+dy});}}
  if(moved)e.preventDefault();
 },{capture:true,passive:false});
 function finish(e,cancelled=false){if(!pointers.has(e.pointerId))return;
  const tap=!cancelled&&!moved&&pointers.size===1;if(moved)suppressClickUntil=Date.now()+400;pointers.delete(e.pointerId);reset();
  if(tap)onTap?.(e);}
 node.addEventListener('pointerup',e=>finish(e),true);
 node.addEventListener('pointercancel',e=>finish(e,true),true);
 node.addEventListener('lostpointercapture',e=>finish(e,true));
 node.addEventListener('click',e=>{if(Date.now()<suppressClickUntil){e.preventDefault();e.stopImmediatePropagation();}},true);
 window.addEventListener('blur',()=>{pointers.clear();baseline=null;});
}
