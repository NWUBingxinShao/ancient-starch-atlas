import {initResearchUI} from './research-ui.js?v=20261021a';
import {fetchCatalog,catalogSignature,createCatalogSync} from './catalog-sync.js?v=20261020c';
import {initMobileUI} from './mobile-ui.js?v=20261104';
import {bindPanZoom} from './touch-viewer.js?v=20261024';
import {mapTypography,clusterMapPoints,placeMapLabel} from './map-labels.js?v=20261104-light2';
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const cfg = window.ATLAS_CONFIG;
const state = {lang:localStorage.getItem('atlas-language')||'zh',view:'map',page:1,q:'',year:'',type:'',sourceLanguage:'',sort:'id',site:null,compare:new Set(),compact:false};
let data,paperByKey,figureById,siteById,filtered=[],detail=null,captionMode='zh',toastTimer,researchTools,catalogSync,mobileTools;
const catalogUrl=cfg.apiBaseUrl?cfg.apiBaseUrl.replace(/\/$/,'')+'/catalog':cfg.catalogUrl;
const t=(zh,en)=>state.lang==='zh'?zh:en;
const text=(node,value)=>{node.textContent=value??'';return node};
const el=(tag,cls,value)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(value!=null)n.textContent=value;return n};
const normalized=s=>String(s||'').normalize('NFKC').toLocaleLowerCase().replace(/\s+/g,' ');
const title=f=>state.lang==='zh'?(f.title_zh||f.title_en):(f.title_en||f.title_zh);
const otherTitle=f=>state.lang==='zh'?f.title_en:f.title_zh;
const fileSize=n=>n>=1024**2?(n/1024**2).toFixed(1)+' MB':Math.round(n/1024)+' KB';
const media=f=>(cfg.mediaBaseUrl?cfg.mediaBaseUrl.replace(/\/$/,'')+'/':'')+f.image_url;
const preview=f=>(cfg.previewBaseUrl?cfg.previewBaseUrl.replace(/\/$/,'')+'/':'')+f.thumbnail;
const notify=message=>{text($('#toast'),message);$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,2200)};
async function copy(value){
 let copied=false;try{await navigator.clipboard.writeText(value);copied=true}catch{}
 // Plain HTTP on a private LAN does not provide the modern clipboard API.
 if(!copied){const previous=document.activeElement,box=document.createElement('textarea');box.value=value;box.readOnly=true;box.style.cssText='position:fixed;top:0;left:-9999px;font-size:16px';const parent=document.querySelector('dialog[open]')||document.body;parent.append(box);box.select();box.setSelectionRange(0,box.value.length);try{copied=document.execCommand('copy')}catch{}box.remove();previous?.focus({preventScroll:true});}
 notify(copied?t('已复制','Copied'):t('复制失败，请选中文字手动复制','Select the text to copy manually'));
}
function doiUrl(doi){if(!/^10\.\d{4,9}\//.test(doi||''))return '';return 'https://doi.org/'+doi}
function shortCaption(f){return f.caption_original.replace(/^(?:Fig(?:ure)?\.?|图)\s*[\w一二三四五六七八九十]+[.．、]?\s*/i,'').split(/[\n。]/)[0].slice(0,90)}
function label(f){return title(f)||shortCaption(f)||t('待命名图版','Untitled plate')}
function makeImage(f,lazy=true){const img=el('img');img.src=preview(f);img.alt=label(f);img.loading=lazy?'lazy':'eager';img.decoding='async';img.width=640;img.height=480;return img}
function updateLanguage(){
 document.documentElement.lang=state.lang==='zh'?'zh-CN':'en';
 $$('[data-zh]').forEach(n=>text(n,n.dataset[state.lang]));
 if(state.lang==='zh')$('.intro h1').replaceChildren(el('span','','在微观图像中，'),el('span','','追寻植物利用的历史。'));
 text($('#language'),t('EN ⇄ 中','中 ⇄ EN'));
 $('#search').placeholder=t('搜索植物、遗址、作者、文献编号或图注…','Search plants, sites, authors, paper IDs or captions…');
 $('#search').setAttribute('aria-label',t('检索图版与文献','Search plates and literature'));
 const options={'#year-filter':['全部年代','All years'],'#type-filter':['全部材料','All materials'],'#language-filter':['全部原文语言','All source languages']};
 for(const [sel,pair] of Object.entries(options))text($(sel).options[0],t(...pair));
 [['starch','淀粉粒','Starch'],['phytolith','植硅体','Phytoliths'],['fungi','真菌与发酵','Fungi / fermentation'],['tools','器物与加工','Tools / processing'],['calculus','牙结石','Dental calculus']].forEach(([v,zh,en])=>text($(`#type-filter option[value="${v}"]`),t(zh,en)));
 text($('#language-filter option[value="zh"]'),t('中文原文','Chinese source'));text($('#language-filter option[value="en"]'),t('英文原文','English source'));
 [['id','文献编号','Paper ID'],['new','最新发表','Newest first'],['old','最早发表','Oldest first']].forEach(([v,zh,en])=>text($(`#sort option[value="${v}"]`),t(zh,en)));
 text($('#prev-page'),t('← 上一页','← Previous'));text($('#next-page'),t('下一页 →','Next →'));
 text($('#collection-count'),t(`${data.stats.paper_records} 条题录 · ${data.stats.figures} 幅图版`,`${data.stats.paper_records} papers · ${data.stats.figures} plates`));
 renderHero();
 text($('#hero-open'),t('查看图版 ↗','Explore plate ↗'));
 text($('#compare-open'),t('并排比较','Compare plates'));text($('#compare-clear'),t('清空','Clear'));
 text($('#image-reset'),t('适合窗口','Fit image'));
 text($('#empty h2'),t('未找到匹配的图版','No matching plates'));text($('#empty p'),t('试试文献编号、拉丁名，或减少筛选条件。','Try a paper ID, a Latin name, or fewer filters.'));text($('#empty-reset'),t('清除筛选','Clear filters'));
 $('#map-china').title=t('恢复中国范围','Reset China extent');
 $('#site-search').placeholder=t('查找中国遗址…','Find a site in China…');
 text($('#site-back'),t('← 返回遗址列表','← Back to site list'));
 text($('#about-counts'),t(`${data.papers.length}条题录、${new Set(data.papers.map(p=>p.id)).size}个文献编号、${data.figures.length}幅收录图版；${data.sites.length}处定位记录。不同PDF版本保留独立键。`,`${data.papers.length} PDF records, ${new Set(data.papers.map(p=>p.id)).size} paper numbers, ${data.figures.length} selected plates; ${data.sites.length} site records. Alternative PDF versions retain separate keys.`));
 renderMapFeatures();render();if(detail)renderDetail();if(mapReady)renderSiteList();
 if(selectedSite)renderSiteDetail(siteById.get(selectedSite));
}
const patterns={starch:/淀粉|starch/i,phytolith:/植硅体|phytolith/i,fungi:/真菌|酵母|霉|发酵|fung|yeast|ferment|mould|mold/i,tools:/石器|石刀|磨盘|磨棒|陶器|蚌器|grind|tool|pottery|vessel|milling/i,calculus:/牙结石|牙齿|人牙|dental|calculus|teeth|tooth/i};
function filter(){
 const tokens=normalized(state.q).split(' ').filter(Boolean);
 filtered=data.figures.filter(f=>{
  const p=paperByKey.get(f.paper_key);
  return (!state.year||Math.floor(Number(p.year)/10)*10===Number(state.year))&&(!state.sourceLanguage||f.source_language===state.sourceLanguage)&&(!state.type||patterns[state.type].test(f.searchText))&&(!state.site||f.sites.includes(state.site))&&(!researchTools||researchTools.matches(f))&&tokens.every(q=>f.searchText.includes(q));
 });
 filtered.sort((a,b)=>state.sort==='id'?a.paper_id.localeCompare(b.paper_id)||a.number.localeCompare(b.number,undefined,{numeric:true}):(Number(paperByKey.get(a.paper_key).year)-Number(paperByKey.get(b.paper_key).year))*(state.sort==='new'?-1:1)||a.id.localeCompare(b.id));
 state.page=Math.min(state.page,Math.max(1,Math.ceil(filtered.length/cfg.pageSize)));
}
function render(){
 filter();document.body.dataset.view=state.view;
 $('.intro').hidden=state.view!=='plates';$('#view-toggle').hidden=state.view!=='plates';$('#sort').hidden=state.view==='map';
 ['plates','papers','map'].forEach(v=>{$(`#${v}-view`).hidden=state.view!==v;$$('.nav').find(n=>n.dataset.view===v).classList.toggle('active',v===state.view)});
 const paperKeys=new Set(filtered.map(f=>f.paper_key));
 text($('#result-count'),state.view==='map'?t(`${visibleSites().length} 个定位记录`,`${visibleSites().length} site records`):state.view==='papers'?t(`${paperKeys.size} 份文献`,`${paperKeys.size} papers`):t(`${filtered.length} 幅图版`,`${filtered.length} plates`));
 $('#clear-search').hidden=!state.q;renderMapSearch();
 const chips=$('#active-filters');chips.replaceChildren();
 if(state.site){const b=el('button','filter-chip',siteById.get(state.site).name+' ×');b.onclick=()=>{state.site=null;state.page=1;render()};chips.append(b)}
 if(state.view==='plates')renderGrid();else if(state.view==='papers')renderPapers();else initMap();
 researchTools?.render();mobileTools?.render();
}
function renderGrid(){
 const grid=$('#grid');grid.classList.toggle('compact',state.compact);grid.replaceChildren();
 for(const f of filtered.slice((state.page-1)*cfg.pageSize,state.page*cfg.pageSize)){
  const p=paperByKey.get(f.paper_key),card=el('article','plate-card'),open=el('button','plate-open');
  open.setAttribute('aria-label',t('查看图版：','View plate: ')+label(f));open.onclick=()=>openFigure(f.id);
  const thumb=el('div','plate-thumb');thumb.append(makeImage(f),el('span','number-tag',t('图 ','Fig. ')+f.number));
  const info=el('div','plate-info'),kicker=el('div','card-kicker');kicker.append(el('span','',p.id),el('span','',p.year||'—'));
  const foot=el('div','card-footer');foot.append(el('span','',t(f.source_language==='zh'?'中文原文':'英文原文',f.source_language==='zh'?'Chinese source':'English source')),el('span','',fileSize(f.image_bytes)+' · PNG'));
  info.append(kicker,el('h3','',label(f)),el('p','card-subtitle',otherTitle(f)||p.journal),foot);open.append(thumb,info);
  const checkLabel=el('label','compare-check'),check=el('input');check.type='checkbox';check.checked=state.compare.has(f.id);check.setAttribute('aria-label',t('选择图版进行比较：','Select for comparison: ')+label(f));check.onchange=()=>{if(check.checked&&state.compare.size>=2){check.checked=false;notify(t('最多同时比较两幅图版','Choose up to two plates'));return}check.checked?state.compare.add(f.id):state.compare.delete(f.id);updateCompare()};checkLabel.append(check);card.append(open,checkLabel);researchTools?.decorateCard(card,f);grid.append(card);
 }
 $('#empty').hidden=filtered.length>0;$('.pagination').hidden=!filtered.length;
 text($('#page-label'),`${state.page} / ${Math.max(1,Math.ceil(filtered.length/cfg.pageSize))}`);
 $('#prev-page').disabled=state.page===1;$('#next-page').disabled=state.page>=Math.ceil(filtered.length/cfg.pageSize);
}
function matchingPapers(){
 const keys=new Set(filtered.map(f=>f.paper_key));const tokens=normalized(state.q).split(' ').filter(Boolean);
 return data.papers.filter(p=>keys.has(p.key)||($('#all-literature').checked&&!p.figure_ids.length&&!state.site&&!state.type&&!researchTools?.hasFilters()&&(!state.year||Math.floor(Number(p.year)/10)*10===Number(state.year))&&(!state.sourceLanguage||p.language===state.sourceLanguage)&&tokens.every(q=>normalized([p.id,p.title_zh,p.title_en,p.citation_original].join(' ')).includes(q))));
}
function renderPapers(){
 const list=$('#paper-list');list.replaceChildren();const papers=matchingPapers();text($('#result-count'),t(`${papers.length} 条题录`,`${papers.length} bibliography records`));
 for(const p of papers){
  const row=el('article','paper-row'),content=el('div'),link=el('button','paper-link');link.append(el('h3','',title(p)));link.onclick=()=>openPaper(p.key);
  content.append(link,el('p','',otherTitle(p)),el('p','citation',p.citation_original));
  const btn=el('button','outline',p.figure_ids.length?t(`${p.figure_ids.length} 幅图版 ↗`,`${p.figure_ids.length} plates ↗`):t('查看题录 ↗','View record ↗'));btn.onclick=()=>openPaper(p.key);
  row.append(el('span','paper-id',p.id),content,btn);list.append(row);
 }
 if(!papers.length)list.append(el('p','empty',t('没有匹配的文献。','No matching papers.')));
}
function setView(v){state.view=v;render();history.replaceState(null,'','#'+v)}
function reset(){Object.assign(state,{page:1,q:'',year:'',type:'',sourceLanguage:'',site:null});researchTools?.resetFilters();$('#search').value='';$('#year-filter').value='';$('#type-filter').value='';$('#language-filter').value='';render()}
function openFigure(id,panel=''){detail=figureById.get(id);if(!detail)return;captionMode=state.lang;const dlg=$('#detail-dialog');if(!dlg.open)dlg.showModal();renderDetail();if(panel)researchTools?.focusPanel(panel);history.replaceState(null,'','#'+new URLSearchParams({figure:id,...(panel?{panel}:{})}));}
function renderDetail(){
 const f=detail,p=paperByKey.get(f.paper_key);
 text($('#detail-meta'),`${p.id} / ${t('图','Fig.')} ${f.number} · ${p.year} · PNG ${fileSize(f.image_bytes)}`);
 text($('#detail-kicker'),t('图版 / 译题辅助检索','PLATE / TRANSLATED TITLE'));
 text($('#show-panel-guide'),t(`分图释读与依据 · ${f.panel_annotations?.length||0} 条对应 ↓`,`Panel guide · ${f.panel_annotations?.length||0} entries ↓`));text($('#detail-title'),label(f));text($('#detail-title-alt'),otherTitle(f));
 $('#detail-image').src=preview(f);$('#detail-image').alt=label(f);$('#download-image').href=media(f);$('#download-image').download=f.paper_id+'_Fig_'+f.number+'.png';
 text($('#load-original'),t('载入高清原图','Load full-resolution image'));$('#load-original').disabled=false;text($('#image-state'),t('当前显示预览图','Showing a preview'));
 text($('#download-image'),t('下载原图 ↓','Download original ↓'));text($('#copy-caption'),t('复制当前图注','Copy caption'));text($('#copy-citation'),t('复制题录','Copy citation'));
 text($('#detail-paper-title'),title(p));$('#detail-paper-title').onclick=()=>openPaper(p.key);text($('#detail-citation'),p.citation_original);
 const doi=doiUrl(p.doi);$('#detail-doi').hidden=!doi;if(doi)$('#detail-doi').href=doi;
 text($('#detail-provenance'),t(`原PDF页码：${f.pdf_pages.join('、')} · SHA-256 ${f.image_sha256.slice(0,16)}…`,`PDF pages: ${f.pdf_pages.join(', ')} · SHA-256 ${f.image_sha256.slice(0,16)}…`));
 if(f.recovery_provenance)$('#detail-provenance').append(el('p','',t(`对账后补提整图 · ${f.recovery_provenance.dpi} dpi · 图注PDF页码：${(f.caption_pdf_pages||f.pdf_pages).join('、')}`,`Recovered whole plate · ${f.recovery_provenance.dpi} dpi · Caption PDF pages: ${(f.caption_pdf_pages||f.pdf_pages).join(', ')}`)));
 const related=$('#related-figures');related.replaceChildren();
 for(const id of p.figure_ids){const other=figureById.get(id);const btn=el('button','',t('图 ','Fig. ')+other.number);btn.disabled=id===f.id;btn.onclick=()=>openFigure(id);related.append(btn)}
 renderCaption();renderPanelEvidence();resetImage();researchTools?.renderDetail(f);mobileTools?.detailChanged();
}
function renderCaption(){
 $$('[data-caption]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.caption===captionMode)));
 const content=captionMode==='original'?(detail.caption_source_corrected||detail.caption_original):detail['caption_'+captionMode];
 text($('#detail-caption'),content||t('译文尚未完成','Translation pending'));
 const original=captionMode==='original'||captionMode===detail.source_language;
 const origin=detail['caption_'+captionMode+'_origin'];
 let note=captionMode==='original'?(detail.caption_source_corrected?t('原文校录 · 原始导出底稿另存','Source transcription · export archive retained'):t('原始导出图注 · 内容保留','Original exported caption · preserved')):origin==='existing_export'?t('已有中文稿 · 随导出保留','Existing Chinese caption · preserved from export'):origin==='pdf_corrected_source'?t('原文校录 · 已修订PDF文本提取错误','Source transcription · PDF extraction corrected'):original?t('原文 · 按导出内容保留','Original source caption'):t('译文 · 本地模型初译，待人工审定','Translation · local model draft, not human-approved');
 if(detail.editorial_review?.status==='approved')note=t('核对通过 · ','Reviewed · ')+detail.editorial_review.reviewer+' · '+note;else if(origin==='editorial_revision')note=t('编辑修订译文','Editorially revised translation');if(origin==='translation_reviewed'&&!original)note=t('译文 · 已对照原文修订','Translation · revised against the source');if(detail.panel_note)note+=' · '+detail.panel_note;
 if(detail.caption_note)note+=' · '+detail.caption_note;
 if(detail.editorial_review?.status==='approved')note=t('人工核对通过 · ','Human reviewed · ')+detail.editorial_review.reviewer; text($('#translation-label'),note);
}
function stepFigure(delta){const list=filtered.length?filtered:data.figures;const i=list.findIndex(f=>f.id===detail.id);if(list[i+delta])openFigure(list[i+delta].id)}
function openPaper(key){
 const p=paperByKey.get(key),c=$('#paper-content');c.replaceChildren();c.append(el('div','eyebrow',p.id+' · '+p.year),el('h2','',title(p)),el('h3','',otherTitle(p)),el('p','paper-citation',p.citation_original));
 const acts=el('div','source-actions'),cp=el('button','text-button',t('复制原始题录','Copy original citation'));cp.onclick=()=>copy(p.citation_original);acts.append(cp);
 const doi=doiUrl(p.doi);if(doi){const a=el('a','', 'DOI ↗');a.href=doi;a.target='_blank';a.rel='noopener';acts.append(a)}
 if(p.figure_ids.length){
  const exportBtn=el('button','text-button',t('下载双语图注 TXT','Download bilingual captions'));
  exportBtn.onclick=()=>downloadPaper(p);
  acts.append(exportBtn);
 }
 c.append(acts);
 if(p.alias_of){const alias=paperByKey.get(p.alias_of),link=el('button','primary',t('查看同文献已收录的图版 →','View plates under the canonical record →'));link.onclick=()=>{$('#paper-dialog').close();openPaper(alias.key)};c.append(link)}
 if(p.site_links?.length){const sites=el('div','related-figures');for(const assoc of p.site_links){const s=siteById.get(assoc.site_id);if(!s)continue;const b=el('button','',s.name+(assoc.role==='vessel_comparison'?t('（器物比较）',' (vessel comparison)'):''));b.onclick=()=>{$('#paper-dialog').close();setView('map');selectSite(s)};sites.append(b)}c.append(el('h3','',t('研究材料与遗址','Study materials and sites')),sites)}
 const grid=el('div','paper-mini-grid');for(const id of p.figure_ids){const f=figureById.get(id),b=el('button');b.append(makeImage(f),el('span','',t('图 ','Fig. ')+f.number+' · '+label(f)));b.onclick=()=>{$('#paper-dialog').close();openFigure(id)};grid.append(b)}c.append(grid);$('#paper-dialog').showModal();
}
function downloadPaper(p){let lines=[p.citation_original,'',p.title_zh,p.title_en,'译文核对状态以各图版记录为准；原文底稿保留。',''];for(const id of p.figure_ids){const f=figureById.get(id);lines.push('图 '+f.number+' '+f.title_zh,f.title_en,'【原文校录】',f.caption_source_corrected||f.caption_original,'【中文】',f.caption_zh,'【English】',f.caption_en,'')}const u=URL.createObjectURL(new Blob([lines.join('\n')],{type:'text/plain;charset=utf-8'}));const a=el('a');a.href=u;a.download=p.key+'_双语图注.txt';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}
let imageScale=1,imageX=0,imageY=0,imageDrag;
function imageTransform(){($('#image-frame')||$('#detail-image')).style.transform=`translate(${imageX}px,${imageY}px) scale(${imageScale})`}
function resetImage(){imageScale=1;imageX=0;imageY=0;imageTransform();researchTools?.fitFrame()}
function zoomImage(mult){imageScale=Math.max(.5,Math.min(10,imageScale*mult));imageTransform()}
function focusImageBoxes(boxes){if(!boxes?.length)return;const frame=$('#image-frame'),stage=$('#image-stage'),x0=Math.min(...boxes.map(b=>b[0])),x1=Math.max(...boxes.map(b=>b[2])),y0=Math.min(...boxes.map(b=>b[1])),y1=Math.max(...boxes.map(b=>b[3]));imageScale=Math.min(8,Math.max(1,Math.min(stage.clientWidth*.85/(frame.clientWidth*(x1-x0)),stage.clientHeight*.85/(frame.clientHeight*(y1-y0)))));imageX=-(.5*(x0+x1)-.5)*frame.clientWidth*imageScale;imageY=-(.5*(y0+y1)-.5)*frame.clientHeight*imageScale;imageTransform();stage.scrollIntoView({block:'center',behavior:'smooth'});}
function updateCompare(){$('#compare-bar').hidden=!state.compare.size;text($('#compare-count'),t(`已选 ${state.compare.size} / 2 幅图版`,`${state.compare.size} / 2 selected`));$('#compare-open').disabled=state.compare.size<2}
function openCompare(){const content=$('#compare-content');content.replaceChildren();for(const id of state.compare){const f=figureById.get(id),pane=el('div','compare-pane'),a=el('a','text-button',t('下载高清原图 ↓','Download original ↓'));a.href=media(f);a.download=true;pane.append(makeImage(f,false),el('h3','',f.paper_id+' · '+label(f)),a,el('p','',f['caption_'+state.lang]));content.append(pane)}$('#compare-dialog').showModal()}
let hoverSite=null;let mapReady=false,land=[],mapWidth=1,mapHeight=1,mapScale=1,mapReferenceScale=1,mapX=0,mapY=0,mapDots=[],mapDrag=null,selectedSite=null;
const project=(lon,lat)=>[(lon+180)/360*1000,(1-Math.log(Math.tan(Math.PI/4+Math.max(-85,Math.min(85,lat))*Math.PI/360))/Math.PI)/2*1000];
function fitMap(bounds){const a=project(bounds[0],bounds[3]),b=project(bounds[2],bounds[1]);const phone=mapWidth<=760,left=mapWidth>=1500?420:mapWidth>=1200?360:285,right=mapWidth>=1900?430:mapWidth>=1500?375:mapWidth>=1200?335:300;const vw=mapWidth>1050?mapWidth-left-right:mapWidth,cx=mapWidth>1050?left+vw/2:mapWidth/2,top=phone?155:0,bottom=phone?86:0,vh=Math.max(160,mapHeight-top-bottom);mapScale=Math.min(vw/(b[0]-a[0]),vh*.94/(b[1]-a[1]))*.9;mapReferenceScale=mapScale;mapX=cx-(a[0]+b[0])/2*mapScale;mapY=top+vh/2-(a[1]+b[1])/2*mapScale;drawMap()}
async function initMap(){
 if(mapReady){resizeMap();renderSiteList();return}
 mapReady=true;try{const geo=await (await fetch('assets/land.geojson')).json();for(const f of geo.features){const polygons=f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates;for(const rings of polygons)land.push(rings.map(r=>r.map(([lon,lat])=>project(lon,lat))))}}catch{notify(t('底图未载入，仍可查看遗址点','Land outline unavailable; site coordinates remain visible'))}
 resizeMap();fitMap([73,16,136,55]);renderSiteList();new ResizeObserver(()=>resizeMap()).observe($('#map').parentElement);
}
function resizeMap(){const canvas=$('#map');if(!canvas||$('#map-view').hidden)return;const rect=canvas.getBoundingClientRect();if(!rect.width)return;const oldW=mapWidth,oldH=mapHeight;mapWidth=rect.width;mapHeight=rect.height;canvas.width=mapWidth*devicePixelRatio;canvas.height=mapHeight*devicePixelRatio;if(oldW>1){mapX+=(mapWidth-oldW)/2;mapY+=(mapHeight-oldH)/2}drawMap()}
function visibleSites(){let sites=data.sites.filter(s=>(s.association_status!=='no_verified_study_link')&&($('#approximate').checked||!s.approximate));const q=normalized($('#site-search').value);if(q)sites=sites.filter(s=>normalized([s.name,s.object,s.source,...(s.paper_keys||[]).map(key=>{const p=paperByKey.get(key);return p?[p.id,p.title_zh,p.title_en].join(' '):''})].join(' ')).includes(q));if(state.q||state.year||state.type||state.sourceLanguage||researchTools?.hasFilters()){const associated=new Set(filtered.flatMap(f=>f.sites));sites=sites.filter(s=>associated.has(s.id)||normalized(s.name).includes(normalized(state.q))&&state.q)}return sites}
function drawMap(){
 if(!mapReady||!mapWidth)return;const palette=getComputedStyle(document.documentElement),color=name=>palette.getPropertyValue('--map-'+name).trim();const canvas=$('#map'),ctx=canvas.getContext('2d');ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);ctx.clearRect(0,0,mapWidth,mapHeight);ctx.fillStyle=color('bg');ctx.fillRect(0,0,mapWidth,mapHeight);
 const fontScale=Number(palette.getPropertyValue('--atlas-font-scale'))||1,typography=mapTypography(mapScale/mapReferenceScale,fontScale),labelSize=typography.label,clusterSize=typography.cluster;
 const screen=p=>[p[0]*mapScale+mapX,p[1]*mapScale+mapY];ctx.strokeStyle=color('grid');ctx.lineWidth=.6;ctx.textBaseline='alphabetic';
 for(let lon=-180;lon<=180;lon+=20){
  const [x]=screen(project(lon,0));
  ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,mapHeight);ctx.stroke();
 }
 for(let lat=-80;lat<=80;lat+=20){
  const [,y]=screen(project(0,lat));
  ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(mapWidth,y);ctx.stroke();
 }
 ctx.fillStyle=color('land');ctx.strokeStyle=color('coast');ctx.lineWidth=1;ctx.shadowBlur=25;ctx.shadowColor=color('glow');
 for(const rings of land){ctx.beginPath();for(const ring of rings){ring.forEach((p,i)=>{const [x,y]=screen(p);i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.closePath()}ctx.fill('evenodd');ctx.stroke()}
 ctx.shadowBlur=0;const points=[];for(const s of visibleSites()){const [x,y]=screen(project(s.lon,s.lat));if(x< -20||x>mapWidth+20||y< -20||y>mapHeight+20)continue;points.push({s,x,y})}
 mapDots=clusterMapPoints(points,typography.cell,clusterSize);
 for(const {group,x,y,r} of mapDots){const selected=group.some(p=>p.s.id===selectedSite||p.s.id===hoverSite);
  ctx.beginPath();ctx.arc(x,y,r+(selected?3:0),0,2*Math.PI);ctx.fillStyle=selected?color('selected'):group.length===1&&group[0].s.approximate?color('approx'):color('point');ctx.fill();ctx.strokeStyle=selected?color('selected'):color('point-stroke');ctx.lineWidth=1.8;ctx.stroke();
  if(group.length>1){ctx.fillStyle=color('cluster-text');ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`600 ${clusterSize}px "Segoe UI",sans-serif`;ctx.fillText(group.length,x,y+.5)}
 }
 // Place text after every marker, prioritising the actual selected/hovered site.
 const canvasRect=canvas.getBoundingClientRect(),blocked=[];
 for(const element of $$('.map-story,.site-sidebar,.map-controls,.atlas-rail,.searchbar,.mobile-sites-toggle,.map-bottom')){const rect=element.getBoundingClientRect();if(!rect.width||!rect.height||getComputedStyle(element).visibility==='hidden')continue;blocked.push({x:rect.left-canvasRect.left,y:rect.top-canvasRect.top,width:rect.width,height:rect.height});}
 const candidates=mapDots.map(dot=>{const selected=dot.group.find(p=>p.s.id===selectedSite),hovered=dot.group.find(p=>p.s.id===hoverSite);return {...dot,person:selected||hovered||dot.group[0],priority:selected?2:hovered?1:0};}).filter(dot=>dot.priority||typography.showNames&&dot.group.length===1).sort((a,b)=>b.priority-a.priority||(b.person.s.paper_keys?.length||0)-(a.person.s.paper_keys?.length||0)||a.person.s.id.localeCompare(b.person.s.id));
 const labels=[],bounds={x:8,y:28,width:Math.max(0,mapWidth-16),height:Math.max(0,mapHeight-40)};
 ctx.font=`500 ${labelSize}px "Microsoft YaHei",sans-serif`;ctx.textAlign='left';ctx.textBaseline='middle';
 for(const dot of candidates){if(labels.length>=typography.labelLimit)break;const padding=5*fontScale,height=labelSize+padding*2,name=dot.person.s.name,width=ctx.measureText(name).width+padding*2;
  const markers=dot.priority?[]:mapDots.filter(other=>other.group!==dot.group).map(other=>({x:other.x-other.r,y:other.y-other.r,width:other.r*2,height:other.r*2}));
  const rect=placeMapLabel(dot,width,height,bounds,[...blocked,...labels,...markers]);if(!rect)continue;
  ctx.fillStyle=color('label-bg');ctx.beginPath();ctx.roundRect(rect.x,rect.y,rect.width,rect.height,4);ctx.fill();ctx.fillStyle=color('label-text');ctx.fillText(name,rect.x+padding,rect.y+height/2);labels.push(rect);
 }
}
window.addEventListener('atlas-theme-change',()=>drawMap());
window.addEventListener('atlas-font-change',()=>drawMap());
function coordinateSource(site){
 const kind=site.kind||'';
 if(kind.includes('范围中点'))return t('论文范围中点','Midpoint of published range');
 if(site.approximate){
  if(kind.startsWith('B 论文报告'))return t('论文坐标（近似）','Approximate paper coordinates');
  return t('邻近区域估算','Estimated from nearby area');
 }
 if(kind.startsWith('A')||(kind==='人工维护坐标'&&site.notes?.startsWith('原文')))return t('原论文坐标','Original paper coordinates');
 return t('其他文献坐标','Other published coordinates');
}
let siteListScroll=0;
function clearSiteSelection(){
 selectedSite=null;
 hoverSite=null;
 $('#site-detail').hidden=true;
 $('#site-back').hidden=true;
 $('#site-list').scrollTop=siteListScroll;
}
function renderSiteList(){
 const sites=visibleSites();
 if(selectedSite&&!sites.some(s=>s.id===selectedSite))clearSiteSelection();
 text($('#site-count'),sites.length+' SITES');
 const list=$('#site-list'),scroll=list.scrollTop;
 list.replaceChildren();
 for(const s of sites){
  const b=el('button');
  b.dataset.siteId=s.id;
  b.append(el('span','',s.name),el('small','',coordinateSource(s)));
  b.onclick=()=>selectSite(s);
  b.onmouseenter=()=>{hoverSite=s.id;drawMap()};
  b.onmouseleave=()=>{hoverSite=null;drawMap()};
  list.append(b);
 }
 list.scrollTop=scroll;
 drawMap();
 mobileTools?.render();
}
function selectSite(s){
 if(!selectedSite)siteListScroll=$('#site-list').scrollTop;
 selectedSite=s.id;
 const point=project(s.lon,s.lat);
 mapScale=Math.max(mapScale,3);
 mapX=mapWidth/2-point[0]*mapScale;
 mapY=mapHeight/2-point[1]*mapScale;
 renderSiteDetail(s);
 $('#site-detail').scrollTop=0;
 mobileTools?.siteSelected();
 $('#site-back').focus({preventScroll:true});
 drawMap();
}
function renderSiteDetail(s){
 const node=$('#site-detail');
 node.hidden=false;
 $('#site-back').hidden=false;
 node.replaceChildren();
 node.append(el('h3','',s.name),el('p','',coordinateSource(s)));
 if(s.source)node.append(el('p','',t('来源：','Source: ')+s.source));
 const papers=(s.paper_keys||[]).map(key=>paperByKey.get(key)).filter(Boolean);node.append(el('h4','',t(`相关文献 ${papers.length} 篇`,`Related papers (${papers.length})`)));
 const paperList=el('div','site-paper-links');for(const p of papers){const link=el('button','paper-link',p.id+' · '+title(p));const assoc=p.site_links?.find(a=>a.site_id===s.id);link.onclick=()=>openPaper(p.key);paperList.append(link);if(assoc?.role==='vessel_comparison')paperList.append(el('small','provenance',t('器物比较','Vessel comparison')));if(assoc?.evidence?.length)paperList.append(el('small','provenance',t('原PDF第 ','Source PDF p. ')+assoc.evidence.map(e=>e.page).filter(Boolean).join(', ')));}node.append(paperList);
 const figs=data.figures.filter(f=>f.sites.includes(s.id));const b=el('button','text-button',figs.length?t(`查看材料关联的 ${figs.length} 幅图版 →`,`View ${figs.length} material-related plates →`):t('当前收录图版暂无材料关联','No material-related plates in this selection'));b.disabled=!figs.length;b.onclick=()=>{state.site=s.id;state.page=1;setView('plates')};node.append(b);const minis=el('div','site-miniatures');for(const f of figs.slice(0,3)){const item=el('button');item.append(makeImage(f));item.onclick=()=>openFigure(f.id);minis.append(item)}node.append(minis);
}
function zoomMap(factor,x=mapWidth/2,y=mapHeight/2){const scale=Math.min(150,Math.max(.3,mapScale*factor));const ratio=scale/mapScale;mapX=x-(x-mapX)*ratio;mapY=y-(y-mapY)*ratio;mapScale=scale;drawMap()}
function bind(){
 $('.brand').onclick=e=>{e.preventDefault();reset();setView('plates');window.scrollTo(0,0)};
 $$('.nav[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));$('#language').onclick=()=>{state.lang=state.lang==='zh'?'en':'zh';localStorage.setItem('atlas-language',state.lang);updateLanguage()};
 let timer;$('#search').oninput=e=>{clearTimeout(timer);timer=setTimeout(()=>{state.q=e.target.value;state.page=1;render()},160)};$('#clear-search').onclick=()=>{state.q='';$('#search').value='';state.page=1;render()};
 for(const [id,key] of [['year-filter','year'],['type-filter','type'],['language-filter','sourceLanguage'],['sort','sort']])$('#'+id).onchange=e=>{state[key]=e.target.value;state.page=1;render()};
 $('#reset').onclick=reset;$('#empty-reset').onclick=reset;$('#view-toggle').onclick=()=>{state.compact=!state.compact;$('#view-toggle').setAttribute('aria-pressed',state.compact);renderGrid()};
 $('#prev-page').onclick=()=>{state.page--;renderGrid();$('.searchbar').scrollIntoView({behavior:'smooth',block:'start'})};$('#next-page').onclick=()=>{state.page++;renderGrid();$('.searchbar').scrollIntoView({behavior:'smooth',block:'start'})};
 $$('.close').forEach(b=>b.onclick=()=>b.closest('dialog').close());$$('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close()}}));
 $('#detail-dialog').addEventListener('close',()=>history.replaceState(null,'','#'+state.view));
 for(const id of ['about','footer-about'])$('#'+id).onclick=()=>$('#about-dialog').showModal();
 $$('[data-caption]').forEach(b=>b.onclick=()=>{captionMode=b.dataset.caption;renderCaption()});$('#copy-caption').onclick=()=>copy($('#detail-caption').textContent);$('#copy-citation').onclick=()=>copy(paperByKey.get(detail.paper_key).citation_original);
 $('#detail-prev').onclick=()=>stepFigure(-1);$('#detail-next').onclick=()=>stepFigure(1);
 $('#load-original').onclick=()=>{if(!detail)return;const id=detail.id;$('#load-original').disabled=true;text($('#image-state'),t('正在载入高清原图…','Loading the full-resolution original…'));const im=new Image();im.onload=()=>{if(detail?.id!==id)return;$('#detail-image').src=im.src;text($('#image-state'),t(`原图 ${im.naturalWidth} × ${im.naturalHeight} px`,`Original ${im.naturalWidth} × ${im.naturalHeight} px`));text($('#load-original'),t('已载入原图','Original loaded'));resetImage()};im.onerror=async()=>{await catalogSync?.check(true);if(detail?.id!==id)return;$('#load-original').disabled=false;text($('#image-state'),t('原图加载失败，可重试或下载','Unable to load; retry or download the original'))};im.src=media(detail)};
 $('#image-plus').onclick=()=>zoomImage(1.25);$('#image-minus').onclick=()=>zoomImage(.8);$('#image-reset').onclick=resetImage;
 const stage=$('#image-stage');stage.onwheel=e=>{e.preventDefault();zoomImage(e.deltaY<0?1.12:1/1.12)};
 bindPanZoom(stage,{getTransform:()=>({scale:imageScale,x:imageX,y:imageY}),setTransform:p=>{imageScale=p.scale;imageX=p.x;imageY=p.y;imageTransform()},minScale:.5,maxScale:10,centered:true,blocked:()=>stage.classList.contains('panel-marking')});
 $('#compare-clear').onclick=()=>{state.compare.clear();updateCompare();if(state.view==='plates')renderGrid()};$('#compare-open').onclick=openCompare;
 document.addEventListener('keydown',e=>{const editing=['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)||document.activeElement.isContentEditable;if(e.key==='/'&&!editing&&!document.querySelector('dialog[open]')){e.preventDefault();$('#search').focus()}if($('#detail-dialog').open&&!$('#paper-dialog').open&&!$('#library-dialog')?.open&&!$('#plate-citation-dialog')?.open&&!editing){if(e.key==='ArrowLeft')stepFigure(-1);if(e.key==='ArrowRight')stepFigure(1)}});
 $('#map-china').onclick=()=>fitMap([73,16,136,55]);$('#map-world').onclick=()=>fitMap([73,16,136,55]);$('#zoom-in').onclick=()=>zoomMap(1.5);$('#zoom-out').onclick=()=>zoomMap(1/1.5);
 $('#site-search').oninput=()=>{
  siteListScroll=0;
  clearSiteSelection();
  renderSiteList();
 };
 $('#approximate').onchange=renderSiteList;
 $('#site-back').onclick=()=>{
  const previous=selectedSite;
  clearSiteSelection();
  const button=[...$('#site-list').children].find(item=>item.dataset.siteId===previous);
  (button||$('#site-search')).focus({preventScroll:true});
  drawMap();
 };
 const canvas=$('#map');canvas.onwheel=e=>{e.preventDefault();const r=canvas.getBoundingClientRect();zoomMap(e.deltaY<0?1.15:1/1.15,e.clientX-r.left,e.clientY-r.top)};
 bindPanZoom(canvas,{getTransform:()=>({scale:mapScale,x:mapX,y:mapY}),setTransform:p=>{mapScale=p.scale;mapX=p.x;mapY=p.y;drawMap()},minScale:.3,maxScale:150,
  onHover:e=>{const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top,dot=mapDots.find(d=>Math.hypot(d.x-x,d.y-y)<d.r+7);canvas.style.cursor=dot?'pointer':'grab';const tip=$('#map-tooltip');tip.hidden=!dot;if(dot){text(tip,dot.group.map(p=>p.s.name).join(' · '));tip.style.left=Math.min(x+16,mapWidth-220)+'px';tip.style.top=Math.max(10,y-30)+'px'}},
  onTap:e=>{const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top,padding=e.pointerType==='touch'?15:5;const dot=mapDots.filter(d=>Math.hypot(d.x-x,d.y-y)<d.r+padding).sort((a,b)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y))[0];if(dot){if(dot.group.length>1&&mapScale<70)zoomMap(2,dot.x,dot.y);else selectSite(dot.group[0].s)}}});
 canvas.onpointerleave=()=>$('#map-tooltip').hidden=true;
 canvas.onkeydown=e=>{if(e.key==='+'||e.key==='=')zoomMap(1.5);if(e.key==='-')zoomMap(1/1.5);const shift={ArrowLeft:[35,0],ArrowRight:[-35,0],ArrowUp:[0,35],ArrowDown:[0,-35]}[e.key];if(shift){e.preventDefault();mapX+=shift[0];mapY+=shift[1];drawMap()}};
}
async function init(){
 try{data=await fetchCatalog(catalogUrl);paperByKey=new Map(data.papers.map(p=>[p.key,p]));figureById=new Map(data.figures.map(f=>[f.id,f]));siteById=new Map(data.sites.map(s=>[s.id,s]));
 for(const f of data.figures){const p=paperByKey.get(f.paper_key);f.searchText=normalized([f.paper_id,f.number,f.title_zh,f.title_en,f.caption_original,f.caption_zh,f.caption_en,p.title_zh,p.title_en,p.citation_original,f.sites.map(id=>siteById.get(id)?.name).join(' '),JSON.stringify(f.panel_annotations||[])].join(' '))}
 researchTools=await initResearchUI({$,$$,el,text,t,data,state,cfg,notify,copy,render,openFigure,getDetail:()=>detail,makeImage,label,paperByKey,resetImage,focusImageBoxes});
 mobileTools=initMobileUI({state,t,resetImage});
 const decades=[...new Set(data.papers.map(p=>Math.floor(Number(p.year)/10)*10).filter(y=>y>1800))].sort((a,b)=>b-a);for(const y of decades){const o=el('option','',`${y}–${y+9}`);o.value=y;$('#year-filter').append(o)}
 renderHero();
 bind();$('.brand').onclick=e=>{e.preventDefault();setView('map')};$('#show-panel-guide').onclick=()=>$('#panel-evidence').scrollIntoView({behavior:'smooth',block:'start'});$('#explore-plates').onclick=()=>setView('plates');$('#all-literature').onchange=renderPapers;renderMapFeatures();const hash=location.hash.slice(1);if(['map','papers','plates'].includes(hash))state.view=hash;updateLanguage();if(hash.startsWith('figure=')){const params=new URLSearchParams(hash);if(figureById.has(params.get('figure')))openFigure(params.get('figure'),params.get('panel')||'');else{history.replaceState(null,'','#'+state.view);notify(t('此图版已下架或不在当前目录中','This plate is no longer in the published catalog'));}}
 catalogSync=createCatalogSync({currentVersion:()=>data.built_at,signature:()=>catalogSignature(catalogUrl),load:()=>fetchCatalog(catalogUrl,Date.now().toString()),apply:applyFreshCatalog,canApply:()=>!document.hidden&&!researchTools?.isEditing()&&!$('#paper-dialog').open});
 setInterval(()=>catalogSync.check(),10000);window.addEventListener('focus',()=>catalogSync.check(true));document.addEventListener('visibilitychange',()=>{if(!document.hidden)catalogSync.check(true)});
 }catch(error){text($('#collection-count'),t('数据加载失败，请使用启动网站.cmd启动后重试。','Could not load data. Start the local server and retry.'));console.error(error)}
}
init();

function renderHero(){
 const hero=data.figures.find(f=>f.paper_id==='S011'&&f.number==='3')||data.figures.find(f=>f.paper_id==='S011')||data.figures[0];
 $('.hero-plate').hidden=!hero;if(!hero)return;$('#hero-image').src=preview(hero);$('#hero-image').alt=label(hero);$('#hero-open').onclick=()=>openFigure(hero.id);text($('#hero-caption'),hero.paper_id+' · '+label(hero));
}
async function applyFreshCatalog(fresh){
 // Keep the shared objects/maps so the library and detail tools see the update.
 const previousDetail=detail?.id,wasCompare=$('#compare-dialog').open;
 Object.assign(data,fresh);paperByKey.clear();figureById.clear();siteById.clear();
 data.papers.forEach(p=>paperByKey.set(p.key,p));data.figures.forEach(f=>figureById.set(f.id,f));data.sites.forEach(s=>siteById.set(s.id,s));
 for(const f of data.figures){const p=paperByKey.get(f.paper_key);f.searchText=normalized([f.paper_id,f.number,f.title_zh,f.title_en,f.caption_original,f.caption_zh,f.caption_en,p.title_zh,p.title_en,p.citation_original,f.sites.map(id=>siteById.get(id)?.name).join(' '),JSON.stringify(f.panel_annotations||[])].join(' '));}
 for(const id of state.compare)if(!figureById.has(id))state.compare.delete(id);
 if(state.site&&!siteById.has(state.site))state.site=null;
 detail=previousDetail?figureById.get(previousDetail)||null:null;
 if(previousDetail&&!detail){$('#detail-dialog').close();$('#detail-image').removeAttribute('src');}
 if(wasCompare){$('#compare-dialog').close();if(state.compare.size===2)openCompare();}updateCompare();
 await researchTools?.refreshIndex();updateLanguage();
 notify(previousDetail&&!detail?t('此图版已下架，目录已同步更新','This plate was withdrawn; the catalog has been updated'):t('已同步后台发布的最新目录','Published catalog changes are now visible'));
}

function renderMapFeatures(){
 const stats=$('#map-stats');stats.replaceChildren();for(const [n,zh,en] of [[data.sites.filter(s=>s.association_status!=='no_verified_study_link').length,'中国研究地点','China study sites'],[data.figures.length,'收录图版','Plates'],[new Set(data.papers.map(p=>p.id)).size,'题录编号','Reference IDs']]){const unit=el('div');unit.append(el('strong','',n),el('span','',t(zh,en)));stats.append(unit)}
 const rail=$('#map-featured');rail.replaceChildren();for(const sid of ['S282','S011','S177','S226']){const f=data.figures.find(f=>f.paper_id===sid&&/淀粉|starch/i.test(f.caption_original))||data.figures.find(f=>f.paper_id===sid);if(!f)continue;const b=el('button');b.append(makeImage(f,false),el('span','',sid+' / '+t('图','Fig. ')+f.number));b.title=label(f);b.onclick=()=>openFigure(f.id);rail.append(b)}
}
function renderPanelEvidence(){
 const node=$('#panel-evidence');node.replaceChildren();node.append(el('h3','',t('分图释读与正文依据','Panel guide & source evidence')));
 const rows=detail.panel_annotations||[];if(!rows.length)node.append(el('p','',t('尚未建立可核实的分图—类型对应。请结合原文图注与正文，勿仅凭字母推定植物种属。','No verified panel-to-type mapping yet. Panel letters alone do not establish a taxon.')));
 for(const row of rows){const block=el('details','panel-row');const sum=el('summary');sum.append(el('strong','',row.panels));if(row.type_code)sum.append(el('b','type-code',row.type_code));sum.append(el('span','',t(row.interpretation_zh||row.type_code,row.interpretation_en||row.interpretation_zh)));block.append(sum);const alternate=t(row.interpretation_en,row.interpretation_zh);if(alternate)block.append(el('p','',alternate));if(row.uncertainty)block.append(el('p','evidence-status',row.uncertainty));for(const e of row.evidence||[]){block.append(el('small','',`PDF p.${e.page} · ${e.section||'原文'}`),el('blockquote','',e.quote))}node.append(block)}
 const clues=detail.body_evidence||[];if(clues.length){const box=el('details','body-clues'),sum=el('summary','',t('查看原PDF正文线索（尚未等同于分图鉴定）','PDF body passages (not panel identifications)'));box.append(sum);for(const e of clues){box.append(el('small','',`PDF p.${e.page}`),el('blockquote','',e.quote))}node.append(box)}
}
function renderMapSearch(){
 const node=$('#map-search-results');node.replaceChildren();node.hidden=state.view!=='map'||!state.q;if(node.hidden)return;
 node.append(el('div','search-results-heading',t('图版与文献','Plates & literature')));
 for(const f of filtered.slice(0,3)){const b=el('button','map-search-row');b.append(makeImage(f),el('span','',f.paper_id+' / '+label(f)));b.onclick=()=>openFigure(f.id);node.append(b)}
 const tokens=normalized(state.q).split(' ').filter(Boolean),papers=data.papers.filter(p=>tokens.every(q=>normalized([p.id,p.title_zh,p.title_en,p.citation_original].join(' ')).includes(q)));
 for(const p of papers.slice(0,2)){const b=el('button','map-search-row');b.append(el('small','',p.id),el('span','',title(p)));b.onclick=()=>openPaper(p.key);node.append(b)}
 if(!filtered.length&&!papers.length)node.append(el('p','',t('暂无匹配的图版或题录，可在右侧查找遗址。','No matching plates or literature. Try the site index.')));
 const b=el('button','all-results',t(`查看 ${filtered.length} 幅图版 / ${papers.length} 份题录 →`,`See ${filtered.length} plates / ${papers.length} references →`));b.onclick=()=>setView(filtered.length?'plates':'papers');node.append(b);
}
