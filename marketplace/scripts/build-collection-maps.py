# Build the collection maps for the cryptopunks.app-style intro on each collection page (v67's
# 10,000 has its own script, build-v67-map.py): every piece in token order on a transparent
# image, so the page's own tile colour shows behind it, plus the page each tile opens.
#   src/assets/maps/<slug>.webp   24px tiles, COLS wide
#   src/assets/maps/<slug>.json   {"cols", "rows", "links": ["/details/<hashId>", ...],
#                                  "ids": [tokenId, ...], "shas": "<8-char sha prefixes, concatenated>"}
# The sha prefixes let the page find a piece's place (and so its link, number and map tile) from
# the image it already has.
#
# Token order and hashes are read once from Supabase here (a few small requests at build
# time); the art comes from the sprite sheets of an existing build, so nothing is downloaded.
# Visitors load one image and one small JSON file and query nothing.
#   python scripts/build-collection-maps.py <dist/.../browser> <src/assets/maps>
import io, json, os, sys, urllib.request
from PIL import Image

DIST, OUT = sys.argv[1], sys.argv[2]
KEY = 'sb_publishable_c-JzxJH0a6_ex9vDW3ItFg_-G3jkuHe'          # public anon key, read-only
URL = 'https://kfnprbhoodmgfhqojmqp.supabase.co/rest/v1/ethscriptions'
STORAGE = 'https://kfnprbhoodmgfhqojmqp.supabase.co/storage/v1/object/public'
# columns per collection: wide enough that the map is a few rows of large tiles
COLS = {
    'missing-phunks': 25, 'dysto-phunks': 23, 'ethsrocks': 27, 'phikings': 23,
    'phunklloween': 20,
}
# Painted (not pixel-art) collections: the rocks are ~700x990 paintings, which a 24px sprite tile
# turns to mush. Their map is built from the original files at this tile size with smooth
# resampling, and the json says "smooth" so the page scales it smoothly instead of pixelated.
SMOOTH = {'ethsrocks': 192}   # the map zooms to 8x (192px tiles), so it is never upscaled

def painted(sha, t):
    path = f'{DIST}/static/images/{sha}'
    if os.path.exists(path): im = Image.open(path)
    else:   # newer than the build's bundled images: read it from storage
        im = Image.open(io.BytesIO(urllib.request.urlopen(f'{STORAGE}/static/images/{sha}').read()))
    im.seek(0)
    im = im.convert('RGBA')
    if max(im.size) <= t:   # pixel art (the 24px gems): scale up pixel-sharp
        k = t // max(im.size)
        im = im.resize((im.width * k, im.height * k), Image.NEAREST)
    else:
        im.thumbnail((t, t), Image.LANCZOS)      # fit inside the square, keep the shape
    out = Image.new('RGBA', (t, t), (0, 0, 0, 0))
    out.alpha_composite(im, ((t - im.width) // 2, (t - im.height) // 2))
    return out

idx = json.load(open(f'{DIST}/static/sprite.json'))
T, SC, CH, P = idx['tile'], idx['cols'], idx['chunk'], idx['prefix']
pos = {idx['shas'][i * P:(i + 1) * P]: i for i in range(idx['count'])}
sheets = {}
def tile(sha):
    i = pos.get(sha[:P])
    if i is None:   # not on a sheet (animated pieces stay as their own file): first frame
        try:
            im = Image.open(f'{DIST}/static/images/{sha}'); im.seek(0)
            return im.convert('RGBA').resize((T, T), Image.NEAREST)
        except Exception:
            return None
    s = i // CH
    if s not in sheets: sheets[s] = Image.open(f'{DIST}/static/sprite-{s}.png').convert('RGBA')
    w = i % CH
    return sheets[s].crop(((w % SC) * T, (w // SC) * T, (w % SC) * T + T, (w // SC) * T + T))

os.makedirs(OUT, exist_ok=True)
for slug, cols in COLS.items():
    req = urllib.request.Request(f'{URL}?select=tokenId,sha,hashId&slug=eq.{slug}&order=tokenId&limit=1000',
                                 headers={'apikey': KEY, 'Authorization': 'Bearer ' + KEY})
    rows = json.load(urllib.request.urlopen(req))
    n = len(rows); r = -(-n // cols)
    t = SMOOTH.get(slug, T)
    img = Image.new('RGBA', (cols * t, r * t), (0, 0, 0, 0))
    missing = []
    for k, row in enumerate(rows):
        try:
            im = painted(row['sha'], t) if slug in SMOOTH else tile(row['sha'])
        except Exception:
            im = None
        if im is None: missing.append(row['tokenId']); continue
        img.alpha_composite(im, ((k % cols) * t, (k // cols) * t))
    if slug in SMOOTH: img.save(f'{OUT}/{slug}.webp', quality=88, method=6)   # photo-like art
    else: img.save(f'{OUT}/{slug}.webp', lossless=True, method=6)
    json.dump({'cols': cols, 'rows': r, **({'smooth': True, 'tile': t} if slug in SMOOTH else {}), 'links': ['/details/' + row['hashId'] for row in rows],
               'ids': [row['tokenId'] for row in rows], 'shas': ''.join(row['sha'][:8] for row in rows)},
              open(f'{OUT}/{slug}.json', 'w'), separators=(',', ':'))
    print(f'{slug}: {n} pieces, {cols}x{r}, missing {missing}')
