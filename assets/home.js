/* Home map: pins, legend/layers, season filter, pond panel (content fetched from the pond's own page), gazetteer */
(async function(){
const $ = s => document.querySelector(s);
const {esc, yr, dms} = APC;
let idx, geo;
try{ [idx, geo] = await Promise.all([fetch('/data/index.json').then(r=>r.json()), fetch('/data/map.json').then(r=>r.json())]); }
catch(e){ $('#loading').textContent = 'The map didn’t load. Reload the page to try again.'; return; }
$('#loading').remove();
const places = idx.places, byId = Object.fromEntries(places.map(p=>[p.id,p]));
const onMap = places;
const ponds = places.filter(p => p.kind==='pond'), areas = places.filter(p => p.kind==='area');
const state = {year:null};
const rel = p => k => p.kind==='pond' ? k==='pond' : (k==='shore'||k==='others');
const total = p => p.c.filter(([,k]) => rel(p)(k)).length;
const countOf = p => { const n = p.c.filter(([y,k]) => rel(p)(k) && (!state.year || y===state.year)).length; return state.year ? n : Math.max(1,n); };

const map = L.map('map',{zoomControl:false,minZoom:5,maxZoom:16,zoomSnap:.5,maxBounds:[[45.6,-70.5],[61.3,-48.5]],maxBoundsViscosity:.8});
APC.attribution(map);
const home = L.latLngBounds(onMap.filter(p=>p.kind==='pond'&&p.lng>-53.2&&p.lat>47.2).map(p=>[p.lat,p.lng]));
map.fitBounds(home, innerWidth<760?{paddingTopLeft:[20,130],paddingBottomRight:[20,90]}:{paddingTopLeft:[340,40],paddingBottomRight:[60,60]});
const base = APC.base(map, geo, {mine:new Set(ponds.map(p=>p.id)), onMine:id=>openPlace(id), pondLabels:ponds});

// pins
const pinSize = n => Math.round(22+Math.min(18,Math.sqrt(n)*4.5));
const markers = {}; let current = null;
function makePin(p){ const n=countOf(p), isPond=p.kind==='pond', s=isPond?pinSize(n):17;
  const icon = L.divIcon({className:'',iconSize:[s,s],iconAnchor:[s/2,s/2],html:`<div class="pin ${isPond?'':'area'} ${p.status==='to-confirm'?'check':''} ${current===p.id?'sel':''}" style="width:${s}px;height:${s}px">${isPond?n:''}</div>`});
  const m = L.marker([p.lat,p.lng],{icon,title:`${p.name}${p.where?' — '+p.where:''} (${n} cleanup${n===1?'':'s'})`,keyboard:true,riseOnHover:true});
  m.cleanups = n; m.on('click',()=>openPlace(p.id)); markers[p.id]=m; return m; }
const pondCluster = L.markerClusterGroup({showCoverageOnHover:false,spiderfyOnMaxZoom:true,maxClusterRadius:z=>z<11?52:36,disableClusteringAtZoom:14,
  iconCreateFunction:c=>{ const ms=c.getAllChildMarkers(); const sum=ms.reduce((s,m)=>s+(m.cleanups||0),0); const s=Math.round(36+Math.min(24,Math.sqrt(sum)*2.5));
    return L.divIcon({className:'',iconSize:[s,s],html:`<div class="cl" style="width:${s}px;height:${s}px"><b>${sum}</b><small>${ms.length} ponds</small></div>`}); }});
const areaGroup = L.layerGroup();
function buildPins(){ pondCluster.clearLayers(); areaGroup.clearLayers();
  pondCluster.addLayers(onMap.filter(p=>p.kind==='pond'&&countOf(p)>0).map(makePin));
  onMap.filter(p=>p.kind==='area'&&countOf(p)>0).forEach(p=>areaGroup.addLayer(makePin(p)));
  renderStats(); }

// legend = layer switcher
const layers = {
  ponds:{on:true,label:'Ponds cleaned',hint:'number = cleanups there',sym:`<svg width="22" height="22" aria-hidden="true"><circle cx="11" cy="11" r="8.5" fill="var(--blaze)" stroke="var(--trail)" stroke-width="2"/></svg>`,
    set:on=>{ on?map.addLayer(pondCluster):map.removeLayer(pondCluster); base.toggle('mine',on); base.set('pondNames',on); }},
  areas:{on:false,label:'Beaches, trails &amp; roadsides',sym:`<svg width="22" height="22" aria-hidden="true"><rect x="6" y="6" width="10" height="10" transform="rotate(45 11 11)" fill="var(--trail)"/></svg>`,set:on=>on?map.addLayer(areaGroup):map.removeLayer(areaGroup)},
  check:{on:false,label:'Pin still being confirmed',sym:`<svg width="24" height="24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="var(--check)" stroke-width="2.2" stroke-dasharray="3.5 3"/></svg>`,set:on=>document.body.classList.toggle('show-check',on),sub:true},
  lakes:{on:true,label:'Other lakes &amp; ponds',sym:`<svg width="26" height="18" aria-hidden="true"><path d="M3 10c2-6 8-7 12-5s8 2 8 6-6 5-10 4-11 1-10-5Z" fill="var(--m-lake)" stroke="var(--m-lake-edge)"/></svg>`,set:on=>base.toggle('lakes',on),sub:true},
  roads:{on:true,label:'Main roads',sym:`<svg width="26" height="12" aria-hidden="true"><path d="M1 6h24" stroke="var(--m-road)" stroke-width="2.4"/></svg>`,set:on=>base.toggle('roads',on)},
  names:{on:true,label:'Place names',sym:`<span style="font:italic 600 13px var(--f-text);color:var(--m-hydro)" aria-hidden="true">Aa</span>`,set:on=>base.set('names',on)},
  grat:{on:true,label:'Latitude &amp; longitude grid',sym:`<svg width="26" height="18" aria-hidden="true"><path d="M1 6h24M1 13h24M8 1v16M18 1v16" stroke="var(--m-grid)" stroke-opacity=".7" stroke-dasharray="2.5 2.5"/></svg>`,set:on=>base.set('grid',on)},
};
function renderLegend(){
  $('#legBody').innerHTML = `<ul class="keys">${Object.entries(layers).map(([k,l])=>`<li class="${l.sub?'sub':''}"><label><input type="checkbox" data-l="${k}" ${l.on?'checked':''}><span class="sym">${l.sym}</span><span>${l.label}${l.hint?`<small>${l.hint}</small>`:''}</span></label></li>`).join('')}</ul>
   <div class="season"><div class="k" id="seasonK">Season</div><div class="yrs" role="group" aria-labelledby="seasonK">${['',...idx.years].map(y=>`<button type="button" data-y="${y}" aria-pressed="${(state.year||'')===y}">${y||'All'}</button>`).join('')}</div></div>`;
  $('#legBody').querySelectorAll('input[data-l]').forEach(cb => cb.onchange = () => { const l=layers[cb.dataset.l]; l.on=cb.checked; l.set(l.on); });
  $('#legBody').querySelectorAll('[data-y]').forEach(b => b.onclick = () => { state.year=b.dataset.y||null; $('#legBody').querySelectorAll('[data-y]').forEach(x=>x.setAttribute('aria-pressed',x===b)); buildPins(); });
}
$('#legH').onclick = () => { if(innerWidth<760){ $('#legend').hidden=true; return; } const b=$('#legH'), open=b.getAttribute('aria-expanded')==='true'; b.setAttribute('aria-expanded',!open); $('#legBody').hidden=open; };
$('#openLegend').onclick = () => { $('#legend').hidden = !$('#legend').hidden; };
function renderStats(){ const ps = ponds.filter(p=>countOf(p)>0);
  $('#stats').innerHTML = state.year
    ? `<span><b>${ps.reduce((s,p)=>s+countOf(p),0)}</b> pond cleanups posted</span><span><b>${ps.length}</b> ponds</span><span>in <b>${state.year}</b></span>`
    : `<span><b>${idx.totals.cleanups}</b> pond cleanups</span><span><b>${ponds.length}</b> ponds</span><span>since <b>${idx.totals.since}</b></span>`; }

APC.rose($('#rose')); APC.scale(map, $('#scale'));
$('#zin').onclick = () => map.zoomIn(); $('#zout').onclick = () => map.zoomOut();
renderLegend(); buildPins(); Object.values(layers).forEach(l=>l.set(l.on));
if(innerWidth<760) $('#legend').hidden = true;
else if(innerHeight<720){ $('#legH').setAttribute('aria-expanded','false'); $('#legBody').hidden = true; }

// panel
const sheet = $('#sheet'); const pages = {};
const setSel = () => Object.entries(markers).forEach(([id,m]) => m.getElement()?.firstElementChild?.classList.toggle('sel', id===current));
const getPage = id => pages[id] || (pages[id] = fetch(`/ponds/${id}/`).then(r=>r.text()).then(t=>new DOMParser().parseFromString(t,'text/html')));
async function openPlace(id, opts={}){
  const p = byId[id]; if(!p) return; current = id; setSel();
  if(!opts.noFly){ const z=Math.max(map.getZoom(), p.kind==='pond'?14:13);
    const small=innerWidth<760; const target=map.project([p.lat,p.lng],z).add([small?0:Math.min(440,innerWidth*.42)/2, small?innerHeight*.22:0]);
    map.once('moveend',()=>{ if(current===id) setSel(); }); map.flyTo(map.unproject(target,z),z,{duration:.6}); }
  const isPond = p.kind==='pond';
  sheet.innerHTML = `<div class="grab" aria-hidden="true"></div>
   <div class="sheet-head" id="sheetHead">${p.cover?`<img class="cover" alt="" src="/photos/thumbs/${p.cover}.webp">`:''}<div class="t"><div class="kicker ${isPond?'':'area'}">${isPond?'Pond':'Beach, trail &amp; roadside'}</div><h2>${esc(p.name)}</h2><div class="where">${esc(p.where||'')}</div></div><button class="x" id="closeSheet" type="button" aria-label="Close">×</button></div>
   <div class="sheet-body"><div id="sheetFacts"></div>${isPond?APC.shapeSVG(base.pondShapes[id],p.name):''}
    <a class="pagelink" href="/ponds/${id}/">Open the ${isPond?'pond':'place'} page <span aria-hidden="true">→</span></a><div id="sheetPosts"><p class="where">Loading posts…</p></div></div>`;
  sheet.hidden = false; requestAnimationFrame(()=>{ sheet.classList.remove('peek'); sheet.classList.add('open'); });
  $('#closeSheet').onclick = e => { e.stopPropagation(); closeSheet(); };
  $('#sheetHead').onclick = () => { if(innerWidth<760){ sheet.classList.toggle('open'); sheet.classList.toggle('peek'); } };
  sheet.querySelector('.sheet-body').scrollTop = 0;
  if(innerWidth<760) $('#legend').hidden = true;
  try{ history.replaceState(null,'','#'+id); }catch(e){}
  try{ const doc = await getPage(id); if(current!==id) return;
    $('#sheetFacts').innerHTML = doc.querySelector('#pond-facts')?.innerHTML || '';
    const posts = doc.querySelector('#posts'); $('#sheetPosts').innerHTML = posts ? posts.innerHTML : '';
    APCViewer.wire($('#sheetPosts')); }
  catch(e){ $('#sheetPosts').innerHTML = `<p class="where">Couldn’t load the posts. <a href="/ponds/${id}/">Open the page instead</a>.</p>`; }
}
function closeSheet(){ sheet.classList.remove('open','peek'); current=null; setSel(); setTimeout(()=>{ if(!current) sheet.hidden=true; },300); try{ history.replaceState(null,'',location.pathname); }catch(e){} }
map.on('click', () => { if(innerWidth<760){ if(current){ sheet.classList.remove('open'); sheet.classList.add('peek'); } $('#legend').hidden=true; } });
pondCluster.on('animationend', setSel); map.on('zoomend', () => setTimeout(setSel,60));

// gazetteer
const list = $('#list');
function renderList(q=''){
  const s=q.trim().toLowerCase(); const match=p=>!s||(p.name+' '+(p.where||'')).toLowerCase().includes(s);
  const ps=ponds.filter(match).sort((a,b)=>total(b)-total(a)||a.name.localeCompare(b.name));
  const as=areas.filter(match).sort((a,b)=>total(b)-total(a));
  const item=p=>`<button class="item" type="button" data-id="${p.id}">${p.cover?`<img alt="" loading="lazy" src="/photos/thumbs/${p.cover}.webp">`:'<span class="noimg"></span>'}<span class="t"><span class="n">${esc(p.name)}</span><span class="w">${esc(p.where||'')}${p.last?' · last '+yr(p.last):''}</span></span><span class="count ${p.kind==='area'?'area':''}">${total(p)}</span></button>`;
  $('#listBody').innerHTML=(ps.length?`<div class="group">Ponds · most cleaned first</div>${ps.map(item).join('')}`:'')+(as.length?`<div class="group">Beaches, trails &amp; roadsides</div>${as.map(item).join('')}`:'')+(!ps.length&&!as.length?`<p class="where">No pond matches “${esc(q)}”.</p>`:'');
}
renderList();
$('#q').oninput = e => renderList(e.target.value);
$('#openList').onclick = () => { list.hidden=false; if(innerWidth>=760) $('#q').focus({preventScroll:true}); };
$('#closeList').onclick = () => { list.hidden=true; };
$('#listBody').onclick = e => { const b=e.target.closest('.item'); if(!b) return; list.hidden=true; const p=byId[b.dataset.id];
  if(p.kind==='area'&&!layers.areas.on){ layers.areas.on=true; layers.areas.set(true); renderLegend(); } openPlace(b.dataset.id); };
document.addEventListener('keydown', e => { if(e.key!=='Escape' || document.querySelector('.lb:not([hidden])')) return; if(!list.hidden) list.hidden=true; else if(current) closeSheet(); else if(innerWidth<760) $('#legend').hidden=true; });

const h = location.hash.slice(1); if(h && byId[h]) setTimeout(()=>openPlace(h),300);
addEventListener('hashchange', () => { const k=location.hash.slice(1); if(k && byId[k] && k!==current) openPlace(k); });
})();
