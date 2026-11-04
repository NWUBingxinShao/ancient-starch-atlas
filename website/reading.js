/* Browser-local reading preferences. No server or database writes. */
(() => {
 const root=document.documentElement,levels=[90,100,115,130,150];
 let value=100,dialog,trigger;
 try{const saved=Number(localStorage.getItem('atlas-font-percent'));if(levels.includes(saved))value=saved;}catch{}
 function apply(next,persist=false){
  value=next;root.style.setProperty('--atlas-font-scale',String(value/100));root.dataset.fontPercent=String(value);
  if(persist)try{localStorage.setItem('atlas-font-percent',String(value));}catch{}
  render();window.dispatchEvent(new Event('resize'));window.dispatchEvent(new CustomEvent('atlas-font-change',{detail:{percent:value}}));
 }
 function render(){
  if(!dialog)return;const en=root.lang==='en';
  trigger.setAttribute('aria-label',en?'Text size':'调整字号');trigger.title=en?'Text size':'调整字号';
  dialog.querySelector('h2').textContent=en?'Comfortable reading':'调整阅读字号';
  dialog.querySelector('p').textContent=en?'Applies to this website. Saved in this browser; original images stay unchanged.':'调整全站文字大小；此浏览器会记住设置，图版原图保持不变。';
  dialog.querySelector('.reading-close').setAttribute('aria-label',en?'Close text settings':'关闭字号设置');
  dialog.querySelector('output').textContent=value+'%';
  for(const b of dialog.querySelectorAll('[data-percent]'))b.setAttribute('aria-pressed',String(Number(b.dataset.percent)===value));
  dialog.querySelector('[data-step="-1"]').disabled=value===levels[0];dialog.querySelector('[data-step="1"]').disabled=value===levels.at(-1);
  dialog.querySelector('[data-reset]').textContent=en?'Restore default':'恢复默认';
 }
 apply(value);
 document.addEventListener('DOMContentLoaded',()=>{
  trigger=document.createElement('button');trigger.type='button';trigger.id='reading-toggle';trigger.className='reading-toggle';trigger.textContent='Aa';trigger.setAttribute('aria-haspopup','dialog');
  document.querySelector('.header-actions').prepend(trigger);
  dialog=document.createElement('dialog');dialog.id='reading-dialog';dialog.className='reading-dialog';dialog.setAttribute('aria-labelledby','reading-title');
  dialog.innerHTML='<button type="button" class="reading-close">×</button><h2 id="reading-title"></h2><p></p><div class="reading-step"><button type="button" data-step="-1" aria-label="缩小字号 / Smaller text">A−</button><output aria-live="polite"></output><button type="button" data-step="1" aria-label="放大字号 / Larger text">A＋</button></div><div class="reading-presets" aria-label="字号比例 / Text size">'+levels.map(n=>`<button type="button" data-percent="${n}">${n}%</button>`).join('')+'</div><button type="button" data-reset></button>';
  document.body.append(dialog);trigger.onclick=()=>{render();dialog.showModal();};
  dialog.querySelector('.reading-close').onclick=()=>dialog.close();
  dialog.onclick=e=>{const b=e.target.closest('button');if(!b)return;
   if(b.hasAttribute('data-percent'))apply(Number(b.dataset.percent),true);
   if(b.hasAttribute('data-step'))apply(levels[Math.max(0,Math.min(levels.length-1,levels.indexOf(value)+Number(b.dataset.step)))],true);
   if(b.hasAttribute('data-reset'))apply(100,true);
  };
  new MutationObserver(render).observe(root,{attributes:true,attributeFilter:['lang']});
  window.addEventListener('storage',e=>{if(e.key==='atlas-font-percent')apply(levels.includes(Number(e.newValue))?Number(e.newValue):100);});render();
 });
})();
