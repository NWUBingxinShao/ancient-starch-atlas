/** Responsive controls use the same catalog, filters, dialogs and saved library. */
export function initMobileUI({state,t,resetImage}){
 const $=s=>document.querySelector(s),mobile=matchMedia('(max-width:760px)');
 const workspace=$('.workspace'),map=$('#map-view'),sidebar=$('.site-sidebar');sidebar.id='site-sidebar';
 const make=(tag,cls)=>{const n=document.createElement(tag);n.className=cls;return n;};
 const toggle=make('button','mobile-sites-toggle');toggle.id='mobile-sites-toggle';toggle.type='button';toggle.setAttribute('aria-controls','site-sidebar');
 const sitesLabel=make('span',''),sitesCount=make('span','mobile-sites-count');toggle.append(sitesLabel,sitesCount);$('.map-layout').append(toggle);
 const close=make('button','mobile-sites-close');close.type='button';close.id='mobile-sites-close';$('.sidebar-head').append(close);
 function setSites(open,focus=false){map.classList.toggle('mobile-sites-open',open);toggle.setAttribute('aria-expanded',String(open));
  if(mobile.matches){sidebar.inert=!open;if(focus&&open)$('#site-search').focus();}}
 toggle.onclick=()=>setSites(!map.classList.contains('mobile-sites-open'),true);
 close.onclick=()=>{setSites(false);toggle.focus();};
 const filterPanel=make('section','mobile-filter-panel');filterPanel.id='mobile-filter-panel';filterPanel.setAttribute('aria-label','检索筛选与排序');
 const filterToggle=make('button','mobile-filter-toggle');filterToggle.type='button';filterToggle.id='mobile-filter-toggle';filterToggle.setAttribute('aria-controls',filterPanel.id);
 const filterLabel=make('span',''),filterCount=make('span','');filterToggle.append(filterLabel,filterCount);
 const basic=$('.filterbar');basic.before(filterToggle,filterPanel);filterPanel.append(basic,$('.research-toolbar'));
 function setFilters(open){workspace.classList.toggle('mobile-filters-open',open);filterToggle.setAttribute('aria-expanded',String(open));
  if(open&&mobile.matches)filterPanel.querySelector('details').open=true;}
 filterToggle.onclick=()=>{setFilters(!workspace.classList.contains('mobile-filters-open'));render();};
 const imageFocus=make('button','mobile-image-focus');imageFocus.id='mobile-image-focus';imageFocus.type='button';$('.image-toolbar').append(imageFocus);
 const dialog=$('#detail-dialog');
 function setImageFocus(open){if(open&&$('#image-stage').classList.contains('panel-marking'))$('#mark-panel-position').click();dialog.classList.toggle('mobile-image-focused',open);imageFocus.setAttribute('aria-pressed',String(open));
  imageFocus.textContent=open?t('返回图注','Back to caption'):t('专注看图','Focus image');requestAnimationFrame(resetImage);}
 imageFocus.onclick=()=>setImageFocus(!dialog.classList.contains('mobile-image-focused'));
 dialog.addEventListener('close',()=>setImageFocus(false));
 // Long editing controls stay available without occupying the first mobile screen.
 const editor=make('details','mobile-position-editor'),editorLabel=make('summary','');editor.append(editorLabel);
 const tools=$('.panel-tools');tools.before(editor);editor.append(tools,$('.panel-mark-form'));
 const icons={map:'M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z M9 3v15 M15 6v15',plates:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',papers:'M5 3h14v18H5z M9 8h6 M9 12h6 M9 16h4'};
 for(const b of document.querySelectorAll('.masthead .nav[data-view]')){
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');svg.classList.add('mobile-nav-icon');
  const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',icons[b.dataset.view]);svg.append(path);b.prepend(svg);
 }
 const credits=document.querySelector('.masthead .credits-link');
 if(credits){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');svg.classList.add('mobile-nav-icon');const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d','M12 20S3 14 3 8a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 6-9 12-9 12z');svg.append(path);credits.prepend(svg);}
 let lastView=state.view;
 function render(){
  if(lastView!==state.view){setSites(false);setFilters(false);if(mobile.matches)window.scrollTo({top:0,behavior:'instant'});lastView=state.view;}
  sitesLabel.textContent=map.classList.contains('mobile-sites-open')?t('收起遗址列表','Hide sites'):t('查找遗址与文献','Find sites & papers');
  sitesCount.textContent=$('#site-count').textContent.replace(' SITES','');
  close.textContent='×';close.setAttribute('aria-label',t('关闭遗址列表','Close site list'));
  filterLabel.textContent=workspace.classList.contains('mobile-filters-open')?t('收起筛选与排序','Hide filters & sort'):t('筛选与排序','Filters & sort');
  const count=[...filterPanel.querySelectorAll('select')].filter(s=>s.id!=='sort'&&s.value).length;
  filterCount.textContent=count?t(`已选 ${count} 项`,`${count} active`):t('材料 · 植物 · 加工','Context · plants · processing');
  editorLabel.textContent=t('分图位置与补标工具','Panel position tools');
  if(!dialog.classList.contains('mobile-image-focused'))imageFocus.textContent=t('专注看图','Focus image');
  for(const b of document.querySelectorAll('.masthead .nav')){
   b.setAttribute('aria-current',b.dataset.view===state.view?'page':'false');
   // updateLanguage replaces textContent, so restore the SVG after translation.
   if(!b.querySelector('svg')){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');svg.classList.add('mobile-nav-icon');const p=document.createElementNS(svg.namespaceURI,'path');p.setAttribute('d',icons[b.dataset.view]||'M12 20S3 14 3 8a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 6-9 12-9 12z');svg.append(p);b.prepend(svg);}
  }
 }
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&map.classList.contains('mobile-sites-open')&&!document.querySelector('dialog[open]')){setSites(false);toggle.focus();}});
 mobile.addEventListener('change',()=>{sidebar.inert=mobile.matches&&!map.classList.contains('mobile-sites-open');if(!mobile.matches){editor.open=true;setImageFocus(false);}else editor.open=false;render();});
 if(!mobile.matches)editor.open=true;
 setSites(false);setFilters(false);render();
 return {render,siteSelected:()=>{if(mobile.matches&&state.view==='map')setSites(true);},detailChanged:()=>{setImageFocus(false);$('.detail-layout').scrollTop=0;}};
}
