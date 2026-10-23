/* Avalon Pond Cleanups — the night-green basemap, shared by the home map and the pond pages.
   Everything is drawn from data/map.json (OpenStreetMap coastline, islands, pond/lake outlines, roads).
   The contour look comes from echo lines: alternating wide strokes that leave thin rings following each shore. */
(function(){
const APC = window.APC = {};
const css = APC.css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
APC.esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
APC.yr = iso => iso ? iso.slice(0, 4) : '';
APC.fmt = iso => { if(!iso) return ''; const [y,m,d] = iso.split('-').map(Number); return new Date(y, m-1, d).toLocaleDateString('en-CA', {year:'numeric', month:'long', day:'numeric'}); };
APC.dm = (v,pos,neg) => { const h=v<0?neg:pos; v=Math.abs(v); let d=Math.floor(v), m=Math.round((v-d)*60); if(m===60){d++;m=0;} return `${d}°${String(m).padStart(2,'0')}′${h}`; };
APC.dms = (v,pos,neg) => { const h=v<0?neg:pos; v=Math.abs(v); const d=Math.floor(v), mf=(v-d)*60, m=Math.floor(mf), s=Math.min(59,Math.round((mf-m)*60)); return `${d}°${String(m).padStart(2,'0')}′${String(s).padStart(2,'0')}″${h}`; };
APC.decode = function(str){ let i=0,lat=0,lng=0,out=[]; while(i<str.length){ let b,s=0,r=0; do{b=str.charCodeAt(i++)-63;r|=(b&31)<<s;s+=5}while(b>=32); lat+=(r&1)?~(r>>1):(r>>1); s=0;r=0; do{b=str.charCodeAt(i++)-63;r|=(b&31)<<s;s+=5}while(b>=32); lng+=(r&1)?~(r>>1):(r>>1); out.push([lat/1e5,lng/1e5]); } return out; };
const SHEET = APC.SHEET = {s:46.85, n:47.98, w:-54.05, e:-52.55};

const ClipStart = L.Polygon.extend({_updatePath(){ const c=this._renderer._ctx; c.save(); c.beginPath(); for(const part of this._parts){ part.forEach((p,j)=>j?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y)); c.closePath(); } c.clip(); }});
const ClipEnd = L.Polygon.extend({_updatePath(){ this._renderer._ctx.restore(); }});

const TOWNS=[["St. John's",47.5615,-52.7126,8.5],["Paradise",47.5300,-52.8700,10],["Mount Pearl",47.5190,-52.8058,10],["Conception Bay South",47.5050,-52.9900,9.5],["Torbay",47.6640,-52.7330,10],["Portugal Cove–St. Philip's",47.6150,-52.8650,10.5],["Pouch Cove",47.7650,-52.7660,10],["Goulds",47.4590,-52.7760,11],["Bay Bulls",47.3150,-52.8100,10],["Witless Bay",47.2780,-52.8300,11],["Holyrood",47.3880,-53.1360,9.5],["Ferryland",47.0240,-52.8860,9.5],["Placentia Junction",47.3900,-53.6400,9.5],["Whitbourne",47.4210,-53.5300,10],["Bellevue",47.6380,-53.7800,10],["Spaniard's Bay",47.6200,-53.3350,10],["Bell Island",47.6400,-52.9500,10],["Flatrock",47.7090,-52.7250,11],["Bauline",47.7045,-52.8370,11],["Tors Cove",47.2150,-52.8480,11]];
const MAJOR = new Set(['Trans-Canada Highway','Outer Ring Road','Conception Bay Highway','Salmonier Line','Southern Shore Highway','Veterans Memorial Highway','Robert E. Howlett Memorial Drive']);

/* opts: mine (Set of pond ids Dad cleaned), onMine(id) click handler, highlight (id to draw thicker), names, grid */
APC.base = function(map, geo, opts={}){
  const decode = APC.decode, esc = APC.esc;
  [['sea',200],['land',210],['lakes',220],['grat',240],['frame',250],['names',580]].forEach(([n,z]) => { if(!map.getPane(n)) map.createPane(n).style.zIndex = z; });
  const seaR = L.canvas({pane:'sea', padding:.4}), landR = L.canvas({pane:'land', padding:.4});
  const onEdge = ([la,ln]) => Math.abs(la-SHEET.s)<2e-4||Math.abs(la-SHEET.n)<2e-4||Math.abs(ln-SHEET.w)<2e-4||Math.abs(ln-SHEET.e)<2e-4;
  const landRings = [...geo.land, ...Object.values(geo.islands).flat()].map(decode);
  const coast = [];
  for(const ring of landRings){ let cur=[]; for(let i=0;i<ring.length;i++){ const a=ring[i], b=ring[(i+1)%ring.length];
    if(onEdge(a)&&onEdge(b)){ if(cur.length>1) coast.push(cur); cur=[]; continue; } if(!cur.length) cur.push(a); cur.push(b); } if(cur.length>1) coast.push(cur); }
  const waterRings = [];
  const pondGeo = Object.entries(geo.ponds).map(([id,v]) => { const ll = v.polys.map(poly => poly.map(decode)); ll.forEach(poly => waterRings.push(poly[0])); return [id, ll]; });

  const G = {sea:L.layerGroup().addTo(map), land:L.layerGroup().addTo(map), lakes:L.layerGroup().addTo(map), mine:L.layerGroup().addTo(map), roads:L.layerGroup().addTo(map),
    grat:L.layerGroup().addTo(map), frame:L.layerGroup().addTo(map), names:L.layerGroup().addTo(map), pondNames:L.layerGroup()};
  const painted = []; const paint = (lyr,fn) => { lyr.setStyle(fn()); painted.push([lyr,fn]); return lyr; };
  const SEA_RINGS = [[36,'--m-rs3'],[33.5,'--m-sea'],[24,'--m-rs2'],[21.5,'--m-sea'],[13,'--m-rs1'],[10.5,'--m-sea']];
  const LAND_RINGS = [[50,'--m-rl4'],[47.5,'--m-land'],[37,'--m-rl3'],[34.5,'--m-land'],[25,'--m-rl2'],[22.5,'--m-land'],[13.5,'--m-rl1'],[11,'--m-land']];
  const line = (ll,r,w,c) => paint(L.polyline(ll,{renderer:r,interactive:false,lineJoin:'round',lineCap:'round',smoothFactor:1.5}), () => ({color:css(c),weight:w,opacity:1}));
  for(const [w,c] of SEA_RINGS) for(const l of coast) G.sea.addLayer(line(l,seaR,w,c));
  const landMulti = landRings.map(r => [r]);
  G.land.addLayer(paint(L.polygon(landMulti,{renderer:landR,interactive:false,stroke:false}), () => ({fillColor:css('--m-land'),fillOpacity:1})));
  G.land.addLayer(new ClipStart(landMulti,{renderer:landR,interactive:false}));
  for(const [w,c] of LAND_RINGS){ for(const l of coast) G.land.addLayer(line(l,landR,w,c)); for(const r of waterRings) G.land.addLayer(line([...r,r[0]],landR,w*.62,c)); }
  G.land.addLayer(new ClipEnd(landMulti,{renderer:landR,interactive:false}));
  for(const l of coast) G.land.addLayer(line(l,landR,1.5,'--m-coast'));

  const pondShapes = {};
  const mine = opts.mine || new Set();
  for(const [id,ll] of pondGeo){ const isMine = mine.has(id), hi = opts.highlight===id;
    const lyr = L.polygon(ll,{pane:'lakes',interactive:isMine&&!!opts.onMine});
    if(isMine){ paint(lyr, () => ({color:css('--blaze'),weight:hi?2.6:1.6,fillColor:css('--m-mine'),fillOpacity:1})); if(opts.onMine) lyr.on('click',() => opts.onMine(id)); G.mine.addLayer(lyr); pondShapes[id]=ll; }
    else G.lakes.addLayer(paint(lyr, () => ({color:css('--m-lake-edge'),weight:1,fillColor:css('--m-lake'),fillOpacity:1}))); }
  for(const [n,ls] of Object.entries(geo.roads)) for(const l of ls){ const big = MAJOR.has(n);
    G.roads.addLayer(paint(L.polyline(decode(l),{pane:'lakes',interactive:false}), () => ({color:css(big?'--m-road':'--m-road-2'),weight:big?2.2:1.3,opacity:.9,dashArray:big?null:'5 3'}))); }

  const sheetRing = [[SHEET.s,SHEET.w],[SHEET.n,SHEET.w],[SHEET.n,SHEET.e],[SHEET.s,SHEET.e]];
  G.frame.addLayer(paint(L.polygon([[[89,-179],[89,179],[-89,179],[-89,-179]],sheetRing],{pane:'frame',interactive:false,stroke:false}), () => ({fillColor:css('--m-margin'),fillOpacity:1})));
  G.frame.addLayer(paint(L.polygon(sheetRing,{pane:'frame',interactive:false,fill:false}), () => ({color:css('--m-coast'),weight:5,opacity:.8})));
  G.frame.addLayer(paint(L.polygon(sheetRing,{pane:'frame',interactive:false,fill:false}), () => ({color:css('--m-margin'),weight:2.6,opacity:1})));

  const lbl = (ll,html,cls,minZ,maxZ=99) => ({minZ,maxZ,m:L.marker(ll,{pane:'names',interactive:false,keyboard:false,icon:L.divIcon({className:'',iconSize:[0,0],html:`<div class="lbl ${cls}">${html}</div>`})})});
  const rot = (t,d) => `<span style="display:inline-block;transform:rotate(${d}deg)">${t}</span>`;
  const NAMES = [...TOWNS.map(([n,la,ln,z]) => lbl([la,ln],esc(n),'town'+(z>=10.5?' sm':''),z)),
    lbl([47.67,-53.09],rot('Conception<br>Bay',-58),'sealbl',8.5,12), lbl([47.86,-53.70],rot('Trinity Bay',-52),'sealbl',8.5,11.5),
    lbl([46.98,-53.74],rot('St. Mary’s Bay',-72),'sealbl',8.5,11.5), lbl([47.30,-52.64],rot('North Atlantic Ocean',-84),'sealbl',8.5,11),
    lbl([47.16,-53.30],'Avalon Peninsula','peninsula',8.5,10.5)];
  for(const p of (opts.pondLabels||[])) G.pondNames.addLayer(L.marker([p.lat,p.lng],{pane:'names',interactive:false,keyboard:false,icon:L.divIcon({className:'',iconSize:[0,0],html:`<div class="lbl pondname">${esc(p.name)}</div>`})}));

  const st = {names: opts.names!==false, grid: opts.grid!==false, pondNames: true};
  function updateNames(){ const z=map.getZoom(); G.names.clearLayers(); if(st.names) NAMES.forEach(n => { if(z>=n.minZ&&z<n.maxZ) G.names.addLayer(n.m); });
    const want = st.names && st.pondNames && z>=14; want?map.addLayer(G.pondNames):map.removeLayer(G.pondNames); }
  function drawGrat(){ G.grat.clearLayers(); if(!st.grid) return; const z=map.getZoom();
    const step = z<9.5?1/6:z<11?1/12:z<12.5?1/30:1/60; const vb = map.getBounds();
    const s=Math.max(SHEET.s,vb.getSouth()), n=Math.min(SHEET.n,vb.getNorth()), w=Math.max(SHEET.w,vb.getWest()), e=Math.min(SHEET.e,vb.getEast());
    if(s>=n||w>=e) return; const sty = {pane:'grat',interactive:false,color:css('--m-grid'),weight:.8,opacity:.38,dashArray:'4 5'};
    const corner = map.latLngToContainerPoint([n,w]);
    const mk = (pt,html) => L.marker(map.containerPointToLatLng(pt),{pane:'grat',interactive:false,keyboard:false,icon:L.divIcon({className:'',iconSize:[0,0],html})});
    for(let la=Math.ceil(s/step-1e-9)*step; la<=n; la+=step){ G.grat.addLayer(L.polyline([[la,w],[la,e]],sty)); const y=map.latLngToContainerPoint([la,w]).y; if(y>corner.y+14) G.grat.addLayer(mk([corner.x+6,y],`<div class="gl lat">${APC.dm(la,'N','S')}</div>`)); }
    let lastX = -1e9;
    for(let ln=Math.ceil(w/step-1e-9)*step; ln<=e; ln+=step){ G.grat.addLayer(L.polyline([[s,ln],[n,ln]],sty)); const x=map.latLngToContainerPoint([n,ln]).x; if(x>corner.x+60&&x-lastX>90){ lastX=x; G.grat.addLayer(mk([x,corner.y+5],`<div class="gl">${APC.dm(ln,'E','W')}</div>`)); } }
  }
  map.on('zoomend', updateNames); map.on('moveend', drawGrat);
  const repaint = () => { painted.forEach(([l,fn]) => l.setStyle(fn())); drawGrat(); };
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', repaint);
  updateNames(); drawGrat();
  return {G, pondShapes, updateNames, drawGrat,
    set(k,v){ st[k]=v; if(k==='grid') drawGrat(); else updateNames(); },
    toggle(group,on){ on?map.addLayer(G[group]):map.removeLayer(G[group]); }};
};

APC.attribution = map => map.attributionControl.setPrefix(false).addAttribution('Map data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> · Names: CGNDB');

APC.rose = function(svg){ let s=''; const P=(a,r)=>[Math.sin(a*Math.PI/180)*r,-Math.cos(a*Math.PI/180)*r].map(v=>v.toFixed(2)).join(',');
  s+=`<circle r="34" fill="var(--m-sea)" fill-opacity=".55" stroke="var(--m-coast)" stroke-width="1"/><circle r="30.5" fill="none" stroke="var(--m-coast)" stroke-width=".5" stroke-dasharray="2 2"/>`;
  for(let a=0;a<360;a+=10) s+=`<path d="M${P(a,31.5)}L${P(a,a%30?33:34)}" stroke="var(--m-coast)" stroke-width=".7"/>`;
  for(const [a,Ln,w] of [[45,24,5],[135,24,5],[225,24,5],[315,24,5],[0,46,7.5],[90,40,7.5],[180,40,7.5],[270,40,7.5]])
    s+=`<path d="M0,0L${P(a,Ln)}L${P(a+45,w)}Z" fill="var(--m-coast)"/><path d="M0,0L${P(a,Ln)}L${P(a-45,w)}Z" fill="var(--m-land)" stroke="var(--m-coast)" stroke-width=".8" stroke-linejoin="round"/>`;
  s+=`<circle r="2.4" fill="var(--blaze)"/><text y="-47" text-anchor="middle" font-family="Barlow Semi Condensed,Arial Narrow,sans-serif" font-weight="700" font-size="13" fill="var(--blaze)">N</text>`;
  svg.innerHTML = s; };

APC.scale = function(map, el){
  function upd(){ const c=map.getCenter(); const mpp=40075016.686*Math.cos(c.lat*Math.PI/180)/Math.pow(2,map.getZoom()+8);
    const maxM=mpp*130, p=Math.pow(10,Math.floor(Math.log10(maxM))), nice=[5,2,1].map(k=>k*p).find(v=>v<=maxM)||p, px=nice/mpp, km=nice>=1000, u=v=>km?String(v/1000):String(v);
    const xy = el.querySelector('.xy')?.textContent || '';
    el.innerHTML = `<div class="bars" style="width:${px.toFixed(0)}px"><i></i><i></i><i></i><i></i></div><div class="ticks" style="width:${(px+12).toFixed(0)}px;margin-left:-5px"><span>0</span><span>${u(nice/2)}</span><span>${u(nice)} ${km?'km':'m'}</span></div><div class="xy">${xy}</div>`; }
  map.on('zoomend moveend', upd); upd();
  map.on('mousemove', e => { const x=el.querySelector('.xy'); if(x) x.textContent=`${APC.dms(e.latlng.lat,'N','S')}  ${APC.dms(e.latlng.lng,'E','W')}`; });
};

/* Pond outline sketch with its own echo lines (used in the panel and on pond pages) */
APC.shapeSVG = function(ll, name){ if(!ll) return ''; const pts=ll.flat(2); let a=1e9,b=-1e9,c=1e9,d=-1e9;
  const P=pts.map(([la,ln])=>{ const x=ln*Math.cos(la*Math.PI/180), y=-la; a=Math.min(a,x);b=Math.max(b,x);c=Math.min(c,y);d=Math.max(d,y); return [x,y]; });
  const w=b-a||1e-6, h=d-c||1e-6, sc=Math.min(260/w,92/h), ox=(320-w*sc)/2, oy=(136-h*sc)/2; let k=0;
  const path=ll.map(poly=>poly.map(ring=>'M'+ring.map(()=>{ const [x,y]=P[k++]; return ((x-a)*sc+ox).toFixed(1)+','+((y-c)*sc+oy).toFixed(1);}).join('L')+'Z').join(' ')).join(' ');
  const km=Math.max(w,h)*111.32, len=km<1?`${Math.round(km*100)*10} m`:`${km.toFixed(1)} km`;
  const echo=[[22,'--m-rl4'],[19.5,'--m-land'],[14,'--m-rl3'],[11.5,'--m-land'],[6,'--m-rl1'],[3.5,'--m-land']].map(([sw,col])=>`<path d="${path}" fill="none" stroke="var(${col})" stroke-width="${sw}" stroke-linejoin="round"/>`).join('');
  return `<div class="shapebox"><svg class="shape" viewBox="0 0 320 136" role="img" aria-label="Outline of ${APC.esc(name)}">${echo}<path d="${path}" fill="var(--m-mine)" stroke="var(--blaze)" stroke-width="1.6" fill-rule="evenodd"/></svg><span class="n">N ↑</span><span class="cap">About ${len} end to end</span></div>`; };
})();
