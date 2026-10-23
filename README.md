# Avalon Pond Cleanups

The website at **avalonpondcleanups.ca**: a map of every pond, beach and trail Eugene Hynes has cleaned up on the Avalon Peninsula. Each place has its own page with every cleanup post and its photos.

The site is plain files. One small Python script (`tools/build.py`, standard library only) turns the data in this repository into the finished site in `public/`. Cloudflare Pages runs that script on every push, so updating the site means editing data and pushing.

## What's where

| Path | What it is |
| --- | --- |
| `site.json` | Site settings: the web address, the headline total (Dad's own count), and the `public` switch |
| `data/places.json` | Every pond and area pin: `id`, `kind` (`pond` or `area`), `name`, `where`, `lat`, `lng`, `status` |
| `data/cleanups.json` | Every cleanup post: date, which place(s), the post text, photo files, Facebook link |
| `data/map.json` | The basemap linework (coast, islands, pond and lake outlines, roads) from OpenStreetMap |
| `media/photos/`, `media/thumbs/` | Web-size photos (WebP) and their thumbnails, named `p<post number>-<n>.webp` |
| `media/og/` | 1200×630 images used when a page is shared on Facebook |
| `content/about.html` | The About page text (still a draft) |
| `assets/` | Styles and scripts |
| `public/` | The built site. Generated, so don't edit it; it isn't committed |

## Build it on your own computer (optional)

You need Python 3.9 or newer.

```
python3 tools/build.py
cd public && python3 -m http.server 8000
```

Then open http://localhost:8000. The build prints a warning if a post points at a place that doesn't exist or a photo file is missing.

## Add a new cleanup

1. Save the photos as WebP. Put web size (longest side 1000 px) in `media/photos/` and 360 px thumbnails in `media/thumbs/`, named `p<post number>-1.webp`, `-2`, and so on. Any free image converter works; Claude can also do this step for you.
2. Add an entry at the top of `data/cleanups.json`. Copy an existing one and change the fields:
   - `n`: a new, unique post number
   - `iso`: the date as `YYYY-MM-DD`, with `date` written out the same way
   - `kind`: `pond`, `shore`, `finds` or `others`
   - `places`: list of place ids, for example `["octagon-pond"]`
   - `text` and `facebook`: the post text and the post's link
   - `photos`: list of `{"file": "p0730-1", "w": 1000, "h": 750}`
3. If it's a new pond, add it to `data/places.json` with its coordinates.
4. If Dad has posted a new running total, update `totals.cleanups` in `site.json`.
5. Commit and push. Cloudflare rebuilds the site in a minute or two.

## Hosting

- **Code:** this GitHub repository.
- **Hosting:** Cloudflare Pages. Build command `python3 tools/build.py`, output directory `public`, environment variable `PYTHON_VERSION=3.12`.
- **Domain:** avalonpondcleanups.ca, registered at Porkbun, with its nameservers pointed at Cloudflare.
- **Until launch:** `"public": false` in `site.json` tells search engines to stay away, and a Cloudflare Access rule keeps the site behind a login. To launch, set `"public": true`, push, and remove the Access rule.

## Credits

Map data © OpenStreetMap contributors (ODbL). Place names from the Canadian Geographical Names Database. Every post and photo comes from the Avalon Pond Cleanups Facebook page.
