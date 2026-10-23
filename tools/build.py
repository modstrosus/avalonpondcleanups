#!/usr/bin/env python3
"""Build the Avalon Pond Cleanups site into ./public

Standard library only, so it runs anywhere (including Cloudflare Pages' build step):
    python3 tools/build.py

Inputs (edit these, then rebuild):
    site.json             site settings (address, headline totals, public/private switch)
    data/places.json      every pond and area pin
    data/cleanups.json    every cleanup post, linked to one or more places
    data/map.json         basemap linework
    content/about.html    the About page text
    media/photos, media/thumbs, media/og   web photos, thumbnails, social preview images
    assets/               CSS and JavaScript
"""
import json, os, shutil, html, datetime, re, collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public')
J = lambda p: json.load(open(os.path.join(ROOT, p), encoding='utf-8'))
site = J('site.json'); places = J('data/places.json'); cleanups = J('data/cleanups.json')
byid = {p['id']: p for p in places}
e = lambda s: html.escape(str(s if s is not None else ''), quote=True)
BUILD = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d%H%M')

KIND_LABEL = {'pond': 'Pond cleanup', 'shore': 'Shoreline / trail', 'finds': 'Finds', 'others': 'Someone else’s cleanup', 'other': 'Update'}
def counts_for(p, c): return c['kind'] == 'pond' if p['kind'] == 'pond' else c['kind'] in ('shore', 'others')
def nice_date(c):
    if c['approx'] or not c['iso']: return c['date']
    d = datetime.date.fromisoformat(c['iso']); return f"{d:%B} {d.day}, {d.year}"
def dms(v, pos, neg):
    h = neg if v < 0 else pos; v = abs(v); d = int(v); mf = (v - d) * 60; m = int(mf); s = min(59, round((mf - m) * 60))
    return f"{d}°{m:02d}′{s:02d}″{h}"

by_place = collections.defaultdict(list)
for c in cleanups:
    for pid in c['places']:
        if pid in byid: by_place[pid].append(c)
def sort_key(c): return (c['iso'] or '2018-07-01', c['n'])
for pid in by_place: by_place[pid].sort(key=sort_key, reverse=True)

def summary(p):
    cs = by_place.get(p['id'], []); rel = [c for c in cs if counts_for(p, c)]
    isos = sorted(c['iso'] for c in cs if c['iso'])
    cover = next((c['photos'][0]['file'] for c in cs if c['photos'] and c['kind'] in ('pond', 'shore', 'finds')), None)
    return dict(n=len(rel), first=isos[0] if isos else None, last=isos[-1] if isos else None, cover=cover, posts=len(cs))
SUM = {p['id']: summary(p) for p in places}

# ---------- page shell ----------
FONTS = 'https://fonts.googleapis.com/css2?family=Barlow+Semi+Condensed:wght@400;500;600;700&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;0,8..60,700;1,8..60,400;1,8..60,600&display=swap'
LEAFLET = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4'
CLUSTER = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet.markercluster/1.5.3'
def head(title, desc, path, og=None, css=()):
    url = site['url'].rstrip('/') + path
    img = site['url'].rstrip('/') + (og or '/og/default.jpg')
    robots = '' if site.get('public') else '<meta name="robots" content="noindex,nofollow">\n'
    links = ''.join(f'<link rel="stylesheet" href="{h}">\n' for h in css)
    return f'''<!doctype html>
<html lang="en-CA">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{e(title)}</title>
<meta name="description" content="{e(desc)}">
{robots}<link rel="canonical" href="{e(url)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="{e(site['title'])}">
<meta property="og:title" content="{e(title)}">
<meta property="og:description" content="{e(desc)}">
<meta property="og:url" content="{e(url)}">
<meta property="og:image" content="{e(img)}">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#283825">
<link rel="icon" href="/assets/icon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="{FONTS}">
<link rel="stylesheet" href="{LEAFLET}/leaflet.min.css">
<link rel="stylesheet" href="/assets/site.css?v={BUILD}">
{links}</head>
'''
def topbar(current):
    nav = [('Map', '/'), ('Timeline', '/timeline/'), ('About', '/about/')]
    cur = ' aria-current="page"'
    items = ''.join(f'<a href="{h}"{cur if current == h else ""}>{t}</a>' for t, h in nav)
    return f'<a class="skip" href="#main">Skip to content</a><header class="topbar"><div class="in"><a class="home" href="/">{e(site["title"])}</a><nav aria-label="Site">{items}</nav></div></header>'
