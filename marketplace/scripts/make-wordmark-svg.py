# Collection wordmarks as vectors (src/assets/wordmarks/<slug>.svg), in the manner of
# cryptopunks.app's logo: Montserrat SemiBold, slightly tight, and four letters with one part
# rebuilt from blocks the width of the stroke: a three-step corner on the Q (their C), a crossbar
# only to the right and a stepped foot on the t, a bowl made of bars on the P, and a stepped
# bottom-left on the u. Each corner is left as a pixel step.
#
# Every edited letter is ONE outline: the glyph minus the cut areas plus the blocks, merged with
# path booleans (skia-pathops). Blocks sit on the glyph's exact edges, read from its outline
# points, so there is no join for antialiasing to show as a seam.
#   pip install fonttools skia-pathops
# The edits are per letter, so every collection's name gets them where it has those letters:
# the first Q, the first t, the first P and the first u after a P.
# The pages colour them with the collection's accent (CSS mask), so the fill here is only a
# fallback.
#   python scripts/make-wordmark-svg.py <Montserrat[wght].ttf> <out dir>
# The font is Google Fonts' variable Montserrat (github.com/google/fonts, ofl/montserrat).
import sys
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from pathops import Path, PathOp, op

S = 400                       # design size: coordinates below are px at this size, y down
TRACK = -0.02                 # letter-spacing, em
PINK = '#ff04b4'
WORDS = {
    'cryptophunksv67': 'QuantumPhunks', 'missing-phunks': 'Missing Phunks', 'dysto-phunks': 'DystoPhunks',
    'ethsrocks': 'EthsRocks', 'phikings': 'Phikings', 'phunklloween': 'Phunklloween',
}

font = instantiateVariableFont(TTFont(sys.argv[1]), {'wght': 600})
gs, cmap, hmtx = font.getGlyphSet(), font.getBestCmap(), font['hmtx']
k = S / font['head'].unitsPerEm
asc = font['hhea'].ascent * k                     # y = 0 is the ascender line

# Exact edges at S=400 (from the SemiBold outlines): baseline 387.2; horizontal strokes 43.89
# thick (P's bars), vertical ones about 50 (52.36 on the Q's ring).
BASE, HB = 387.2, 43.89
# letter -> (areas to cut, blocks to add), in the glyph's own coordinates
EDITS = {
    # Q: ring outer left 17.52, inner 69.88, top 103.24..148.64; three steps down to y 247.2
    # where the ring's left side is vertical
    'Q': ([(10, 98, 178, 247.2)],
        [(122.24, 103.24, 178, 148.64), (69.88, 148.64, 122.24, 194.04), (17.52, 194.04, 69.88, 247.2)]),
    # t: stem 39.4..89.4, crossbar 173.62..213.5; no crossbar left of the stem, and below
    # y 316.92 (where the hook starts) the stem steps into a square foot
    't': ([(0, 160, 39.4, 230), (30, 316.92, 175, 400)],
        [(39.4, 316.92, 89.4, BASE - HB), (89.4, BASE - HB, 139.4, BASE)]),
    # P: stem right edge 89.69, bars 107.2..151.09 and 262.32..306.21, bowl 219.6..271.97
    'P': ([(89.69, 100, 290, 316)],
        [(89.69, 107.2, 219.6, 151.09), (219.6, 151.09, 271.97, 262.32), (89.69, 262.32, 219.6, 306.21)]),
    # u: stems 31.04..81.04 and 189.6..239.7, straight down to y 281.65
    'u': ([(25, 281.65, 189.6, 400)],
        [(31.04, 281.65, 81.04, BASE - HB), (81.04, BASE - HB, 194, BASE)]),   # bar runs into the stem
}

def rect(x0, y0, x1, y1):
    p = Path(); pen = p.getPen()
    pen.moveTo((x0, y0)); pen.lineTo((x1, y0)); pen.lineTo((x1, y1)); pen.lineTo((x0, y1)); pen.closePath()
    return p

def edited(word):
    # which letters get their edit: the first Q, t and P, and the first u after a P
    pick, seenP = {}, False
    for i, ch in enumerate(word):
        if ch == 'P': seenP = True
        if ch in ('Q', 't', 'P') and ch not in pick: pick[ch] = i
        if ch == 'u' and seenP and 'u' not in pick: pick['u'] = i
    return {i: ch for ch, i in pick.items()}

def build(word):
    xs, x = [], 10.0
    for ch in word:
        xs.append(x)
        x += hmtx[cmap[ord(ch)]][0] * k + TRACK * S
    which = edited(word)
    out = None
    for i, ch in enumerate(word):
        if ch == ' ': continue
        ox = xs[i]
        g = Path()
        gs[cmap[ord(ch)]].draw(TransformPen(g.getPen(glyphSet=gs), (k, 0, 0, -k, ox, asc)))
        clears, blocks = EDITS[ch] if i in which else ([], [])
        for c in clears:
            g = op(g, rect(ox + c[0], c[1], ox + c[2], c[3]), PathOp.DIFFERENCE)
        for b in blocks:
            g = op(g, rect(ox + b[0], b[1], ox + b[2], b[3]), PathOp.UNION)
        out = g if out is None else op(out, g, PathOp.UNION)
    x0, y0, x1, y1 = out.bounds
    pen = SVGPathPen(None); out.draw(pen)
    w, h = x1 - x0, y1 - y0
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x0:.2f} {y0:.2f} {w:.2f} {h:.2f}" '
            f'width="{w:.0f}" height="{h:.0f}" role="img" aria-label="{word}">'
            f'<path fill="{PINK}" d="{pen.getCommands()}"/></svg>'), w, h

import os
os.makedirs(sys.argv[2], exist_ok=True)
sizes = {}
for slug, word in WORDS.items():
    svg, w, h = build(word)
    open(f'{sys.argv[2]}/{slug}.svg', 'w', encoding='utf8').write(svg)
    sizes[slug] = [round(w), round(h)]
    print(f'{slug}: {word}, {w:.0f} x {h:.0f}')
print(sizes)
