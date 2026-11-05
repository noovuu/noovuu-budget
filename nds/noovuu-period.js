/* Noovuu / per-city stay duration controls.
   Figma NDS Button/Outline splitButton sm is implemented by the rendered
   markup; this file wires menu, numerical quantity, and financial live edits.
   Monthly inputs remain untouched. Periods are city-specific view choices. */
(function(){
  'use strict';
  const root=document.getElementById('cards');
  if(!root||typeof state==='undefined'||!state.periods)return;
  let openCity=null;

  function controlFor(city){
    return [...root.querySelectorAll('.city-period-control')].find(x=>x.dataset.periodCity===city);
  }
  function close(restoreFocus=false){
    if(!openCity)return;
    const control=controlFor(openCity);
    const menu=control?.querySelector('[data-period-popover]');
    if(menu)menu.hidden=true;
    const caret=control?.querySelector('.nds-period-chevron');
    if(caret)caret.setAttribute('aria-expanded','false');
    if(restoreFocus&&control?.contains(document.activeElement)){
      caret?.focus({preventScroll:true});
    }
    openCity=null;
  }
  function open(city,focusNumber=false){
    const control=controlFor(city);
    if(!control)return;
    close(false);
    const popover=control.querySelector('[data-period-popover]');
    if(!popover)return;
    popover.hidden=false;
    control.querySelector('.nds-period-chevron')?.setAttribute('aria-expanded','true');
    openCity=city;
    const target=focusNumber&&stayPeriod(city).unit!=='month'
      ?popover.querySelector('input[data-period-count]')
      :popover.querySelector('button[data-period-unit][aria-pressed="true"]');
    (target||popover.querySelector('button[data-period-unit]'))?.focus({preventScroll:true});
  }
  function normalizeCount(unit,count){
    const max=unit==='weeks'?52:365;
    const raw=Number(count);
    if(!Number.isFinite(raw)||raw<1)return null;
    return Math.min(max,Math.max(1,Math.round(raw)));
  }
  function updateVisible(city,preserveInput=false){
    const control=controlFor(city);
    const card=control?.closest('.city');
    if(!control||!card)return;
    const data=stayPeriod(city);
    const label=stayLabel(city);
    const leading=control.querySelector('.nds-period-label');
    if(leading)leading.textContent=label;
    const heading=card.querySelector('.city-kpis');
    if(heading)heading.setAttribute('aria-label','Financial summary for '+city+', '+label);
    const qty=control.querySelector('.nds-period-quantity');
    const field=control.querySelector('input[data-period-count]');
    if(qty){
      qty.hidden=data.unit==='month';
      const text=qty.firstChild;
      if(text&&text.nodeType===3)text.textContent='Number of '+(data.unit==='weeks'?'weeks':'days');
    }
    if(field){
      field.min='1';
      field.max=String(data.unit==='weeks'?52:365);
      field.setAttribute('aria-label','Number of '+(data.unit==='weeks'?'weeks':'days'));
      if(!preserveInput||document.activeElement!==field)field.value=String(data.count);
      field.removeAttribute('aria-invalid');
    }
    control.querySelectorAll('button[data-period-unit]').forEach(b=>{
      b.setAttribute('aria-pressed',String(b.dataset.periodUnit===data.unit));
    });
    const note=card.querySelector('.stay-assumption');
    if(note)note.hidden=data.unit==='month';
    // The existing per-card refresh updates both KPI values, FX, meter,
    // pastel retention risk and annual summary (annual still monthly-based).
    if(typeof refreshAccommodationFinancials==='function')refreshAccommodationFinancials(city);
  }
  function setPeriod(city,unit,amount,keepField=false){
    if(!Object.hasOwn(state.prices,city)||!['month','days','weeks'].includes(unit))return false;
    const count=unit==='month'?1:normalizeCount(unit,amount);
    if(count===null)return false;
    state.periods[city]={unit,count};
    save();
    updateVisible(city,keepField);
    return true;
  }
  function quantityFrom(field){
    const trimmed=String(field.value).trim();
    const num=Number(trimmed);
    if(!/^[0-9]+$/.test(trimmed)||!Number.isInteger(num))return null;
    const max=Number(field.max)||365;
    if(num<1||num>max)return null;
    return num;
  }
  function setFromField(field,normalize=false){
    const control=field.closest('.city-period-control');
    if(!control)return false;
    const count=quantityFrom(field);
    if(count===null){
      field.setAttribute('aria-invalid','true');
      return false;
    }
    field.removeAttribute('aria-invalid');
    const city=control.dataset.periodCity;
    if(!setPeriod(city,stayPeriod(city).unit,count,true))return false;
    if(normalize)field.value=String(count);
    return true;
  }

  root.addEventListener('click',event=>{
    const opener=event.target.closest('button[data-period-open]');
    if(opener){
      event.preventDefault();
      const city=opener.dataset.periodOpen;
      if(openCity===city){close(true);}else{open(city);}
      return;
    }
    const option=event.target.closest('button[data-period-unit]');
    if(option){
      event.preventDefault();
      const control=option.closest('.city-period-control');
      if(!control)return;
      const city=control.dataset.periodCity;
      const previous=stayPeriod(city),unit=option.dataset.periodUnit;
      const count=unit==='month'?1:unit===previous.unit?previous.count:
        unit==='days'?(previous.unit==='weeks'?previous.count*7:14):
        (previous.unit==='days'?Math.max(1,Math.round(previous.count/7)):2);
      if(setPeriod(city,unit,count))open(city,unit!=='month');
      return;
    }
    const done=event.target.closest('button[data-period-done]');
    if(done){
      event.preventDefault();
      const input=done.closest('.city-period-control')?.querySelector('input[data-period-count]');
      if(input&&!input.closest('.nds-period-quantity')?.hidden&&!setFromField(input,true)){
        input.focus({preventScroll:true});return;
      }
      close(true);
      return;
    }
  });
  root.addEventListener('input',event=>{
    const field=event.target.closest('input[data-period-count]');
    if(field)setFromField(field,false); // live, without remounting the input
  });
  root.addEventListener('change',event=>{
    const field=event.target.closest('input[data-period-count]');
    if(field)setFromField(field,true);
  });
  root.addEventListener('keydown',event=>{
    const field=event.target.closest('input[data-period-count]');
    if(field&&event.key==='Enter'){
      event.preventDefault();
      if(setFromField(field,true))close(true);
      return;
    }
    if(event.key==='Escape'&&openCity){
      event.preventDefault();
      close(true);
    }
  });
  document.addEventListener('pointerdown',event=>{
    if(openCity&&!event.target.closest('.city-period-control'))close(false);
  });

  // Re-render happens for global salary, FX, agent changes, scrolling
  // and switching Default/Advanced. Source of truth is state.periods,
  // not open popover DOM, so each rerender restores the period value.
})();