def foot():
    return f'''<footer class="foot">Every cleanup here was first posted on <a href="{e(site['facebook'])}" rel="noopener">the Avalon Pond Cleanups Facebook page</a>.
 Map data © <a href="https://www.openstreetmap.org/copyright" rel="noopener">OpenStreetMap</a> contributors; names from the Canadian Geographical Names Database.</footer>'''
SCRIPTS_MAP = f'<script src="{LEAFLET}/leaflet.js"></script>\n'

def write(path, text):
    full = os.path.join(OUT, path.lstrip('/'))
    os.makedirs(os.path.dirname(full), exist_ok=True)
    open(full, 'w', encoding='utf-8').write(text)

# ---------- posts ----------
def post_html(p, c):
    date = nice_date(c); title = f"{p['name']} · {date}"
    tags = f'<span class="tag {c["kind"]}">{KIND_LABEL.get(c["kind"], "Update")}</span>'
    if c.get('cleanupNumber'): tags += f'<span class="tag">#{e(c["cleanupNumber"])} that season</span>'
    others = [byid[i] for i in c['places'] if i != p['id'] and i in byid]
    links = ', '.join('<a href="/ponds/%s/">%s</a>' % (o['id'], e(o['name'])) for o in others)
    also = f'<div class="also">Also at: {links}</div>' if others else ''
    grid = ''
    if c['photos']:
        imgs = []
        for i, ph in enumerate(c['photos']):
            tw = 360 if ph['w'] >= ph['h'] else round(360 * ph['w'] / ph['h']); th = round(tw * ph['h'] / ph['w'])
            imgs.append(f'<a href="/photos/{ph["file"]}.webp" data-w="{ph["w"]}" data-h="{ph["h"]}"><img src="/photos/thumbs/{ph["file"]}.webp" width="{tw}" height="{th}" loading="lazy" decoding="async" alt="Photo {i + 1} of {len(c["photos"])} from the {e(p["name"])} post, {e(date)}"></a>')
        grid = f'<div class="grid">{"".join(imgs)}</div>'
    more = f'<div class="fb">+{c["morePhotosOnFacebook"]} more photo{"s" if c["morePhotosOnFacebook"] > 1 else ""} on Facebook</div>' if c.get('morePhotosOnFacebook') else ''
    fb = f'<div class="fb"><a href="{e(c["facebook"])}" target="_blank" rel="noopener">See the post on Facebook ↗</a></div>' if c.get('facebook') else ''
    txt = f'<div class="txt">{e(c["text"])}</div>' if c['text'] else ''
    return (f'<article class="post" id="post-{c["n"]}" data-title="{e(title)}" data-more="{c.get("morePhotosOnFacebook") or ""}">'
            f'<div class="post-meta"><time datetime="{e(c["iso"] or "")}">{e(date)}</time>{tags}</div>{txt}{also}{grid}{more}{fb}</article>')

