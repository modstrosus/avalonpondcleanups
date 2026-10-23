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
const AV = APC.AVALON = {s:46.85, n:47.98, w:-54.05, e:-52.55};   // the Avalon detail data was clipped to this box

const ClipStart = L.Polygon.extend({_updatePath(){ const c=this._renderer._ctx; c.save(); c.beginPath(); for(const part of this._parts){ part.forEach((p,j)=>j?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y)); c.closePath(); } c.clip(); }});
const ClipEnd = L.Polygon.extend({_updatePath(){ this._renderer._ctx.restore(); }});

const TOWNS=[["St. John's",47.5615,-52.7126,8.5],["Paradise",47.5300,-52.8700,10],["Mount Pearl",47.5190,-52.8058,10],["Conception Bay South",47.5050,-52.9900,9.5],["Torbay",47.6640,-52.7330,10],["Portugal Cove–St. Philip's",47.6150,-52.8650,10.5],["Pouch Cove",47.7650,-52.7660,10],["Goulds",47.4590,-52.7760,11],["Bay Bulls",47.3150,-52.8100,10],["Witless Bay",47.2780,-52.8300,11],["Holyrood",47.3880,-53.1360,9.5],["Ferryland",47.0240,-52.8860,9.5],["Placentia Junction",47.3900,-53.6400,9.5],["Whitbourne",47.4210,-53.5300,10],["Bellevue",47.6380,-53.7800,10],["Spaniard's Bay",47.6200,-53.3350,10],["Bell Island",47.6400,-52.9500,10],["Flatrock",47.7090,-52.7250,11],["Bauline",47.7045,-52.8370,11],["Tors Cove",47.2150,-52.8480,11]];
const NL_TOWNS=[["Corner Brook",48.9411,-57.9703,6],["Gander",48.9572,-54.5886,6.5],["Grand Falls-Windsor",48.964,-55.6644,6.5],["Twillingate",49.6443,-54.7436,7],["Lewisporte",49.2418,-55.046,8],["Clarenville",48.1881,-54.0557,7.5],["Deer Lake",49.195,-57.3897,7.5],["Stephenville",48.5476,-58.5476,7],["Channel-Port aux Basques",47.5956,-59.1353,7],["St. Anthony",51.3749,-55.6164,7],["Bonavista",48.6318,-53.1041,7.5],["Marystown",47.155,-55.1644,7.5],["Happy Valley-Goose Bay",53.3417,-60.4488,5.5],["Labrador City",52.9606,-66.9366,5.5],["Nain",56.536,-61.719,6],["Botwood",49.1356,-55.3732,8],["Baie Verte",49.9087,-56.1947,8],["Springdale",49.5119,-56.0643,8],["Burgeo",47.6199,-57.6216,8],["Harbour Breton",47.4775,-55.824,8],["Gambo",48.7971,-54.2125,8.5],["Fogo Island",49.6583,-54.1825,8],["Rocky Harbour",49.594,-57.919,8],["Port Saunders",50.662,-57.254,8],["Cartwright",53.694,-56.97,6.5],["Forteau",51.492,-56.948,7.5],["Grand Bank",47.089,-55.755,8],["Glovertown",48.691,-54.035,8.5],["Summerford",49.497,-54.783,9],["Wabush",52.872,-66.891,7.5],["Churchill Falls",53.532,-64.008,6.5],["Hopedale",55.461,-60.233,6.5],["Musgrave Harbour",49.417,-53.964,8.5],["Makkovik",55.047,-59.203,7],["Eastport",48.6647,-53.7676,9],["Burin",47.0828,-55.1753,8.5],["Placentia",47.2705,-53.9051,8.5],["Arnold's Cove",47.7689,-53.9918,9],["Herring Neck",49.6367,-54.6175,10]];
const MAJOR = new Set(['Trans-Canada Highway','Outer Ring Road','Conception Bay Highway','Salmonier Line','Southern Shore Highway','Veterans Memorial Highway','Robert E. Howlett Memorial Drive']);

