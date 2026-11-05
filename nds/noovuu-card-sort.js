/* Noovuu: persistent ordering of horizontal city comparison cards.
 * Mouse, touch and pen use Pointer Events on the 6-dot grip; keyboard
 * arrows and the four-dot More menu provide accessible alternatives.
 * Neither Figma source file is ever modified. */
(function(){
  'use strict';
  const strip=document.getElementById('cards');
  if(!strip||typeof render!=='function'||typeof state==='undefined'||!Array.isArray(state.shown))return;

  const motion=()=>!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const announcer=document.createElement('div');
  announcer.className='city-sort-announcer';
  announcer.setAttribute('role','status');
  announcer.setAttribute('aria-live','polite');
  announcer.setAttribute('aria-atomic','true');
  strip.after(announcer);

  const cards=()=>Array.from(strip.querySelectorAll(':scope > article.city[data-city-key]'));
  const cardFor=city=>cards().find(card=>card.dataset.cityKey===city);
  const say=message=>{announcer.textContent=message;};
  let active=null,autoScrollFrame=0,settleTimer=0;
  const animations=new WeakMap();

  function focusHandle(city){
    const card=cardFor(city);
    const grip=card?.querySelector('.city-drag-handle');
    grip?.focus({preventScroll:true});
    card?.scrollIntoView?.({block:'nearest',inline:'nearest',behavior:motion()?'smooth':'auto'});
  }
  function closeMenus(returnFocus){
    strip.querySelectorAll('.city-card-menu:not([hidden])').forEach(menu=>{
      menu.hidden=true;
      const toggle=menu.parentElement?.querySelector('.city-card-more');
      toggle?.setAttribute('aria-expanded','false');
      if(returnFocus&&menu.contains(document.activeElement))toggle?.focus({preventScroll:true});
    });
  }
  function moveCity(city,desiredIndex,focus=true){
    const before=state.shown.indexOf(city);
    if(before<0)return false;
    const index=Math.max(0,Math.min(state.shown.length-1,desiredIndex));
    if(before===index)return false;
    state.shown.splice(before,1);
    state.shown.splice(index,0,city);
    render(); // render() saves state.shown and refreshes BOTH Quick/Advanced.
    say(city+' moved to position '+(index+1)+' of '+state.shown.length+'.');
    if(focus)focusHandle(city);
    return true;
  }
  function removeCity(city){
    if(!state.shown.includes(city))return;
    state.shown=state.shown.filter(name=>name!==city);
    render();
    say(city+' removed from comparison. '+state.shown.length+' cities selected.');
    document.getElementById('add')?.focus({preventScroll:true});
  }

  strip.addEventListener('click',event=>{
    const more=event.target.closest('button[data-city-more]');
    if(more){
      event.preventDefault();
      const menu=more.parentElement?.querySelector('.city-card-menu');
      if(!menu)return;
      const wasOpen=!menu.hidden;
      closeMenus(false);
      menu.hidden=wasOpen;
      more.setAttribute('aria-expanded',String(!wasOpen));
      if(!wasOpen)menu.querySelector('button:not([disabled])')?.focus({preventScroll:true});
      return;
    }
    const move=event.target.closest('button[data-city-move]');
    if(move){
      const city=move.dataset.cityKey;
      const amount=Number(move.dataset.cityMove);
      closeMenus(false);
      moveCity(city,state.shown.indexOf(city)+amount);
      return;
    }
    const remove=event.target.closest('button[data-city-remove]');
    if(remove){
      const city=remove.dataset.cityRemove;
      closeMenus(false);
      removeCity(city);
      return;
    }
  });
  document.addEventListener('pointerdown',event=>{
    if(!event.target.closest('.city-menu-anchor'))closeMenus(false);
  });
  strip.addEventListener('keydown',event=>{
    const grip=event.target.closest('button[data-city-drag]');
    if(grip&&['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){
      event.preventDefault();
      const city=grip.dataset.cityDrag,index=state.shown.indexOf(city);
      const next=event.key==='Home'?0:event.key==='End'?state.shown.length-1:
        index+(event.key==='ArrowLeft'?-1:1);
      moveCity(city,next);
      return;
    }
    if(event.key==='Escape'){
      if(active?.started){
        event.preventDefault();
        finishDrag(false);
      }else if(strip.querySelector('.city-card-menu:not([hidden])')){
        event.preventDefault();
        closeMenus(true);
      }
    }
    if(event.key==='ArrowDown'&&event.target.matches('.city-card-more')){
      event.preventDefault();
      event.target.click();
    }
  });

  function previewAt(p,x,y){
    if(!p.preview)return;
    p.preview.style.transform='translate3d('+(x-p.startX)+'px,'+(y-p.startY)+'px,0)';
  }
  function beginDrag(p){
    if(p.started||!p.card.isConnected)return;
    closeMenus(false);
    p.started=true;
    const rect=p.card.getBoundingClientRect();
    p.originalRect=rect;
    const copy=p.card.cloneNode(true);
    copy.removeAttribute('data-city-key');
    copy.setAttribute('aria-hidden','true');
    copy.querySelectorAll('[id]').forEach(node=>node.removeAttribute('id'));
    copy.querySelectorAll('a,button,input,select,textarea').forEach(node=>{
      node.setAttribute('tabindex','-1');
      node.setAttribute('aria-hidden','true');
      if(node.matches('input,select,textarea'))node.disabled=true;
    });
    copy.classList.add('city-drag-preview');
    copy.classList.remove('city-drop-slot');
    copy.style.left=rect.left+'px';
    copy.style.top=rect.top+'px';
    copy.style.width=rect.width+'px';
    copy.style.height=Math.min(rect.height,Math.max(180,window.innerHeight-70))+'px';
    copy.style.margin='0';
    copy.style.padding=getComputedStyle(p.card).padding;
    document.body.appendChild(copy);
    p.preview=copy;
    p.card.classList.add('city-drop-slot');
    strip.classList.add('city-sort-active');
    document.body.classList.add('city-sorting');
    say('Moving '+p.city+'. Drop into the highlighted position.');
    previewAt(p,p.lastX,p.lastY);
  }

  function slideOtherCards(before){
    if(!motion())return;
    cards().forEach(card=>{
      if(card===active?.card)return;
      const was=before.get(card);
      if(was===undefined)return;
      const now=card.getBoundingClientRect().left;
      const delta=was-now;
      if(Math.abs(delta)<1||typeof card.animate!=='function')return;
      animations.get(card)?.cancel();
      const animation=card.animate([
        {transform:'translate3d('+delta+'px,0,0)'},
        {transform:'translate3d(0,0,0)'}
      ],{duration:230,easing:'cubic-bezier(.22,1,.36,1)'});
      animations.set(card,animation);
    });
  }
  function repositionSlot(x){
    const p=active;
    if(!p?.started||!p.card.isConnected)return;
    const list=cards(),others=list.filter(card=>card!==p.card);
    // Compare against LOGICAL grid positions, not getBoundingClientRect()
    // while FLIP animation is temporarily translating adjacent cards.
    // This prevents the target from jittering back and forth mid-animation.
    const stripRect=strip.getBoundingClientRect();
    const css=getComputedStyle(strip);
    const gap=parseFloat(css.columnGap)||20;
    const leftPad=parseFloat(css.paddingLeft)||0;
    const width=list[0]?.offsetWidth||list[0]?.getBoundingClientRect().width||320;
    const origin=stripRect.left+strip.clientLeft+leftPad-strip.scrollLeft;
    const before=others.find(card=>{
      const logicalIndex=list.indexOf(card);
      return x<origin+logicalIndex*(width+gap)+width/2;
    });
    if(before?p.card.nextElementSibling===before:p.card===strip.lastElementChild)return;
    const oldRects=new Map(others.map(card=>[card,card.getBoundingClientRect().left]));
    if(before)strip.insertBefore(p.card,before);
    else strip.appendChild(p.card);
    slideOtherCards(oldRects);
  }
  function autoScroll(){
    autoScrollFrame=0;
    const p=active;
    if(!p?.started||!p.card.isConnected)return;
    const bounds=strip.getBoundingClientRect();
    const edge=62;
    let step=0;
    if(p.lastY>=bounds.top&&p.lastY<=bounds.bottom){
      if(p.lastX<bounds.left+edge){
        step=-Math.min(24,Math.max(0,(bounds.left+edge-p.lastX)*.32));
      }else if(p.lastX>bounds.right-edge){
        step=Math.min(24,Math.max(0,(p.lastX-(bounds.right-edge))*.32));
      }
    }
    if(step){
      const previous=strip.scrollLeft;
      strip.scrollLeft+=step;
      if(Math.abs(strip.scrollLeft-previous)>.5)repositionSlot(p.lastX);
    }
    autoScrollFrame=requestAnimationFrame(autoScroll);
  }
  function stopScroll(){
    if(autoScrollFrame)cancelAnimationFrame(autoScrollFrame);
    autoScrollFrame=0;
  }
  function cleanup(p){
    stopScroll();
    if(settleTimer)clearTimeout(settleTimer);
    settleTimer=0;
    p.preview?.remove();
    p.card?.classList.remove('city-drop-slot');
    strip.classList.remove('city-sort-active');
    document.body.classList.remove('city-sorting');
    p.preview=null;
  }
  function restoreOriginal(p){
    const byCity=new Map(cards().map(card=>[card.dataset.cityKey,card]));
    p.originalOrder.forEach(city=>{
      const card=byCity.get(city);
      if(card)strip.appendChild(card);
    });
  }
  function finishDrag(commit){
    const p=active;
    if(!p)return;
    active=null;
    stopScroll();
    try{
      if(strip.hasPointerCapture?.(p.pointerId))strip.releasePointerCapture(p.pointerId);
    }catch{}
    if(!p.started){cleanup(p);return;}
    if(!commit){
      restoreOriginal(p);
      cleanup(p);
      say('Card movement cancelled.');
      return;
    }
    const order=cards().map(card=>card.dataset.cityKey);
    if(order.join('\u0000')===p.originalOrder.join('\u0000')){
      cleanup(p);
      say(p.city+' remains in its original position.');
      return;
    }
    // Commit immediately (also for persistence if another render happens
    // during the short lift-and-settle animation).
    state.shown=order;
    save();
    const target=p.card.getBoundingClientRect();
    const preview=p.preview;
    if(preview&&motion()){
      preview.style.transition='transform 170ms cubic-bezier(.22,1,.36,1),opacity 170ms ease';
      preview.style.transform='translate3d('+(target.left-p.originalRect.left)+'px,'+
        (target.top-p.originalRect.top)+'px,0)';
      preview.style.opacity='.25';
      settleTimer=window.setTimeout(()=>{
        cleanup(p);
        render();
        say(p.city+' moved to position '+(order.indexOf(p.city)+1)+' of '+order.length+'.');
        focusHandle(p.city);
      },175);
    }else{
      cleanup(p);
      render();
      say(p.city+' moved to position '+(order.indexOf(p.city)+1)+' of '+order.length+'.');
      focusHandle(p.city);
    }
  }

  strip.addEventListener('pointerdown',event=>{
    const handle=event.target.closest('button[data-city-drag]');
    if(!handle||active||settleTimer||event.button!==0||event.isPrimary===false)return;
    const card=handle.closest('article.city[data-city-key]');
    if(!card)return;
    const city=card.dataset.cityKey;
    active={
      city,card,pointerId:event.pointerId,started:false,
      originalOrder:[...state.shown],startX:event.clientX,startY:event.clientY,
      lastX:event.clientX,lastY:event.clientY,preview:null,originalRect:null
    };
    try{strip.setPointerCapture?.(event.pointerId);}catch{}
    event.preventDefault();
  });
  window.addEventListener('pointermove',event=>{
    const p=active;
    if(!p||event.pointerId!==p.pointerId)return;
    p.lastX=event.clientX;
    p.lastY=event.clientY;
    if(!p.started&&Math.hypot(event.clientX-p.startX,event.clientY-p.startY)>=7){
      beginDrag(p);
      if(p.started)autoScrollFrame=requestAnimationFrame(autoScroll);
    }
    if(p.started){
      event.preventDefault();
      previewAt(p,event.clientX,event.clientY);
      repositionSlot(event.clientX);
    }
  },{passive:false});
  window.addEventListener('pointerup',event=>{
    if(active&&event.pointerId===active.pointerId)finishDrag(true);
  });
  window.addEventListener('pointercancel',event=>{
    if(active&&event.pointerId===active.pointerId)finishDrag(false);
  });
  window.addEventListener('blur',()=>{if(active)finishDrag(false);});

  // Existing budget, FX and Resources changes rebuild city card DOM. Never
  // leave an orphan floating preview or stale grip pointer capture.
  const priorRender=render;
  render=function(){
    if(active){
      const p=active;active=null;
      cleanup(p);
    }
    return priorRender();
  };
})();