# ---------- pond / place pages ----------
def place_page(p):
    s = SUM[p['id']]; cs = by_place.get(p['id'], []); isPond = p['kind'] == 'pond'
    word = 'cleanup' if s['n'] == 1 else 'cleanups'
    since = f" since {s['first'][:4]}" if s['first'] else ''
    desc = f"{p['name']}{', ' + p['where'] if p['where'] else ''}: {s['n']} {word}{since}, with photos of what came out."
    og = f"/og/{p['id']}.jpg" if os.path.exists(os.path.join(ROOT, 'media/og', p['id'] + '.jpg')) else None
    facts = (f'<div class="facts"><div class="fact"><b>{s["n"]}</b><span>{word} posted</span></div>'
             f'<div class="fact"><b>{(s["first"] or "—")[:4]}</b><span>first visit</span></div>'
             f'<div class="fact"><b>{(s["last"] or "—")[:4]}</b><span>latest visit</span></div></div>')
    coords = f'<div class="coords">{dms(p["lat"], "N", "S")} · {dms(p["lng"], "E", "W")}</div>' if p['lat'] < 48.5 else ''
    note = '<div class="note">This pin’s position is still being confirmed.</div>' if p['status'] == 'to-confirm' else ''
    if p['lat'] >= 48.5: note += '<div class="note">This pond is near Twillingate, off the edge of the Avalon map.</div>'
    body = f'''{head(f"{p['name']} — {site['title']}", desc, f"/ponds/{p['id']}/", og)}<body>
{topbar('')}
<main class="page" id="main">
<a class="backlink" href="/#{p['id']}">← Back to the map</a>
<div class="kicker{'' if isPond else ' area'}">{'Pond' if isPond else 'Beach, trail &amp; roadside'}</div>
<h1>{e(p['name'])}</h1>
{f'<p class="lede">{e(p["where"])}</p>' if p['where'] else ''}
<div class="pond-layout">
 <aside class="pond-side">
  <div class="minimap" id="minimap" data-id="{p['id']}" data-lat="{p['lat']}" data-lng="{p['lng']}" data-kind="{p['kind']}" role="img" aria-label="Map showing where {e(p['name'])} is"></div>
  <div class="share-row"><a class="card btn" href="/#{p['id']}">See it on the big map</a></div>
 </aside>
 <div class="pond-main">
  <div id="pond-facts">{facts}{coords}{note}</div>
  <section id="posts" aria-label="Posts">{''.join(post_html(p, c) for c in cs)}</section>
 </div>
</div>
</main>
{foot()}
{SCRIPTS_MAP}<script src="/assets/basemap.js?v={BUILD}"></script><script src="/assets/viewer.js?v={BUILD}"></script><script src="/assets/pond.js?v={BUILD}"></script>
</body></html>'''
    write(f"ponds/{p['id']}/index.html", body)

# ---------- home ----------
def home_page():
    t = site['totals']
    desc = f"A map of every pond, beach and trail cleaned up on the Avalon Peninsula: {t['cleanups']} pond cleanups since {t['since']}, with the photos."
    body = f'''{head(site['title'], desc, '/', None, ['/assets/home.css?v=' + BUILD])}<body class="home">
<div id="map" role="region" aria-label="Map of cleanups on the Avalon Peninsula"></div>
<div class="loading" id="loading">Loading the map…</div>
<div class="left">
  <header class="card cartouche">
    {'' if site.get('public') else '<span class="stamp">Preview</span>'}
    <h1>{e(site['title'])}</h1>
    <p class="sub">Ponds, beaches &amp; trails cleaned by kayak and on foot · Avalon Peninsula, Newfoundland</p>
    <div class="stats" id="stats"><span><b>{t['cleanups']}</b> pond cleanups</span><span>since <b>{t['since']}</b></span></div>
    <nav aria-label="Site"><a href="/timeline/">Timeline</a><a href="/about/">About</a></nav>
  </header>
  <section class="card legend" id="legend" aria-label="Legend and map layers">
    <button class="leg-h" type="button" id="legH" aria-expanded="true" aria-controls="legBody"><span>Legend</span><span class="chev" aria-hidden="true">▾</span><span class="leg-close only-phone" aria-hidden="true">✕</span></button>
    <div class="leg-body" id="legBody"></div>
  </section>
</div>
<div class="right">
  <button class="card btn" id="openList" type="button">Gazetteer</button>
  <button class="card btn only-phone" id="openLegend" type="button" aria-controls="legend">Legend</button>
  <div class="card zoom"><button type="button" id="zin" aria-label="Zoom in">+</button><button type="button" id="zout" aria-label="Zoom out">−</button></div>
</div>
<div class="furniture" aria-hidden="true"><svg class="rose" id="rose" viewBox="-58 -58 116 116"></svg><div class="scale" id="scale"></div></div>
<aside class="sheet" id="sheet" aria-live="polite" hidden></aside>
<section class="list" id="list" hidden aria-label="Gazetteer of ponds">
  <div class="list-head"><div class="row"><h2>Gazetteer</h2><button class="card btn" id="closeList" type="button">Back to map</button></div>
  <input class="search" id="q" type="search" placeholder="Search a pond or town" aria-label="Search a pond or town" autocomplete="off"></div>
  <div class="list-body" id="listBody"></div>
</section>
<noscript><div class="page" style="position:relative;z-index:2000;background:var(--paper)"><p>The map needs JavaScript. You can still browse every cleanup on the <a href="/timeline/">timeline</a>.</p></div></noscript>
{SCRIPTS_MAP}<script src="{CLUSTER}/leaflet.markercluster.js"></script>
<script src="/assets/basemap.js?v={BUILD}"></script><script src="/assets/viewer.js?v={BUILD}"></script><script src="/assets/home.js?v={BUILD}"></script>
</body></html>'''
    write('index.html', body)
    years = sorted({c['iso'][:4] for c in cleanups if c['iso']})
    idx = dict(totals=t, years=years, places=[dict(id=p['id'], kind=p['kind'], name=p['name'], where=p['where'], lat=p['lat'], lng=p['lng'], status=p['status'],
               cover=SUM[p['id']]['cover'], first=SUM[p['id']]['first'], last=SUM[p['id']]['last'],
               c=[[(c['iso'] or '')[:4], c['kind']] for c in by_place.get(p['id'], [])]) for p in places if p['id'] in by_place])
    write('data/index.json', json.dumps(idx, ensure_ascii=False, separators=(',', ':')))

