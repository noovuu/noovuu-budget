/* Noovuu Advanced View: budget/resources and per-city planning locations.
 * Prototype: no invented businesses, distances, travel times or property locations.
 * Figma is read-only. Addresses are stored locally in this browser.
 */
(function(){
  'use strict';

  const key='noovuu-planning-locations-v1';
  const categories=[
    ['groceries','Groceries','supermarkets and grocery stores'],
    ['cafes','Cafés','cafes and coffee shops'],
    ['restaurants','Restaurants','restaurants'],
    ['fitness','Fitness','gyms and fitness centres'],
    ['mobile','Mobile & internet','mobile phone stores and internet providers'],
    ['essentials','Essentials','pharmacies and laundry services']
  ];
  // Approximate city centres are map examples, NEVER suggested property addresses.
  const centres={
    'Barranquilla':[10.9639,-74.7964,'Barranquilla, Colombia'],
    'Quito':[-0.1807,-78.4678,'Quito, Ecuador'],
    'Medellín':[6.2442,-75.5812,'Medellín, Antioquia, Colombia'],
    'Mexico City':[19.4326,-99.1332,'Mexico City, Mexico'],
    'Córdoba':[18.8850,-96.9326,'Córdoba, Veracruz, Mexico'],
    'Bucaramanga':[7.1193,-73.1227,'Bucaramanga, Santander, Colombia'],
    'Arequipa':[-16.4090,-71.5375,'Arequipa, Peru'],
    'Cuenca':[-2.9001,-79.0059,'Cuenca, Ecuador']
  };
  const locations={};
  let activeTab='budget';
  try{
    const data=JSON.parse(localStorage.getItem(key)||'{}');
    if(data && typeof data==='object'){
      for(const city of Object.keys(centres)){
        if(typeof data[city]==='string' && data[city].length<501)locations[city]=data[city];
      }
    }
  }catch(e){ /* Storage can be restricted; the fields still work for this session. */ }

  const tabs=document.getElementById('advanced-tabs');
  const cards=document.getElementById('cards');
  if(!tabs||!cards||typeof render!=='function')return;

  function escapeText(value){
    return String(value).replace(/[&<>"']/g,function(chr){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[chr];
    });
  }
  function remember(){
    try{localStorage.setItem(key,JSON.stringify(locations));}catch(e){}
  }
  function context(city){return centres[city]?centres[city][2]:city;}
  function place(city){
    return locations[city] ? locations[city]+', '+context(city) : context(city);
  }
  function googleSearch(query){
    return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(query);
  }
  function mapSource(city){
    const address=locations[city];
    if(address){
      // Keyless preview supports user-supplied text; the Google Maps link is the
      // authoritative fallback if the third-party iframe cannot display it.
      return 'https://maps.google.com/maps?q='+encodeURIComponent(place(city))+'&output=embed';
    }
    const data=centres[city];
    if(!data)return '';
    const lat=data[0],lon=data[1],deltaLat=.014,deltaLon=.020;
    const bbox=[lon-deltaLon,lat-deltaLat,lon+deltaLon,lat+deltaLat].map(function(n){return n.toFixed(6);}).join(',');
    return 'https://www.openstreetmap.org/export/embed.html?bbox='+
      encodeURIComponent(bbox)+'&layer=mapnik&marker='+encodeURIComponent(lat+','+lon);
  }
  function nearbyLink(city,term){
    return googleSearch(term+' near '+place(city));
  }
  function getCardCity(card){
    const heading=card.querySelector('.city-title');
    return heading && centres[heading.textContent] ? heading.textContent : null;
  }
  function buildAddressControl(city,i){
    const section=document.createElement('section');
    section.className='planning-address';
    section.dataset.city=city;
    const id='planning-address-'+i;
    const stored=locations[city]||'';
    section.innerHTML=
      '<label for="'+id+'" class="planning-address-label">Planned accommodation address <span>(optional)</span></label>'+
      '<div class="planning-address-controls">'+
      '<input id="'+id+'" type="text" maxlength="500" autocomplete="street-address" '+
      'placeholder="Enter an address or neighborhood" value="'+escapeText(stored)+'" '+
      'aria-label="Planned accommodation address for '+escapeText(city)+'">'+
      '<button type="button" data-save-address="'+escapeText(city)+'">Use location</button>'+
      (stored?'<button type="button" class="planning-address-clear" data-clear-address="'+escapeText(city)+'" aria-label="Clear saved address for '+escapeText(city)+'">Clear</button>':'')+
      '</div>'+
      '<p class="planning-address-hint">'+
      (stored?'Saved to this browser. Map previews and searches now use your planning address.':
       'Not booked yet? Enter a potential location to explore the surrounding area.')+
      '</p>';
    return section;
  }
  function buildResources(city){
    const section=document.createElement('section');
    section.className='resources-card';
    section.setAttribute('aria-label','Local resources for '+city);
    const address=!!locations[city];
    const source=mapSource(city);
    const search=googleSearch(place(city));
    const embedded=source
      ?'<iframe title="'+escapeText(city)+' neighborhood map preview" src="'+escapeText(source)+
       '" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>'
      :'<div class="resource-no-map">Map preview unavailable for this city.</div>';
    section.innerHTML=
      '<div class="resources-header">'+
      '<strong>Neighborhood map</strong>'+
      '<span class="resources-map-status">'+(address?'Based on your planning address':'Example · approximate city centre')+'</span>'+
      '</div>'+
      '<div class="resources-map-frame">'+embedded+'</div>'+
      '<div class="resources-map-actions">'+
      '<a href="'+escapeText(search)+'" target="_blank" rel="noopener noreferrer">Open location in Google Maps ↗</a>'+
      '</div>'+
      '<h3>Explore local resources</h3>'+
      '<p>Search for nearby essentials from '+(address?'your entered location':'this city-centre example')+
      '. These links show live map searches, not verified Noovuu recommendations.</p>'+
      '<div class="resource-category-links">'+categories.map(function(item){
        return '<a href="'+escapeText(nearbyLink(city,item[2]))+
          '" target="_blank" rel="noopener noreferrer" aria-label="Find '+escapeText(item[1])+' near '+escapeText(city)+'">'+
          escapeText(item[1])+' <span aria-hidden="true">↗</span></a>';
      }).join('')+'</div>'+
      '<p class="resources-privacy">Planning addresses stay in this browser. Viewing maps or following resource links shares the search location with the map provider. No business pricing, routes or travel times are estimated yet. Map data © OpenStreetMap contributors.</p>';
    return section;
  }
  function applyResources(){
    tabs.hidden=!state.advanced;
    tabs.querySelectorAll('button[data-resources-tab]').forEach(function(button){
      const selected=button.dataset.resourcesTab===activeTab;
      button.setAttribute('aria-selected',String(selected));
      button.tabIndex=selected?0:-1;
    });
    cards.classList.toggle('resources-mode',!!state.advanced&&activeTab==='resources');
    if(!state.advanced)return;
    cards.querySelectorAll('.city').forEach(function(card,i){
      const city=getCardCity(card);
      if(!city)return;
      const header=card.querySelector('.card-head');
      if(header)header.insertAdjacentElement('afterend',buildAddressControl(city,i));
      if(activeTab==='resources')card.appendChild(buildResources(city));
    });
  }

  // The app's existing render runs first, preserving all financial calculations,
  // currency conversion and the Budget Builder's transactional drawer behavior.
  const priorRender=render;
  render=function(){
    priorRender();
    applyResources();
  };

  tabs.addEventListener('click',function(e){
    const button=e.target.closest('button[data-resources-tab]');
    if(!button)return;
    activeTab=button.dataset.resourcesTab==='resources'?'resources':'budget';
    render();
  });
  tabs.addEventListener('keydown',function(e){
    if(e.key!=='ArrowLeft'&&e.key!=='ArrowRight')return;
    e.preventDefault();
    activeTab=e.key==='ArrowRight'?'resources':'budget';
    render();
    tabs.querySelector('button[aria-selected="true"]').focus();
  });
  cards.addEventListener('click',function(e){
    const set=e.target.closest('button[data-save-address]');
    const clear=e.target.closest('button[data-clear-address]');
    if(!set&&!clear)return;
    const city=(set||clear).dataset[set?'saveAddress':'clearAddress'];
    if(!centres[city])return;
    if(clear){
      delete locations[city];remember();render();return;
    }
    const section=set.closest('.planning-address');
    const input=section&&section.querySelector('input');
    if(!input)return;
    const address=input.value.trim();
    if(!address){
      input.setCustomValidity('Enter an address or neighborhood, or leave the location blank.');
      input.reportValidity();
      input.addEventListener('input',function(){input.setCustomValidity('');},{once:true});
      return;
    }
    locations[city]=address;remember();render();
  });
  cards.addEventListener('keydown',function(e){
    if(e.key==='Enter'&&e.target.matches('.planning-address input')){
      e.preventDefault();
      const button=e.target.closest('.planning-address').querySelector('[data-save-address]');
      if(button)button.click();
    }
  });
  render();
})();
