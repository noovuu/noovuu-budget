/*
 * Noovuu's docked agent workspace.
 *
 * Reuses the existing income/housing/fixed controls and seven-step Budget
 * Builder. The city comparison canvas remains the output surface.
 * No Figma files are modified, and this prototype has no AI backend.
 */
(function(){
  'use strict';

  const main=document.querySelector('main');
  const nav=document.getElementById('noovuu-nav');
  const originalBuilderLink=document.getElementById('noovuu-builder');
  const onboarding=document.getElementById('onboarding');
  const financialPanel=main && main.querySelector(':scope > section.panel');
  const editProfile=document.getElementById('editProfile');
  const cancelWizard=document.getElementById('noovuu-cancel');
  const confirmDialog=document.getElementById('noovuu-confirm');
  if(!main||!nav||!originalBuilderLink||!onboarding||!financialPanel||!cancelWizard)return;
  document.body.classList.add("agent-shell-ready");

  const key='noovuu-agent-sidebar-open-v1';
  const agent=document.createElement('aside');
  agent.id='noovuu-agent';
  agent.setAttribute('aria-label','Noovuu agent and budget controls');
  agent.innerHTML=
   '<div class="agent-header">'+
    '<div class="agent-identity"><small>NOOVUU WORKSPACE</small><strong><span aria-hidden="true">✦</span> Your agent</strong></div>'+
    '<button id="agent-collapse" class="agent-icon-button" type="button" aria-label="Close agent sidebar" title="Close agent sidebar">‹</button>'+
   '</div>'+
   '<div id="agent-scroll">'+
   '<section id="agent-controls" aria-label="Your budget adjustments">'+
    '<div class="agent-section-label"><span>Monthly budget</span><span>Live updates</span></div>'+
   '</section>'+
   '<div id="agent-body">'+
     '<div id="agent-chat" aria-label="Agent conversation">'+
       '<div class="agent-chat-bubble agent-chat-assistant">'+
        '<strong>Plan your life, one city at a time.</strong>'+
        '<p>Adjust your income, housing, and fixed expenses above. The city comparisons update as you make changes.</p>'+
        '<p>This is an interactive agent prototype. Try <code>rent 750</code>, <code>income 8204</code>, or <code>fixed 1000</code>.</p>'+
       '</div>'+
       '<div id="agent-messages" role="log" aria-live="polite" aria-relevant="additions"></div>'+
     '</div>'+
     '<div id="agent-builder-host" aria-label="Budget Builder experience"></div>'+
   '</div>'+
   '</div>'+
   '<div class="agent-bottom">'+
     '<form id="agent-composer" aria-label="Message Noovuu agent">'+
       '<label for="agent-message">Ask Noovuu</label>'+
       '<div class="agent-message-row">'+
         '<textarea id="agent-message" rows="2" maxlength="500" placeholder="Try: set rent to 750" aria-describedby="agent-prototype-note"></textarea>'+
         '<button type="submit" id="agent-send" aria-label="Send budget command" title="Send budget command">↑</button>'+
       '</div>'+
     '</form>'+
     '<div class="agent-actions">'+
       '<button type="button" id="agent-tool-builder" aria-controls="agent-builder-host" aria-pressed="false">'+
         '<span class="agent-tool-icon" aria-hidden="true">$</span><span>Budget Builder</span>'+
       '</button>'+
       '<span id="agent-prototype-note">Prototype · Budget commands only</span>'+
     '</div>'+
   '</div>';
  main.before(agent);

  // These are the SAME real form controls; we move them rather than clone them.
  // Their original event listeners, range/value IDs, and local storage survive.
  agent.querySelector('#agent-controls').appendChild(financialPanel);
  agent.querySelector('#agent-builder-host').appendChild(onboarding);

  // Reuse all four existing, fully wired input panels. Only regroup them.
  // The budget defaults to a SINGLE income control. The other three real
  // controls live under one chevron-operated region, not separate cards.
  const inputs=financialPanel.querySelector('.inputs');
  if(!inputs||inputs.children.length<4)throw new Error('Missing budget controls');
  const extra=document.createElement('div');
  extra.id='agent-budget-extra';
  extra.hidden=true;
  extra.setAttribute('aria-label','Additional budget settings');
  while(inputs.children.length>1)extra.appendChild(inputs.children[1]);
  inputs.appendChild(extra);
  const heading=agent.querySelector('.agent-section-label');
  financialPanel.insertBefore(heading,inputs);
  const expand=document.createElement('button');
  expand.id='agent-budget-expand';
  expand.type='button';
  expand.setAttribute('aria-controls','agent-budget-extra');
  expand.setAttribute('aria-expanded','false');
  expand.setAttribute('aria-label','Show all monthly budget settings');
  expand.innerHTML='<span class="budget-chevron" aria-hidden="true"></span>';
  heading.appendChild(expand);
  function setBudgetExpanded(open){
    const expanded=Boolean(open);
    if(!expanded&&extra.contains(document.activeElement))expand.focus({preventScroll:true});
    extra.hidden=!expanded;
    financialPanel.classList.toggle('agent-budget-expanded',expanded);
    expand.setAttribute('aria-expanded',String(expanded));
    expand.setAttribute('aria-label',expanded?'Collapse monthly budget settings':'Show all monthly budget settings');
    expand.title=expanded?'Collapse budget settings':'Expand budget settings';
  }
  expand.addEventListener('click',()=>setBudgetExpanded(extra.hidden));
  setBudgetExpanded(false);

  // The builder is now an ordinary region in a docked sidebar, not a modal.
  onboarding.setAttribute('role','region');
  onboarding.removeAttribute('aria-modal');
  const composer=agent.querySelector('#agent-composer');
  const message=agent.querySelector('#agent-message');
  const messages=agent.querySelector('#agent-messages');
  const tool=agent.querySelector('#agent-tool-builder');
  const collapse=agent.querySelector('#agent-collapse');

  let pendingCollapse=false;
  let panelOpen=true;
  try{
    // Explicitly closed panels remain closed after reload; first-time default is open.
    panelOpen=localStorage.getItem(key)!=='closed';
  }catch(e){panelOpen=true;}
  if(location.hash==='#budget-builder')panelOpen=true;

  function builderOpen(){
    return onboarding.getAttribute('aria-hidden')==='false';
  }
  function setPanelOpen(next,focus){
    panelOpen=!!next;
    document.body.classList.toggle('agent-sidebar-open',panelOpen);
    agent.setAttribute('aria-hidden',String(!panelOpen));
    agent.inert=!panelOpen;
    originalBuilderLink.setAttribute('aria-expanded',String(panelOpen));
    originalBuilderLink.setAttribute('aria-pressed',String(panelOpen));
    try{localStorage.setItem(key,panelOpen?'open':'closed');}catch(e){}
    // Re-measure in-app maps after the canvas width changes.
    window.dispatchEvent(new Event('resize'));
    if(focus){
      if(panelOpen)message.focus({preventScroll:true});
      else originalBuilderLink.focus({preventScroll:true});
    }
  }
  function syncBuilderMode(){
    const open=builderOpen();
    agent.classList.toggle('agent-builder-active',open);
    tool.setAttribute('aria-pressed',String(open));
    tool.querySelector('span:last-child').textContent=open?'Close Budget Builder':'Budget Builder';
    // Do not hide the canvas or block keyboard focus when a docked region is active.
    if(pendingCollapse&&!open){
      pendingCollapse=false;
      setPanelOpen(false,true);
    }
  }
  function requestClosePanel(){
    if(builderOpen()){
      pendingCollapse=true;
      // Existing cancel logic enforces confirmation if the form has been edited.
      cancelWizard.click();
      if(!builderOpen())syncBuilderMode();
    }else setPanelOpen(false,true);
  }
  function openPanel(){
    pendingCollapse=false;
    setPanelOpen(true,true);
  }
  function togglePanel(){
    if(panelOpen)requestClosePanel();
    else openPanel();
  }
  function openBuilder(){
    if(!panelOpen)setPanelOpen(true,false);
    if(!builderOpen()){
      // Reuse original openDrawer(), wizard profile, and discard semantics.
      editProfile.click();
    }
    syncBuilderMode();
  }
  function toggleBuilder(){
    if(builderOpen()){
      cancelWizard.click();
      syncBuilderMode();
    }else openBuilder();
  }

  // Original first-run onboarding opens as a modal during legacy initialization.
  // Switch to the docked agent's conversation view unless a builder deep link
  // was explicitly requested. No saved user data is discarded.
  if(builderOpen()&&location.hash!=='#budget-builder'){
    cancelWizard.click();
  }
  const builderObserver=new MutationObserver(syncBuilderMode);
  builderObserver.observe(onboarding,{attributes:true,attributeFilter:['aria-hidden']});
  syncBuilderMode();
  setPanelOpen(panelOpen,false);

  originalBuilderLink.textContent='✦ Agent';
  originalBuilderLink.setAttribute('aria-controls','noovuu-agent');
  originalBuilderLink.setAttribute('aria-label','Toggle agent sidebar');
  originalBuilderLink.setAttribute('role','button');
  // Intercept old "open Budget Builder overlay" navigation action and use the
  // same button as a panel toggle instead. The internal tool opens the builder.
  originalBuilderLink.addEventListener('click',function(event){
    event.preventDefault();
    event.stopImmediatePropagation();
    togglePanel();
  },true);
  originalBuilderLink.addEventListener('keydown',function(e){
    if(e.key===' '){e.preventDefault();togglePanel();}
  },true);
  collapse.addEventListener('click',requestClosePanel);
  // A map or chart inside the canvas must measure its new width after reflow.
  agent.addEventListener('transitionend',function(e){
    if(e.propertyName==='transform')window.dispatchEvent(new Event('resize'));
  });
  tool.addEventListener('click',toggleBuilder);

  // The canvas' Edit lifestyle profile link should open the agent and the
  // existing builder when the sidebar was collapsed.
  editProfile.addEventListener('click',function(){
    if(!panelOpen)setPanelOpen(true,false);
  },true);

  // The old modal-specific Tab trap is inappropriate in a nonmodal workspace.
  // Preserve the real discard-confirmation dialog's keyboard trap.
  document.addEventListener('keydown',function(e){
    if(e.key==='Tab'&&builderOpen()&&confirmDialog&&confirmDialog.hidden){
      e.stopPropagation();
    }
    if(e.key==='Escape'&&confirmDialog&&!confirmDialog.hidden){
      pendingCollapse=false;
    }
  },true);
  confirmDialog?.querySelector('#noovuu-keep')?.addEventListener('click',function(){
    pendingCollapse=false;
  });

  // Honest deterministic command support while the conversational AI is
  // unconnected; never claim to have called an AI service.
  function appendMessage(text,isUser){
    const bubble=document.createElement('div');
    bubble.className='agent-chat-bubble '+(isUser?'agent-chat-user':'agent-chat-assistant');
    const p=document.createElement('p');
    p.textContent=text;
    bubble.appendChild(p);
    messages.appendChild(bubble);
    // One unified scroll zone for budget, builder and conversation.
    const scroll=agent.querySelector('#agent-scroll');
    if(scroll)scroll.scrollTop=scroll.scrollHeight;
  }
  function amountFrom(text){
    const match=text.match(/^\s*(?:(?:set|change|update|make)\s+(?:my\s+)?)?(income|salary|pay|take.home|rent|housing|fixed(?:\s+(?:expenses|costs))?)\s*(?:to|at|=|:)?\s*(?:C\$|US\$|MX\$|\$)?\s*([\d,]+(?:\.\d{1,2})?)\s*$/i);
    if(!match)return null;
    const category=/income|salary|pay|take.home/i.test(match[1])?'income':/rent|housing/i.test(match[1])?'rent':'fixed';
    const value=Number(match[2].replace(/,/g,''));
    return Number.isFinite(value)&&value>=0&&value<=1000000?{category,value}:null;
  }
  composer.addEventListener('submit',function(e){
    e.preventDefault();
    const text=message.value.trim();
    if(!text)return;
    appendMessage(text,true);
    message.value='';
    const parsed=amountFrom(text);
    if(!parsed){
      appendMessage('This prototype can adjust your budget using commands such as “income 8204”, “rent 750”, or “fixed 1000”. Full AI conversation is not connected yet.',false);
      return;
    }
    const editor=document.getElementById(parsed.category+'Value');
    if(!editor)return;
    editor.value=String(parsed.value);
    editor.dispatchEvent(new Event('input',{bubbles:true}));
    editor.blur();
    const label=parsed.category==='income'?'Income':parsed.category==='rent'?'Housing budget':'Fixed monthly expenses';
    appendMessage(label+' updated to '+editor.value+'. Your city comparison has been recalculated.',false);
  });
  message.addEventListener('keydown',function(e){
    if(e.key==='Enter'&&!e.shiftKey){
      e.preventDefault();
      composer.requestSubmit();
    }
  });

  // Legacy nav state was designed for full-screen wizard navigation, whereas
  // the agent sidebar stays in the same page while its internal tool changes.
  const navObserver=new MutationObserver(function(){
    originalBuilderLink.removeAttribute('aria-current');
  });
  navObserver.observe(originalBuilderLink,{attributes:true,attributeFilter:['aria-current']});
  originalBuilderLink.removeAttribute('aria-current');
})();