# ---------- timeline ----------
def timeline_page():
    rows, cur = [], None
    for c in sorted(cleanups, key=sort_key, reverse=True):
        y = c['iso'][:4] if c['iso'] else (re.findall(r'20\d\d', c['date'] or '') or [''])[-1]
        if y != cur:
            rows.append(f'<h2 class="tl-year" data-year="{e(y)}">{e(y)}</h2>'); cur = y
        ps = [byid[i] for i in c['places'] if i in byid]
        names = ' + '.join(f'<a href="/ponds/{p["id"]}/#post-{c["n"]}">{e(p["name"])}</a>' for p in ps)
        where = ', '.join(dict.fromkeys(p['where'] for p in ps if p['where']))
        first = (c['text'] or '').strip()
        strip = ''.join(f'<img src="/photos/thumbs/{ph["file"]}.webp" alt="" loading="lazy" decoding="async" width="64" height="64">' for ph in c['photos'][:5])
        d = nice_date(c); short = d if c['approx'] else (d.rsplit(',', 1)[0] if ',' in d else d)
        search = ' '.join([*(p['name'] for p in ps), where]).lower()
        where_h = '<span class="where">%s</span>' % e(where) if where else ''
        first_h = '<p>%s</p>' % e(first) if first else ''
        strip_h = '<div class="strip">%s</div>' % strip if strip else ''
        rows.append(f'<div class="tl-row" data-year="{e(y)}" data-s="{e(search)}"><time datetime="{e(c["iso"] or "")}">{e(short)}</time><div>'
                    f'<h3>{names}</h3><div class="meta"><span class="tag {c["kind"]}">{KIND_LABEL.get(c["kind"], "Update")}</span>{where_h}</div>'
                    f'{first_h}{strip_h}</div></div>')
    years = sorted({c['iso'][:4] for c in cleanups if c['iso']}, reverse=True)
    yrs = '<button type="button" data-y="" aria-pressed="true">All</button>' + ''.join(f'<button type="button" data-y="{y}" aria-pressed="false">{y}</button>' for y in years)
    body = f'''{head(f"Timeline — {site['title']}", f"Every cleanup post in date order, newest first.", '/timeline/')}<body>
{topbar('/timeline/')}
<main class="page" id="main">
<h1>Timeline</h1>
<p class="lede">Every cleanup post in date order, newest first. Filter by year or search for a pond.</p>
<div class="filters"><input class="search" id="tq" type="search" placeholder="Search a pond or town" aria-label="Search a pond or town" autocomplete="off"><div class="yrs" role="group" aria-label="Year">{yrs}</div></div>
<p class="where" id="tcount" aria-live="polite"></p>
<div id="tl">{''.join(rows)}</div>
<p class="empty" id="tempty" hidden>Nothing matches that search.</p>
</main>
{foot()}
<script>
(function(){{ const q=document.getElementById('tq'), rows=[...document.querySelectorAll('.tl-row')], heads=[...document.querySelectorAll('.tl-year')]; let y='';
 function run(){{ const s=q.value.trim().toLowerCase(); let n=0; const seen=new Set();
  rows.forEach(r=>{{ const ok=(!y||r.dataset.year===y)&&(!s||r.dataset.s.includes(s)); r.hidden=!ok; if(ok){{n++;seen.add(r.dataset.year);}} }});
  heads.forEach(h=>h.hidden=!seen.has(h.dataset.year)); document.getElementById('tempty').hidden=n>0;
  document.getElementById('tcount').textContent=n+' post'+(n===1?'':'s'); }}
 q.addEventListener('input',run);
 document.querySelectorAll('.yrs button').forEach(b=>b.onclick=()=>{{ y=b.dataset.y; document.querySelectorAll('.yrs button').forEach(x=>x.setAttribute('aria-pressed',x===b)); run(); }});
 run(); }})();
</script>
</body></html>'''
    write('timeline/index.html', body)

