/* Screen-space typography and collision layout, independent of map coordinates. */
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
export function mapTypography(zoom,readingScale=1){
 const detail=clamp(Math.log2(Math.max(1,zoom)),0,4);
 return {label:(13.5+detail*.6)*readingScale,coordinate:11*readingScale,cluster:12.5*readingScale,cell:28*readingScale,showNames:zoom>=1.7,labelLimit:zoom<3?12:zoom<6?24:40};
}
export function markerRadius(count,fontSize){
 return count>1?Math.max(11,fontSize*.65+String(count).length*2):4.5;
}
export function overlaps(a,b,gap=0){return a.x<b.x+b.width+gap&&a.x+a.width+gap>b.x&&a.y<b.y+b.height+gap&&a.y+a.height+gap>b.y;}
export function clusterMapPoints(points,cell,fontSize){
 const cells=new Map();
 for(const point of points){const key=Math.round(point.x/cell)+','+Math.round(point.y/cell);if(!cells.has(key))cells.set(key,[]);cells.get(key).push(point);}
 const make=group=>({group,x:group.reduce((n,p)=>n+p.x,0)/group.length,y:group.reduce((n,p)=>n+p.y,0)/group.length,r:markerRadius(group.length,fontSize)});
 const dots=[...cells.values()].map(make);
 // Adjacent grid cells can still overlap; merge those pairs until all circles fit.
 let merged=true;
 while(merged){merged=false;for(let i=0;i<dots.length;i++){for(let j=i+1;j<dots.length;j++){
  if(Math.hypot(dots[i].x-dots[j].x,dots[i].y-dots[j].y)<dots[i].r+dots[j].r+3){
   dots[i]=make([...dots[i].group,...dots[j].group]);dots.splice(j,1);j--;merged=true;
  }
 }}}
 return dots;
}
export function placeMapLabel(dot,width,height,bounds,occupied=[]){
 const offset=dot.r+5;
 const candidates=[
  {x:dot.x+offset,y:dot.y-height/2},
  {x:dot.x-offset-width,y:dot.y-height/2},
  {x:dot.x-width/2,y:dot.y-offset-height},
  {x:dot.x-width/2,y:dot.y+offset},
 ];
 for(const point of candidates){const rect={...point,width,height};
  if(rect.x<bounds.x||rect.y<bounds.y||rect.x+width>bounds.x+bounds.width||rect.y+height>bounds.y+bounds.height)continue;
  if(occupied.some(other=>overlaps(rect,other,4)))continue;
  return rect;
 }
 return null;
}