/* opts: mine (Set of pond ids Dad cleaned), onMine(id) click handler, highlight (id to draw thicker), names, grid */
APC.base = function(map, geo, opts={}){
  const decode = APC.decode, esc = APC.esc;
  [['sea',200],['land',210],['lakes',220],['grat',240],['frame',250],['names',580]].forEach(([n,z]) => { if(!map.getPane(n)) map.createPane(n).style.zIndex = z; });
  const seaR = L.canvas({pane:'sea', padding:.4}), landR = L.canvas({pane:'land', padding:.4});
  const nl = geo.nl || null;
  const FRAME = nl ? nl.sheet : AV;
  const onEdge = ([la,ln]) => Math.abs(la-AV.s)<2e-4||Math.abs(la-AV.n)<2e-4||Math.abs(ln-AV.w)<2e-4||Math.abs(ln-AV.e)<2e-4;
  const landRings = [...geo.land, ...Object.values(geo.islands).flat()].map(decode);
  const coast = [];
  for(const ring of landRings){ let cur=[]; for(let i=0;i<ring.length;i++){ const a=ring[i], b=ring[(i+1)%ring.length];
    if(onEdge(a)&&onEdge(b)){ if(cur.length>1) coast.push(cur); cur=[]; continue; } if(!cur.length) cur.push(a); cur.push(b); } if(cur.length>1) coast.push(cur); }
  // the rest of Newfoundland and Labrador: each piece is [ring, gaps]; gaps are runs of segments that are not coastline
  // (seams against the Avalon detail, the map edge, or the land border with Quebec)
  if(nl) for(const [enc, gaps] of nl.land){ const r = decode(enc); landRings.push(r); const n = r.length;
    const bad = i => (gaps||[]).some(([a,b]) => i>=a && i<b); let cur=[];
    for(let i=0;i<n;i++){ if(bad(i)){ if(cur.length>1) coast.push(cur); cur=[]; continue; } if(!cur.length) cur.push(r[i]); cur.push(r[(i+1)%n]); }
    if(cur.length>1) coast.push(cur); }
  if(nl) for(const [k,v] of Object.entries(nl.ponds||{})) if(!geo.ponds[k]) geo.ponds[k]=v;
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
  if(nl) for(const rs of Object.values(nl.neighbours)) for(const r of rs){ const ll = decode(r);
    G.land.addLayer(paint(L.polygon(ll,{renderer:landR,interactive:false}), () => ({stroke:true,color:css('--m-other-edge'),weight:1,fillColor:css('--m-other'),fillOpacity:1}))); }
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
  if(nl){ for(const polys of Object.values(nl.lakes)) for(const poly of polys){ const ll = poly.map(decode); if(!ll.length) continue;
      G.lakes.addLayer(paint(L.polygon(ll,{pane:'lakes',interactive:false}), () => ({color:css('--m-lake-edge'),weight:1,fillColor:css('--m-lake'),fillOpacity:1}))); }
    for(const b of nl.border||[]) G.roads.addLayer(paint(L.polyline(decode(b),{pane:'lakes',interactive:false}), () => ({color:css('--m-label-2'),weight:1.2,opacity:.7,dashArray:'8 4 2 4'})));
    for(const [n,ls] of Object.entries(nl.roads||{})) for(const l of ls) G.roads.addLayer(paint(L.polyline(decode(l),{pane:'lakes',interactive:false}), () => ({color:css('--m-road'),weight:n==='Route 340'?1.8:2.2,opacity:.9}))); }
  for(const [n,ls] of Object.entries(geo.roads)) for(const l of ls){ const big = MAJOR.has(n);
    G.roads.addLayer(paint(L.polyline(decode(l),{pane:'lakes',interactive:false}), () => ({color:css(big?'--m-road':'--m-road-2'),weight:big?2.2:1.3,opacity:.9,dashArray:big?null:'5 3'}))); }

  const sheetRing = [[FRAME.s,FRAME.w],[FRAME.n,FRAME.w],[FRAME.n,FRAME.e],[FRAME.s,FRAME.e]];
  G.frame.addLayer(paint(L.polygon([[[89,-179],[89,179],[-89,179],[-89,-179]],sheetRing],{pane:'frame',interactive:false,stroke:false}), () => ({fillColor:css('--m-margin'),fillOpacity:1})));
  G.frame.addLayer(paint(L.polygon(sheetRing,{pane:'frame',interactive:false,fill:false}), () => ({color:css('--m-coast'),weight:5,opacity:.8})));
  G.frame.addLayer(paint(L.polygon(sheetRing,{pane:'frame',interactive:false,fill:false}), () => ({color:css('--m-margin'),weight:2.6,opacity:1})));

  const lbl = (ll,html,cls,minZ,maxZ=99) => ({minZ,maxZ,m:L.marker(ll,{pane:'names',interactive:false,keyboard:false,icon:L.divIcon({className:'',iconSize:[0,0],html:`<div class="lbl ${cls}">${html}</div>`})})});
  const rot = (t,d) => `<span style="display:inline-block;transform:rotate(${d}deg)">${t}</span>`;
  const NAMES = [...TOWNS.map(([n,la,ln,z]) => lbl([la,ln],esc(n),'town'+(z>=10.5?' sm':''),z)),
    lbl([47.67,-53.09],rot('Conception<br>Bay',-58),'sealbl',8.5,12), lbl([47.86,-53.70],rot('Trinity Bay',-52),'sealbl',8.5,11.5),
    lbl([46.98,-53.74],rot('St. Mary’s Bay',-72),'sealbl',8.5,11.5), lbl([47.30,-52.64],rot('North Atlantic Ocean',-84),'sealbl',8.5,11),
    lbl([47.16,-53.30],'Avalon Peninsula','peninsula',7.5,10.5),
    ...(nl ? [
      ...NL_TOWNS.map(([n,la,ln,z]) => lbl([la,ln],esc(n),'town'+(z>=8?' sm':''),z)),
      lbl([48.75,-56.2],'Newfoundland','region',5,7.5), lbl([54.2,-62.2],'Labrador','region',4,7.5),
      lbl([52.6,-70.2],'Québec','other',4,8), lbl([46.05,-60.9],'Nova Scotia','other',5,8),
      lbl([46.85,-56.35],rot('St-Pierre-et-Miquelon<br>(France)',0),'other sm',7,10),
      lbl([48.4,-60.4],rot('Gulf of St. Lawrence',-20),'sealbl',5,8.5), lbl([56.6,-57.4],rot('Labrador Sea',-30),'sealbl',4,7.5),
      lbl([48.9,-51.9],rot('North Atlantic Ocean',-70),'sealbl',5,8.5), lbl([49.68,-55.05],'Notre Dame Bay','sealbl',7,10.5),
      lbl([48.82,-53.45],'Bonavista Bay','sealbl',7,10), lbl([47.25,-54.45],rot('Placentia Bay',-70),'sealbl',7,10),
      lbl([47.45,-55.7],'Fortune Bay','sealbl',7.5,10), lbl([50.05,-56.65],rot('White Bay',-60),'sealbl',7.5,10),
      lbl([51.25,-56.95],rot('Strait of Belle Isle',38),'sealbl',6.5,9), lbl([47.25,-59.6],rot('Cabot Strait',-35),'sealbl',6,8.5),
      lbl([48.45,-58.85],rot('St. George’s Bay',-30),'sealbl',7.5,10), lbl([53.75,-59.3],rot('Lake Melville',-20),'sealbl lake',6.5,9),
      lbl([47.95,-54.5],rot('Burin Peninsula',-60),'peninsula',7.5,9.5), lbl([50.6,-56.95],rot('Great Northern Peninsula',-55),'peninsula',6.5,8.5),
    ] : [])];
  for(const p of (opts.pondLabels||[])) G.pondNames.addLayer(L.marker([p.lat,p.lng],{pane:'names',interactive:false,keyboard:false,icon:L.divIcon({className:'',iconSize:[0,0],html:`<div class="lbl pondname">${esc(p.name)}</div>`})}));

  const st = {names: opts.names!==false, grid: opts.grid!==false, pondNames: true};
  function updateNames(){ const z=map.getZoom(); G.names.clearLayers(); if(st.names) NAMES.forEach(n => { if(z>=n.minZ&&z<n.maxZ) G.names.addLayer(n.m); });
    const want = st.names && st.pondNames && z>=14; want?map.addLayer(G.pondNames):map.removeLayer(G.pondNames); }
  function drawGrat(){ G.grat.clearLayers(); if(!st.grid) return; const z=map.getZoom();
    const step = z<6?2:z<7?1:z<8?.5:z<9.5?1/6:z<11?1/12:z<12.5?1/30:1/60; const vb = map.getBounds();
    const s=Math.max(FRAME.s,vb.getSouth()), n=Math.min(FRAME.n,vb.getNorth()), w=Math.max(FRAME.w,vb.getWest()), e=Math.min(FRAME.e,vb.getEast());
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
  return {G, pondShapes, updateNames, drawGrat, frame:FRAME,
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
