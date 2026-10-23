/* Photo viewer + "read more" for post lists. Thumbnails are plain links to the full photo,
   so everything works without JavaScript; with it, they open in a swipeable viewer. */
(function(){
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
let lb = null, lastFocus = null;
function open(photos, start, title, extra){
  if(!lb){ lb = document.createElement('div'); lb.className='lb'; lb.hidden=true; lb.setAttribute('role','dialog'); lb.setAttribute('aria-modal','true'); lb.setAttribute('aria-label','Photo viewer'); document.body.appendChild(lb); }
  lastFocus = document.activeElement;
  lb.innerHTML = `<div class="lb-top"><span>${esc(title)}</span><button type="button" class="lb-x" aria-label="Close photos">×</button></div>
    <div class="lb-track" tabindex="0">${photos.map(p=>`<div class="lb-slide"><img alt="${esc(p.alt)}" src="${esc(p.src)}" ${p.w?`width="${p.w}" height="${p.h}"`:''} decoding="async"></div>`).join('')}</div>
    <div class="lb-cap" aria-live="polite"></div>
    ${photos.length>1?'<button class="lb-nav prev" type="button" aria-label="Previous photo">‹</button><button class="lb-nav next" type="button" aria-label="Next photo">›</button>':''}`;
  lb.hidden = false; document.documentElement.style.overflow='hidden';
  const tr = lb.querySelector('.lb-track'), cap = lb.querySelector('.lb-cap');
  const idx = () => Math.round(tr.scrollLeft / tr.clientWidth);
  const go = i => tr.scrollTo({left:Math.max(0,Math.min(photos.length-1,i))*tr.clientWidth, behavior:'smooth'});
  const upd = () => { cap.textContent = `${idx()+1} of ${photos.length}` + (extra||''); };
  requestAnimationFrame(() => { tr.scrollLeft = start*tr.clientWidth; upd(); tr.focus(); });
  tr.addEventListener('scroll', () => requestAnimationFrame(upd));
  lb.querySelector('.prev')?.addEventListener('click', () => go(idx()-1));
  lb.querySelector('.next')?.addEventListener('click', () => go(idx()+1));
  const close = () => { lb.hidden=true; lb.innerHTML=''; document.documentElement.style.overflow=''; lastFocus?.focus?.(); };
  lb.querySelector('.lb-x').onclick = close;
  lb.onkeydown = e => { if(e.key==='Escape') close(); if(e.key==='ArrowRight') go(idx()+1); if(e.key==='ArrowLeft') go(idx()-1); };
}
/* Wire up a container holding rendered .post articles */
function wire(root){
  root.querySelectorAll('.post').forEach(post => {
    const t = post.querySelector('.txt');
    if(t && t.textContent.length > 340 && !post.querySelector('.readmore')){ t.classList.add('more-hidden');
      const b = document.createElement('button'); b.type='button'; b.className='readmore'; b.textContent='Read more';
      b.onclick = () => { t.classList.remove('more-hidden'); b.remove(); }; t.after(b); }
  });
  root.addEventListener('click', e => {
    const a = e.target.closest('.grid a'); if(!a || !root.contains(a)) return;
    e.preventDefault(); const post = a.closest('.post'); const links=[...post.querySelectorAll('.grid a')];
    open(links.map(l=>({src:l.getAttribute('href'), alt:l.querySelector('img')?.alt||'', w:l.dataset.w, h:l.dataset.h})), links.indexOf(a), post.dataset.title||'', post.dataset.more?` · ${post.dataset.more} more on Facebook`:'');
  });
}
window.APCViewer = {open, wire};
})();