# ---------- about ----------
def about_page():
    t = site['totals']; ponds = sum(1 for p in places if p['kind'] == 'pond' and p['id'] in by_place)
    photos = sum(len(c['photos']) for c in cleanups)
    stats = (f'<div class="statgrid"><div><b>{t["cleanups"]}</b><span>pond cleanups (as of {e(t["asOf"])})</span></div>'
             f'<div><b>{ponds}</b><span>ponds on the map</span></div><div><b>{t["since"]}</b><span>first cleanup</span></div>'
             f'<div><b>{photos:,}</b><span>photos in the archive</span></div></div>')
    content = open(os.path.join(ROOT, 'content/about.html'), encoding='utf-8').read().replace('{{stats}}', stats).replace('{{facebook}}', e(site['facebook']))
    body = f'''{head(f"About — {site['title']}", "Who cleans up the Avalon's ponds, and why.", '/about/')}<body>
{topbar('/about/')}
<main class="page" id="main"><div class="prose">{content}</div></main>
{foot()}
</body></html>'''
    write('about/index.html', body)

def extras():
    write('404.html', f'''{head(f"Not found — {site['title']}", 'That page isn’t here.', '/404')}<body>{topbar('')}<main class="page" id="main"><h1>That page isn’t here</h1><p class="lede">It may have moved. Try the <a href="/">map</a> or the <a href="/timeline/">timeline</a>.</p></main>{foot()}</body></html>''')
    write('_headers', '/photos/*\n  Cache-Control: public, max-age=31536000, immutable\n/og/*\n  Cache-Control: public, max-age=604800\n/data/*\n  Cache-Control: public, max-age=300\n')
    if site.get('public'):
        write('robots.txt', f"User-agent: *\nAllow: /\nSitemap: {site['url'].rstrip('/')}/sitemap.xml\n")
        urls = ['/', '/timeline/', '/about/'] + [f"/ponds/{p['id']}/" for p in places if p['id'] in by_place]
        write('sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + ''.join(f"<url><loc>{e(site['url'].rstrip('/') + u)}</loc></url>" for u in urls) + '</urlset>\n')
    else:
        write('robots.txt', 'User-agent: *\nDisallow: /\n')

def copy_static():
    if os.path.exists(OUT): shutil.rmtree(OUT)
    os.makedirs(OUT)
    shutil.copytree(os.path.join(ROOT, 'assets'), os.path.join(OUT, 'assets'))
    shutil.copytree(os.path.join(ROOT, 'media/photos'), os.path.join(OUT, 'photos'))
    shutil.copytree(os.path.join(ROOT, 'media/thumbs'), os.path.join(OUT, 'photos/thumbs'))
    shutil.copytree(os.path.join(ROOT, 'media/og'), os.path.join(OUT, 'og'))
    os.makedirs(os.path.join(OUT, 'data'))
    shutil.copy(os.path.join(ROOT, 'data/map.json'), os.path.join(OUT, 'data/map.json'))

def check():
    problems = []
    for c in cleanups:
        for pid in c['places']:
            if pid not in byid: problems.append(f"post {c['n']}: unknown place '{pid}'")
        for ph in c['photos']:
            if not os.path.exists(os.path.join(ROOT, 'media/photos', ph['file'] + '.webp')): problems.append(f"post {c['n']}: missing photo {ph['file']}")
    ns = [c['n'] for c in cleanups]
    if len(ns) != len(set(ns)): problems.append('duplicate post numbers in cleanups.json')
    return problems

if __name__ == '__main__':
    probs = check()
    for p in probs: print('WARNING:', p)
    copy_static(); home_page(); timeline_page(); about_page(); extras()
    for p in places:
        if p['id'] in by_place: place_page(p)
    n_files = sum(len(f) for _, _, f in os.walk(OUT))
    print(f"Built {len(by_place)} place pages, {len(cleanups)} posts, {n_files} files into public/")
