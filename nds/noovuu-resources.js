/*
 * Noovuu Local plan, prototype v2.
 * Named places from reviewed listings and fresh OpenStreetMap POIs.
 * Price suitability is UNVERIFIED until merchant price data is connected.
 * Source Figma files remain entirely read-only.
 */
(function(){
'use strict';
const addressKey='noovuu-planning-locations-v1'; // Retain saved user addresses.
const pointKey='noovuu-planning-coordinates-v1';
const selectedKey='noovuu-regular-places-v1';
const poisKey='noovuu-local-pois-v1';
const categories=[
 {id:'groceries',label:'Groceries',budget:'groceries',kinds:['supermarket','convenience','greengrocer','marketplace']},
 {id:'cafes',label:'Cafés',budget:'restaurants',kinds:['cafe','coffee_shop']},
 {id:'restaurants',label:'Restaurants',budget:'restaurants',kinds:['restaurant','fast_food']},
 {id:'fitness',label:'Fitness',budget:'gym',kinds:['fitness_centre','gym']},
 {id:'mobile',label:'Mobile & internet',budget:'mobile',kinds:['mobile_phone','telecommunication']},
 {id:'essentials',label:'Essentials',budget:'other',kinds:['pharmacy','chemist','laundry']}
];
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
// Verified businesses with exact street addresses. Only grocery pins with
// independently published coordinates are statically mapped. All others
// are located by geocoding a specific venue on demand, not invented.
const curated={
 'Córdoba':{
  groceries:[
   ['Bodega Aurrera · Av. 11','Av. 11 1510, Centro, Córdoba, Veracruz','discount',18.885843,-96.933846],
   ['Chedraui Córdoba Centro','Av. 8 801, Centro, Córdoba, Veracruz','supermarket',18.890057,-96.947136]
  ],
  cafes:[
   ['El Punto Café Centro','Av. 3 13, Centro, Córdoba, Veracruz','coffee'],
   ['Typica','Calle 1 300, Centro, Córdoba, Veracruz','coffee']
  ],
  restaurants:[
   ['El Patio de la Abuela','Calle 1 208, Centro, Córdoba, Veracruz','local'],
   ['Tasca 1821','Av. 1 105, Centro, Córdoba, Veracruz','restaurant']
  ],
  fitness:[
   ['Power Gym Córdoba','Av. 4 1721, Centro, Córdoba, Veracruz','local'],
   ['Sport Fitness Plaza Fundadores','Av. 1 2620, Plaza Fundadores, Centro, Córdoba, Veracruz','local']
  ],
  mobile:[
   ['Telcel Córdoba','Avenida 1 esquina Calle 6, Centro, Córdoba, Veracruz','provider'],
   ['AT&T Córdoba','Av. 11 1305 Int. 5, Centro, Córdoba, Veracruz','provider']
  ],
  essentials:[
   ['Farmacia Guadalajara','Av. 3 1123, Centro, Córdoba, Veracruz','pharmacy'],
   ['Farmacia de Dios','Av. 1 esquina Calle 9, Centro, Córdoba, Veracruz','pharmacy']
  ]
 },
 'Medellín':{
  groceries:[
   ['EURO Supermercado Laureles','Av. Nutibara, transversal 39B, Medellín, Antioquia','supermarket'],
   ['Éxito Wow Poblado','Calle 10 #43E-135, El Poblado, Medellín','supermarket']
  ]
 },
 'Bucaramanga':{
  groceries:[
   ['Mercasur Centro','Calle 35 #23-70, Centro, Bucaramanga','supermarket'],
   ['Éxito Bucaramanga La Rosita','Carrera 17 #45-77, Bucaramanga','supermarket']
  ]
 }
};
const locations={},coordinates={},selected={},poiCache={};
function load(key){
 try{const x=JSON.parse(localStorage.getItem(key)||'{}');return x&&typeof x==='object'?x:{};}catch(e){return {};}
}
Object.assign(locations,load(addressKey));
Object.assign(coordinates,load(pointKey));
Object.assign(selected,load(selectedKey));
Object.assign(poiCache,load(poisKey));
function save(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch(e){}}
const tabs=document.getElementById('advanced-tabs'),cards=document.getElementById('cards');
if(!tabs||!cards||typeof render!=='function')return;
const oldRender=render;
let activeTab='budget',currentCategory='groceries';
let updateVersion=0;
const inflight={},poiInflight={};
let geocodeQueue=Promise.resolve(),geocodeLast=0;
let poiQueue=Promise.resolve();
const currentMaps=new Map();

function escapeText(x){
 return String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function numeric(x){return Number.isFinite(+x)?+x:null;}
function validPoint(p){
 return p&&Number.isFinite(+p.lat)&&Number.isFinite(+p.lon)&&Math.abs(+p.lat)<=90&&Math.abs(+p.lon)<=180;
}
function centre(city){const p=centres[city];return {lat:p[0],lon:p[1]};}
function here(city){
 return locations[city]&&validPoint(coordinates[city])?coordinates[city]:centre(city);
}
function homeLabel(city){
 return locations[city]?(validPoint(coordinates[city])?'Approximate planning location':'Address saved · location not verified'):'Example city centre';
}
function kind(tags){
 if(!tags)return '';
 return tags.shop||tags.amenity||tags.leisure||tags.office||'';
}
function classified(tags){
 const k=kind(tags);
 if(['supermarket','convenience','greengrocer','marketplace'].includes(k))return 'groceries';
 if(k==='cafe'||k==='coffee_shop')return 'cafes';
 if(k==='restaurant'||k==='fast_food')return 'restaurants';
 if(k==='fitness_centre'||k==='gym')return 'fitness';
 if(k==='mobile_phone'||k==='telecommunication')return 'mobile';
 if(k==='pharmacy'||k==='chemist'||k==='laundry')return 'essentials';
 return '';
}
function haversine(a,b){
 if(!validPoint(a)||!validPoint(b))return null;
 const rad=Math.PI/180,dx=(b.lat-a.lat)*rad,dy=(b.lon-a.lon)*rad;
 const q=Math.sin(dx/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dy/2)**2;
 return 6371*2*Math.atan2(Math.sqrt(q),Math.sqrt(1-q));
}
function milesLabel(d){return d===null?'Location pending':d<1?Math.round(d*1000)+' m straight-line':d.toFixed(1)+' km straight-line';}
function addressOf(tags,city){
 const bits=[tags['addr:street'],tags['addr:housenumber']].filter(Boolean);
 if(bits.length)return bits.join(' ')+(tags['addr:suburb']?', '+tags['addr:suburb']:'');
 return tags['addr:city']||city;
}
function tierScore(name,tags,category){
 const v=(name+' '+(tags.brand||'')).toLowerCase();
 if(category==='groceries'&&/\b(aurrera|d1|ara|aldi|lidl|justo|mas x menos|más x menos|mercasur)\b/.test(v))return 2;
 if(category==='groceries'&&/mercado|plaza de mercado|mercasur/.test(v))return 1.5;
 if(category==='restaurants'&&tags.amenity==='fast_food')return 0.8;
 return 0;
}
function curatedPlaces(city,category){
 const arr=curated[city]&&curated[city][category]||[];
 return arr.map((data,i)=>({
  id:'verified:'+city+':'+category+':'+i,
  category,name:data[0],address:data[1],tier:data[2],
  lat:data[3],lon:data[4],source:'Reviewed local listing',
  sourceDate:'November 2026',verifiedPrice:false
 }));
}
function osmPlaces(city,category){
 const center=here(city);
 const raw=poiCache[city];
 if(!raw||!Array.isArray(raw.places)||raw.expires<Date.now())return [];
 if(haversine(raw.center,center)>0.9)return [];
 return raw.places.filter(p=>p.category===category);
}
function score(p,city,category){
 const dist=haversine(here(city),p);
 const tags=p.tags||{};
 const preferences=typeof profile==='object'?profile:{};
 const diet=String(preferences.diet||'').toLowerCase();
 let dietFit=0;
 if(category==='restaurants'||category==='cafes'){
   if(diet.includes('vegan')&&tags['diet:vegan']==='yes')dietFit=2.5;
   else if(diet.includes('vegetarian')&&tags['diet:vegetarian']==='yes')dietFit=2.5;
 }
 return (dist===null?-11:-dist*2.1)+tierScore(p.name,tags,category)*2.1+dietFit;
}
function options(city,category){
 const raw=[...osmPlaces(city,category),...curatedPlaces(city,category)];
 const unique=new Map();
 for(const p of raw){
  const n=(p.name||'').toLowerCase().replace(/[^a-z0-9]+/g,'').slice(0,34);
  if(!n)continue;
  if(!unique.has(n))unique.set(n,p);
  else if(validPoint(p)&&!validPoint(unique.get(n)))unique.set(n,p);
 }
 const ordered=[...unique.values()].sort((a,b)=>score(b,city,category)-score(a,city,category));
 const chosen=selected[city]&&selected[city][category];
 if(chosen){
  const selectedIndex=ordered.findIndex(p=>p.id===chosen);
  if(selectedIndex>0){const [p]=ordered.splice(selectedIndex,1);ordered.unshift(p);}
 }
 return ordered.slice(0,2);
}
function categoryBudget(city,cat){
 const c=categories.find(x=>x.id===cat);
 const amount=state.prices&&state.prices[city]&&state.prices[city][c&&c.budget];
 if(!Number.isFinite(amount))return 'Budget not specified';
 return 'Your '+c.label.toLowerCase()+' estimate: '+(typeof money==='function'?money(amount):'C$'+Math.round(amount));
}
function why(p,city,cat){
 const d=haversine(here(city),p);
 if(d===null)return 'Named local option · exact position not yet mapped';
 const savingsHint=cat==='groceries'&&p.tier==='discount'?' · discount-format grocery store':'';
 return milesLabel(d)+savingsHint;
}
function addressControl(city,i){
 const sec=document.createElement('section');
 sec.className='planning-address';
 sec.dataset.city=city;
 const id='planning-address-'+i;
 const address=locations[city]||'';
 sec.innerHTML=
 '<label class="planning-address-label" for="'+id+'">Your stay or potential address <span>(optional)</span></label>'+
 '<div class="planning-address-controls">'+
 '<input id="'+id+'" type="text" maxlength="500" autocomplete="street-address" placeholder="Address or neighborhood" value="'+escapeText(address)+'" aria-label="Planning address in '+escapeText(city)+'">'+
 '<button type="button" data-save-address="'+escapeText(city)+'">Set location</button>'+
 (address?'<button type="button" class="planning-address-clear" data-clear-address="'+escapeText(city)+'">Clear</button>':'')+
 '</div>'+
 '<p class="planning-address-hint">'+escapeText(homeLabel(city))+
 (address&&validPoint(coordinates[city])?' · nearby places ranked from this location.':'.')+
 '</p>';
 return sec;
}
function resourceShell(city){
 const sec=document.createElement('section');
 sec.className='resources-card resources-plan';
 sec.dataset.resourceCity=city;
 const cats=categories.map(c=>'<button type="button" class="resource-category-tab" data-category="'+c.id+
 '" aria-pressed="'+String(currentCategory===c.id)+'">'+escapeText(c.label)+'</button>').join('');
 sec.innerHTML=
 '<div class="plan-heading"><strong>Your local plan</strong><span class="plan-context">'+escapeText(homeLabel(city))+'</span></div>'+
 '<p class="plan-intro">Two named places to make part of your routine, using your budget, location and available lifestyle preferences. Blue is primary, amber is the alternative. Select one to make it yours.</p>'+
 '<div class="resource-category-tabs" role="group" aria-label="Resource type">'+cats+'</div>'+
 '<div class="plan-guidance">'+escapeText(categoryBudget(city,currentCategory))+
 '<span> · Prices and memberships not yet verified</span></div>'+
 '<div class="resource-map-frame resource-interactive-map" data-resource-map role="region" aria-label="Map with named recommendations for '+escapeText(city)+'">'+
 '<div class="resource-map-loading">Loading your neighborhood map…</div></div>'+
 '<div class="plan-pin-key"><span><i class="pin-home"></i>Home</span><span><i class="pin-primary"></i>Recommended</span><span><i class="pin-secondary"></i>Alternative</span></div>'+
 '<div class="resource-pair" aria-live="polite"></div>'+
 '<p class="resources-privacy">These are specific venues, not price-verified endorsements. Recommendations reflect proximity, business type, and available lifestyle information. Entering an address shares it with a geocoding provider; the address is stored locally. Distances are straight-line, not driving times. Map © OpenStreetMap contributors.</p>';
 return sec;
}
function renderPairs(city,section){
 const pair=section.querySelector('.resource-pair');
 if(!pair)return;
 const spots=options(city,currentCategory);
 if(!spots.length){
  pair.innerHTML='<div class="resource-empty"><strong>No reliable named matches yet.</strong>'+
   '<p>We could not identify verified locations for this category near your planning location. No businesses have been invented.</p>'+
   '<button type="button" data-refresh-places="'+escapeText(city)+'">Retry live local listings</button></div>';
  updatePins(city,section,spots);
  return;
 }
 const rows=spots.map((p,index)=>{
  const primary=index===0;
  const name=escapeText(p.name),where=escapeText(p.address||city);
  return '<article class="resource-place '+(primary?'is-primary':'is-alternate')+'">'+
   '<div class="place-status"><span class="place-status-dot"></span>'+
   (primary?'Recommended':'Alternative')+'</div>'+
   '<button type="button" class="resource-place-name" data-focus-place="'+escapeText(p.id)+
   '" data-city="'+escapeText(city)+'" title="View '+name+' on the map">'+name+' ↗</button>'+
   '<p class="place-address">'+where+'</p>'+
   '<p class="place-why">'+escapeText(why(p,city,currentCategory))+'</p>'+
   '<button type="button" data-choose-place="'+escapeText(p.id)+
   '" data-city="'+escapeText(city)+'" data-category="'+currentCategory+'"'+
   (primary?' disabled aria-current="true"':'')+'>'+
   (primary?'Your current recommendation':'Make this my regular spot')+'</button>'+
   '</article>';
 }).join('');
 pair.innerHTML=rows;
 if(spots.length===1)pair.innerHTML+='<p class="resource-small-note">Only one specific place is available in this area so far. We will not invent a second.</p>';
 updatePins(city,section,spots);
}
function pinIcon(role){
 const color=role==='primary'?'#1a73e8':role==='secondary'?'#e59a25':'#5f6368';
 return L.divIcon({
  className:'noovuu-marker-root',
  html:'<span class="noovuu-pin noovuu-pin-'+role+'" style="--pin-color:'+color+'"></span>',
  iconSize:[20,20],iconAnchor:[10,10]
 });
}
function updatePins(city,section,spots){
 const record=currentMaps.get(city);
 if(!record||record.container!==section.querySelector('[data-resource-map]'))return;
 record.layer.clearLayers();
 record.markerById=new Map();
 const center=here(city);
 L.marker([center.lat,center.lon],{icon:pinIcon('home'),keyboard:true,title:homeLabel(city)}).addTo(record.layer).bindPopup(escapeText(homeLabel(city)));
 const pts=[[center.lat,center.lon]];
 spots.forEach((p,i)=>{
  if(!validPoint(p))return;
  const pt=[+p.lat,+p.lon];pts.push(pt);
  const marker=L.marker(pt,{icon:pinIcon(i===0?'primary':'secondary'),keyboard:true,title:p.name})
   .addTo(record.layer).bindPopup('<strong>'+escapeText(p.name)+'</strong>'+
     '<p>'+escapeText(p.address||city)+'</p><small>'+escapeText(i===0?'Recommended':'Alternative')+'</small>');
  record.markerById.set(p.id,marker);
 });
 if(pts.length>1){
  record.map.fitBounds(L.latLngBounds(pts).pad(.35),{animate:false,maxZoom:14});
 }else record.map.setView([center.lat,center.lon],13,{animate:false});
}
function mountMap(city,section){
 const container=section.querySelector('[data-resource-map]');
 if(!container)return;
 if(!window.L){
  container.innerHTML='<div class="resource-map-loading">The map is unavailable. Named resources remain accessible below.</div>';
  return;
 }
 const p=here(city);
 const map=L.map(container,{scrollWheelZoom:false,zoomControl:true}).setView([p.lat,p.lon],13);
 L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
  attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>',
  maxZoom:19
 }).addTo(map);
 const layer=L.layerGroup().addTo(map);
 currentMaps.set(city,{map,layer,container});
 updatePins(city,section,options(city,currentCategory));
 requestAnimationFrame(()=>map.invalidateSize());
}
function disposeMaps(){
 for(const entry of currentMaps.values())try{entry.map.remove();}catch(e){}
 currentMaps.clear();
}
function cardCity(card){
 const title=card.querySelector('.city-title');
 return title&&centres[title.textContent]?title.textContent:null;
}
function apply(){
 disposeMaps();
 tabs.hidden=!state.advanced;
 tabs.querySelectorAll('button[data-resources-tab]').forEach(button=>{
  const active=button.dataset.resourcesTab===activeTab;
  button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;
 });
 cards.classList.toggle('resources-mode',state.advanced&&activeTab==='resources');
 if(!state.advanced)return;
 cards.querySelectorAll('.city').forEach((card,i)=>{
  const city=cardCity(card);if(!city)return;
  const h=card.querySelector('.card-head');
  if(h)h.insertAdjacentElement('afterend',addressControl(city,i));
  if(activeTab!=='resources')return;
  const resources=resourceShell(city);
  card.appendChild(resources);
  mountMap(city,resources);
  renderPairs(city,resources);
  const isCurated=curated[city]&&curated[city][currentCategory];
  if(isCurated)locateCurated(city,currentCategory);
  if(!locations[city]||validPoint(coordinates[city]))discover(city);
 });
}
render=function(){oldRender();apply();};

// Photon demo: only explicit user action and a small number of *named* places.
// Throttle + local cache. Production needs contracted geocoding API.
function queuedGeocode(query,origin,cacheId){
 const cache=load('noovuu-venue-geocodes-v1');
 if(validPoint(cache[cacheId]))return Promise.resolve(cache[cacheId]);
 if(inflight[cacheId])return inflight[cacheId];
 geocodeQueue=geocodeQueue.catch(()=>{}).then(async()=>{
  const wait=Math.max(0,1200-(Date.now()-geocodeLast));
  if(wait)await new Promise(r=>setTimeout(r,wait));
  geocodeLast=Date.now();
  const params=new URLSearchParams({q:query,limit:'3',lat:String(origin.lat),lon:String(origin.lon)});
  const rsp=await fetch('https://photon.komoot.io/api/?'+params.toString(),{headers:{'Accept':'application/json'}});
  if(!rsp.ok)throw Error('Geocoding service unavailable');
  const data=await rsp.json();
  const result=(data.features||[]).find(f=>{
   const c=f.geometry&&f.geometry.coordinates;
   return c&&c.length===2&&haversine(origin,{lat:c[1],lon:c[0]})<24;
  });
  if(!result)throw Error('Address could not be located in this city');
  const c=result.geometry.coordinates,p={lat:+c[1],lon:+c[0]};
  const current=load('noovuu-venue-geocodes-v1');current[cacheId]=p;
  save('noovuu-venue-geocodes-v1',current);
  return p;
 });
 inflight[cacheId]=geocodeQueue.finally(()=>{delete inflight[cacheId];});
 return inflight[cacheId];
}
async function geocodeStay(city){
 const address=locations[city];if(!address)return;
 const base=centre(city),token='stay:'+city+':'+address.toLowerCase();
 try{
  const p=await queuedGeocode(address+', '+centres[city][2],base,token);
  if(locations[city]!==address)return;
  coordinates[city]=p;save(pointKey,coordinates);
  render();
 }catch(e){
  if(locations[city]!==address)return;
  delete coordinates[city];save(pointKey,coordinates);
  const field=cards.querySelector('.planning-address[data-city="'+CSS.escape(city)+'"] .planning-address-hint');
  if(field)field.textContent='Location saved, but could not be precisely mapped. Showing the city-centre example until verified.';
 }
}
async function locateCurated(city,category){
 const arr=curatedPlaces(city,category).filter(p=>!validPoint(p));
 if(!arr.length)return;
 const start=centre(city);
 for(const p of arr){
  try{
   const result=await queuedGeocode(p.name+', '+p.address,start,'venue:'+p.id);
   const record=curated[city][category][+p.id.split(':').pop()];
   record[3]=result.lat;record[4]=result.lon;
  }catch(e){/* Do not invent a pin when lookup fails. */}
  const section=cards.querySelector('.resources-card[data-resource-city="'+CSS.escape(city)+'"]');
  if(section&&currentCategory===category)renderPairs(city,section);
 }
}
function overpassQuery(p){
 const lat=Number(p.lat).toFixed(5),lon=Number(p.lon).toFixed(5);
 const around='(around:4000,'+lat+','+lon+')';
 return '[out:json][timeout:22];('+
  'nwr'+around+'["shop"~"^(supermarket|convenience|greengrocer|mobile_phone|chemist|laundry)$"];'+
  'nwr'+around+'["amenity"~"^(marketplace|cafe|restaurant|fast_food|pharmacy|gym)$"];'+
  'nwr'+around+'["leisure"="fitness_centre"];'+
  'nwr'+around+'["office"="telecommunication"];'+
  ');out center 500;';
}
async function requestPOIs(city,point,force){
 const cached=poiCache[city];
 if(!force&&cached&&cached.expires>Date.now()&&haversine(cached.center,point)<.9)return;
 if(poiInflight[city])return poiInflight[city];
 poiQueue=poiQueue.catch(()=>{}).then(async()=>{
  // Public Overpass is best-effort, so request only for an active Resources card.
  const body=new URLSearchParams({data:overpassQuery(point)});
  const rsp=await fetch('https://overpass-api.de/api/interpreter',{
   method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
   body:body.toString()
  });
  if(!rsp.ok)throw Error('Local-place directory unavailable');
  const json=await rsp.json();
  const places=(json.elements||[]).filter(x=>{
    const t=x.tags||{};return !!t.name&&(x.center||(Number.isFinite(x.lat)&&Number.isFinite(x.lon)));
  }).map(x=>{
    const t=x.tags;
    const category=classified(t);if(!category)return null;
    const pt=x.center||x;
    return {id:'osm:'+x.type+':'+x.id,category,name:t.name,
      address:addressOf(t,city),lat:+pt.lat,lon:+pt.lon,tags:t,
      source:'OpenStreetMap',verifiedPrice:false};
  }).filter(Boolean).slice(0,500);
  poiCache[city]={center:point,places,expires:Date.now()+24*60*60*1000};
  save(poisKey,poiCache);
 });
 poiInflight[city]=poiQueue.finally(()=>{delete poiInflight[city];});
 return poiInflight[city];
}
async function discover(city,force){
 const location=here(city);
 try{
  await requestPOIs(city,location,!!force);
  const sec=cards.querySelector('.resources-card[data-resource-city="'+CSS.escape(city)+'"]');
  if(sec)renderPairs(city,sec);
 }catch(e){
  const sec=cards.querySelector('.resources-card[data-resource-city="'+CSS.escape(city)+'"]');
  if(sec&&!options(city,currentCategory).length){
    const box=sec.querySelector('.resource-pair');
    if(box)box.innerHTML='<div class="resource-empty"><strong>Live local places are temporarily unavailable.</strong><p>We cannot make a reliable specific recommendation here without place data.</p><button type="button" data-refresh-places="'+escapeText(city)+'">Retry</button></div>';
  }
 }
}
function rerenderCategory(){
 cards.querySelectorAll('.resources-card').forEach(sec=>{
  sec.querySelectorAll('button[data-category]').forEach(b=>{
    b.setAttribute('aria-pressed',String(b.dataset.category===currentCategory));
  });
  const city=sec.dataset.resourceCity;
  const guidance=sec.querySelector('.plan-guidance');
  if(guidance)guidance.innerHTML=escapeText(categoryBudget(city,currentCategory))+
    '<span> · Prices and memberships not yet verified</span>';
  renderPairs(city,sec);
  if(curated[city]&&curated[city][currentCategory])locateCurated(city,currentCategory);
 });
}

tabs.addEventListener('click',e=>{
 const button=e.target.closest('button[data-resources-tab]');if(!button)return;
 activeTab=button.dataset.resourcesTab==='resources'?'resources':'budget';
 render();
});
tabs.addEventListener('keydown',e=>{
 if(e.key!=='ArrowLeft'&&e.key!=='ArrowRight')return;
 e.preventDefault();activeTab=e.key==='ArrowRight'?'resources':'budget';
 render();tabs.querySelector('button[aria-selected="true"]').focus();
});
cards.addEventListener('click',e=>{
 const cat=e.target.closest('button[data-category]');
 if(cat){currentCategory=cat.dataset.category;rerenderCategory();return;}
 const focus=e.target.closest('button[data-focus-place]');
 if(focus){
  const city=focus.dataset.city;
  const entry=currentMaps.get(city);
  const marker=entry&&entry.markerById&&entry.markerById.get(focus.dataset.focusPlace);
  if(marker){
   entry.map.setView(marker.getLatLng(),Math.max(14,entry.map.getZoom()),{animate:true});
   marker.openPopup();
   entry.container.scrollIntoView({behavior:'smooth',block:'nearest'});
  }
  return;
 }
 const choose=e.target.closest('button[data-choose-place]');
 if(choose){
  const city=choose.dataset.city,category=choose.dataset.category,id=choose.dataset.choosePlace;
  if(!selected[city])selected[city]={};
  selected[city][category]=id;save(selectedKey,selected);
  const sec=cards.querySelector('.resources-card[data-resource-city="'+CSS.escape(city)+'"]');
  if(sec)renderPairs(city,sec);
  return;
 }
 const retry=e.target.closest('button[data-refresh-places]');
 if(retry){discover(retry.dataset.refreshPlaces,true);return;}
 const clear=e.target.closest('button[data-clear-address]');
 const set=e.target.closest('button[data-save-address]');
 if(!set&&!clear)return;
 const city=(set||clear).dataset[clear?'clearAddress':'saveAddress'];
 if(!centres[city])return;
 if(clear){
  delete locations[city];delete coordinates[city];
  save(addressKey,locations);save(pointKey,coordinates);
  render();return;
 }
 const input=set.closest('.planning-address').querySelector('input');
 const address=input.value.trim();
 if(!address){
  input.setCustomValidity('Enter a location or use Clear.');
  input.reportValidity();
  input.addEventListener('input',()=>input.setCustomValidity(''),{once:true});
  return;
 }
 const changed=locations[city]!==address;
 locations[city]=address;
 if(changed)delete coordinates[city];
 save(addressKey,locations);save(pointKey,coordinates);
 render();
 if(changed||!validPoint(coordinates[city]))geocodeStay(city);
});
cards.addEventListener('keydown',e=>{
 if(e.key!=='Enter'||!e.target.matches('.planning-address input'))return;
 e.preventDefault();e.target.closest('.planning-address').querySelector('[data-save-address]')?.click();
});
render();
})();
