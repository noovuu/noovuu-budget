/* Noovuu city comparison: horizontal price-comparison strip with 4–8
   selected cities, full-width cards, drag-free touch scrolling and arrows.
   The canvas stays centered within the remaining workspace. */
(function(){
  'use strict';
  const strip=document.getElementById('cards');
  const previous=document.getElementById('compare-prev');
  const next=document.getElementById('compare-next');
  const position=document.getElementById('compare-position');
  if(!strip||!previous||!next||!position||typeof render!=='function')return;
  strip.tabIndex=0;
  strip.setAttribute('aria-label','City price comparison. Scroll horizontally or use the Previous city and Next city buttons.');

  function metrics(){
    const cards=Array.from(strip.querySelectorAll(':scope > .city'));
    const width=cards.length>1 ? cards[1].offsetLeft-cards[0].offsetLeft :
      cards.length ? cards[0].getBoundingClientRect().width : 0;
    const step=Math.max(1,width||360);
    const count=cards.length;
    const start=count?Math.min(count,Math.floor((strip.scrollLeft+4)/step)+1):0;
    const visible=Math.max(1,Math.floor((strip.clientWidth+20)/step));
    const end=Math.min(count,start+visible-1);
    return {step,count,start,end};
  }
  function updateButtons(){
    const m=metrics();
    const max=Math.max(0,strip.scrollWidth-strip.clientWidth);
    previous.disabled=strip.scrollLeft<2;
    next.disabled=strip.scrollLeft>=max-2;
    position.textContent=m.count ? 'Cities '+m.start+'–'+m.end+' of '+m.count : 'No cities';
    previous.setAttribute('aria-label','Previous city, currently showing '+position.textContent);
    next.setAttribute('aria-label','Next city, currently showing '+position.textContent);
  }
  function move(direction){
    strip.scrollBy({left:direction*metrics().step,behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'});
  }
  previous.addEventListener('click',()=>move(-1));
  next.addEventListener('click',()=>move(1));
  strip.addEventListener('scroll',updateButtons,{passive:true});
  strip.addEventListener('keydown',e=>{
    if(e.target!==strip||!['ArrowLeft','ArrowRight'].includes(e.key))return;
    e.preventDefault();
    move(e.key==='ArrowLeft'?-1:1);
  });
  strip.addEventListener('wheel',e=>{
    if(!e.shiftKey||Math.abs(e.deltaY)<Math.abs(e.deltaX))return;
    if(strip.scrollWidth<=strip.clientWidth+2)return;
    e.preventDefault();
    strip.scrollLeft+=e.deltaY;
  },{passive:false});
  if(typeof ResizeObserver!=='undefined'){
    const observer=new ResizeObserver(updateButtons);
    observer.observe(strip);
  }
  const previousRender=render;
  render=function(){
    const remembered=strip.scrollLeft;
    previousRender();
    // Card DOM is recreated by existing budget/render code; retain position.
    strip.scrollLeft=remembered;
    updateButtons();
  };
  window.addEventListener('resize',updateButtons,{passive:true});
  updateButtons();
})();
