# Build the v67 collection map: all 10,000 QuantumPhunks in one image, 100 x 100 in token order
# (#1 top-left, #10,000 bottom-right), each 24x24 on a transparent background so the page's tile
# colour, and the listed/bid colours under a tile, show through. The page shows this single file
# as a pan-and-zoom map, so visitors load one image and query nothing. Alongside it,
# <out>.json holds {"cols", "rows", "shas"}: 8-char sha prefixes in token order, so the page can
# place a piece (token id = position + 1) from the image it already has.
#
# The token -> sha list is read once from Supabase here (10 small requests at build time); the
# art comes from the sprite sheets of an existing build, so no image is downloaded.
#   python scripts/build-v67-map.py <dist/.../browser> src/assets/maps/cryptophunksv67.webp
import json, sys, urllib.request
from PIL import Image

DIST, OUT = sys.argv[1], sys.argv[2]
KEY = 'sb_publishable_c-JzxJH0a6_ex9vDW3ItFg_-G3jkuHe'          # public anon key, read-only
URL = 'https://kfnprbhoodmgfhqojmqp.supabase.co/rest/v1/ethscriptions'
N, COLS = 10000, 100

sha_of = {}
for off in range(0, N, 1000):
    req = urllib.request.Request(f'{URL}?select=tokenId,sha&slug=eq.cryptophunksv67&order=tokenId&offset={off}&limit=1000',
                                 headers={'apikey': KEY, 'Authorization': 'Bearer ' + KEY})
    for row in json.load(urllib.request.urlopen(req)):
        sha_of[int(row['tokenId'])] = row['sha']
print('tokens', len(sha_of))

idx = json.load(open(f'{DIST}/static/sprite.json'))
T, SC, CH, P = idx['tile'], idx['cols'], idx['chunk'], idx['prefix']
pos = {idx['shas'][i * P:(i + 1) * P]: i for i in range(idx['count'])}
sheets = {}
def tile(sha):
    i = pos.get(sha[:P])
    if i is None:
        # not on a sheet (animated pieces stay as their own file): use the build's copy,
        # first frame
        try:
            im = Image.open(f'{DIST}/static/images/{sha}'); im.seek(0)
            return im.convert('RGBA').resize((T, T), Image.NEAREST)
        except Exception:
            return None
    s = i // CH
    if s not in sheets: sheets[s] = Image.open(f'{DIST}/static/sprite-{s}.png').convert('RGBA')
    w = i % CH
    x, y = (w % SC) * T, (w // SC) * T
    return sheets[s].crop((x, y, x + T, y + T))

out = Image.new('RGBA', (COLS * T, (N // COLS) * T), (0, 0, 0, 0))
missing = []
for t in range(1, N + 1):
    sha = sha_of.get(t)
    im = tile(sha) if sha else None
    if im is None: missing.append(t); continue
    k = t - 1
    out.alpha_composite(im, ((k % COLS) * T, (k // COLS) * T))
out.save(OUT, lossless=True, method=6)
json.dump({'cols': COLS, 'rows': N // COLS, 'shas': ''.join(sha_of[t][:8] for t in range(1, N + 1))},
          open(OUT.rsplit('.', 1)[0] + '.json', 'w'), separators=(',', ':'))
print('missing', len(missing), missing[:10])
