/* Pond page: the small locator map and the photo viewer */
(async function(){
const posts = document.querySelector('#posts'); if(posts) APCViewer.wire(posts);
const el = document.getElementById('minimap'); if(!el) return;
const id = el.dataset.id, lat = +el.dataset.lat, lng = +el.dataset.lng, kind = el.dataset.kind;
let geo; try{ geo = await fetch('/data/map.json').then(r=>r.json()); }catch(e){ return; }
const map = L.map(el,{zoomControl:true,scrollWheelZoom:false,minZoom:5,maxZoom:16,zoomSnap:.5,attributionControl:true});
APC.attribution(map);
const outline = kind==='pond' && geo.ponds[id] ? geo.ponds[id].polys.flat().map(APC.decode).flat() : null;
if(outline && outline.length) map.fitBounds(L.latLngBounds(outline).pad(1.2), {maxZoom:15});
else map.setView([lat,lng], 13);
APC.base(map, geo, {mine:new Set(kind==='pond'?[id]:[]), highlight:id, grid:true});
const s = kind==='pond' ? 22 : 17;
L.marker([lat,lng],{keyboard:false,interactive:false,icon:L.divIcon({className:'',iconSize:[s,s],iconAnchor:[s/2,s/2],html:`<div class="pin ${kind==='pond'?'':'area'}" style="width:${s}px;height:${s}px"></div>`})}).addTo(map);
})();
