"""Isometric SVG authoring — ASSET MANIFEST §1.1.

Standard 2:1 projection. One coarse tile is 128 x 64 @1x, so a world unit
travels 64px across and 32px down. Height (z) is given in pixels.

    sx = (x - y) * 64
    sy = (x + y) * 32 - z

Corner order for a box footprint, on screen:
    A = (x0,y0) back    B = (x1,y0) right
    C = (x1,y1) front   D = (x0,y1) left

The two visible walls are the ones meeting at the front corner C. Light
sits high to the upper left, so the D-C wall is the lit one and the C-B
wall is the shaded one, everywhere, in every asset.

What makes this read as modern rather than flat: no face is a single
colour. Every surface carries a soft vertical gradient, walls get ambient
occlusion pooling at their base, top edges catch a warm rim light, and
the whole sprite sits under a fine grain. That combination is what
separates a rendered look from a pictogram.
"""
import math
from . import palette as P

HALF_W = 64.0      # @1x
HALF_H = 32.0


class Scene:
    """Collects <defs> and body markup, and hands out unique gradient ids.

    Ids are per-Scene, so two sprites can never collide even if their
    markup is later concatenated into one document.
    """

    # §1.5 customisation slots. A mask render replaces every fill with the
    # flat channel colour for its slot, using the *same* geometry calls as
    # the base render — which is the only way the two stay pixel-aligned.
    MASK = {
        'primary':   ('#FF0000', '#D20000'),   # (lit, shaded) — wall / body
        'secondary': ('#00FF00', '#00D200'),   # roof / posts
        'trim':      ('#0000FF', '#0000D2'),   # frames, door, edging
        None:        ('#050505', '#050505'),   # not customisable
    }
    SEASON = {True: '#FBFBFB', False: '#050505'}

    def __init__(self, w, h, origin=None, name='sprite', mode='base'):
        self.w, self.h = float(w), float(h)
        # Where world (0,0,0) sits on the canvas. Defaults to horizontally
        # centred, sitting on the bottom with a little breathing room.
        self.ox, self.oy = origin if origin else (self.w / 2.0, self.h - 8.0)
        self.name = name
        self.mode = mode          # 'base' | 'mask' | 'season'
        self.defs = []
        self.body = []
        self._n = 0

    # ---- mode-aware fill ----------------------------------------------------
    def is_art(self):
        return self.mode == 'base'

    def slot_fill(self, slot, shaded=False):
        if self.mode == 'mask':
            return self.MASK.get(slot, self.MASK[None])[1 if shaded else 0]
        return self.SEASON[bool(slot)]

    def uid(self, tag):
        self._n += 1
        return '%s_%s_%d' % (self.name, tag, self._n)

    # ---- projection ---------------------------------------------------------
    def pt(self, x, y, z=0.0):
        return (self.ox + (x - y) * HALF_W,
                self.oy + (x + y) * HALF_H - z)

    def pts(self, coords):
        return ' '.join('%.2f,%.2f' % self.pt(*c) for c in coords)

    # ---- raw emit -----------------------------------------------------------
    def add(self, markup):
        self.body.append(markup)

    def defn(self, markup):
        self.defs.append(markup)

    # ---- gradients ----------------------------------------------------------
    def lin_grad(self, stops, x1=0, y1=0, x2=0, y2=1, tag='g'):
        gid = self.uid(tag)
        s = ''.join('<stop offset="%.3f" stop-color="%s"%s/>' %
                    (o, c, '' if a is None else ' stop-opacity="%.3f"' % a)
                    for o, c, a in stops)
        self.defn('<linearGradient id="%s" x1="%s" y1="%s" x2="%s" y2="%s">%s</linearGradient>'
                  % (gid, x1, y1, x2, y2, s))
        return gid

    def rad_grad(self, stops, cx='50%', cy='50%', r='50%', tag='r'):
        gid = self.uid(tag)
        s = ''.join('<stop offset="%.3f" stop-color="%s"%s/>' %
                    (o, c, '' if a is None else ' stop-opacity="%.3f"' % a)
                    for o, c, a in stops)
        self.defn('<radialGradient id="%s" cx="%s" cy="%s" r="%s">%s</radialGradient>'
                  % (gid, cx, cy, r, s))
        return gid

    # ---- primitives ---------------------------------------------------------
    def poly(self, coords, fill, opacity=None, stroke=None, sw=None,
             extra='', projected=False):
        pts = ' '.join('%.2f,%.2f' % c for c in coords) if projected else self.pts(coords)
        a = ' opacity="%.3f"' % opacity if opacity is not None else ''
        st = ''
        if stroke:
            st = ' stroke="%s" stroke-width="%.2f" stroke-linejoin="round"' % (
                stroke, sw if sw is not None else 2.0)
        self.add('<polygon points="%s" fill="%s"%s%s%s/>' % (pts, fill, a, st, extra))

    def path(self, d, fill='none', stroke=None, sw=2.0, opacity=None,
             cap='round', extra=''):
        a = ' opacity="%.3f"' % opacity if opacity is not None else ''
        st = ''
        if stroke:
            st = (' stroke="%s" stroke-width="%.2f" stroke-linecap="%s"'
                  ' stroke-linejoin="round"' % (stroke, sw, cap))
        self.add('<path d="%s" fill="%s"%s%s%s/>' % (d, fill, a, st, extra))

    def clip(self, coords, projected=False):
        cid = self.uid('clip')
        pts = ' '.join('%.2f,%.2f' % c for c in coords) if projected else self.pts(coords)
        self.defn('<clipPath id="%s"><polygon points="%s"/></clipPath>' % (cid, pts))
        return cid

    # ---- shading helpers ----------------------------------------------------
    def _wall(self, quad, base, kind, ao=True, rim=False, slot=None):
        """A wall quad with a vertical gradient plus AO pooling at its foot."""
        if not self.is_art():
            self.poly(quad, self.slot_fill(slot, shaded=(kind == 'right')))
            return
        top = P.face(base, kind)
        gid = self.lin_grad([
            (0.0, P.light(top, 0.16), None),
            (0.42, top, None),
            (1.0, P.shade(top, 0.20), None),
        ], tag='wall')
        self.poly(quad, 'url(#%s)' % gid)
        if ao:
            # contact darkening where the wall meets the ground
            aid = self.lin_grad([
                (0.0, P.INK, 0.0),
                (0.72, P.INK, 0.0),
                (1.0, P.INK, 0.26),
            ], tag='ao')
            self.poly(quad, 'url(#%s)' % aid)
        if rim:
            a, b = quad[3], quad[2]     # the top edge of the quad
            pa, pb = self.pt(*a), self.pt(*b)
            self.path('M%.2f,%.2f L%.2f,%.2f' % (pa[0], pa[1], pb[0], pb[1]),
                      stroke=P.light(base, 0.55), sw=2.0, opacity=0.55)

    def box(self, x0, y0, x1, y1, z0, z1, base, rim=True, top_fill=None,
            ao=True, slot=None):
        """An isometric cuboid. Returns the projected top-face corners."""
        A = (x0, y0, z1); B = (x1, y0, z1); C = (x1, y1, z1); D = (x0, y1, z1)
        # walls first, top last so the top edge stays crisp
        self._wall([(x0, y1, z0), (x1, y1, z0), C, D], base, 'left', ao, rim, slot)
        self._wall([(x1, y1, z0), (x1, y0, z0), B, C], base, 'right', ao, rim, slot)
        if not self.is_art():
            self.poly([A, B, C, D], self.slot_fill(slot))
            return [A, B, C, D]
        topc = P.face(base, 'top')
        tid = self.lin_grad([
            (0.0, P.light(topc, 0.22), None),
            (1.0, P.shade(topc, 0.06), None),
        ], tag='top')
        self.poly([A, B, C, D], top_fill or 'url(#%s)' % tid)
        return [A, B, C, D]

    def ground_diamond(self, x0, y0, x1, y1, fill, z=0.0):
        self.poly([(x0, y0, z), (x1, y0, z), (x1, y1, z), (x0, y1, z)], fill)

    # ---- finishing passes ---------------------------------------------------
    def roof_hip(self, x0, y0, x1, y1, ze, zr, base, inset=0.42, slot='secondary'):
        """Hipped roof. Two of its four planes face the camera.

        Drawn far-to-near: the two hidden planes first so any antialiased
        edge is covered, then the +x hip, then the +y slope on top.
        """
        ym = (y0 + y1) / 2.0
        rx0, rx1 = x0 + inset, x1 - inset
        far_y = [(x0, y0, ze), (x1, y0, ze), (rx1, ym, zr), (rx0, ym, zr)]
        far_x = [(x0, y0, ze), (x0, y1, ze), (rx0, ym, zr)]
        near_x = [(x1, y0, ze), (x1, y1, ze), (rx1, ym, zr)]
        near_y = [(x0, y1, ze), (x1, y1, ze), (rx1, ym, zr), (rx0, ym, zr)]

        if not self.is_art():
            for q, sh in ((far_y, True), (far_x, True), (near_x, True), (near_y, False)):
                self.poly(q, self.slot_fill(slot, shaded=sh))
            return near_y

        dark = P.shade(base, 0.34)
        self.poly(far_y, dark)
        self.poly(far_x, P.shade(base, 0.40))
        # right-hand hip: shaded, with its own falloff
        gx = self.lin_grad([(0.0, P.shade(base, 0.16), None),
                            (1.0, P.shade(base, 0.40), None)], tag='hipx')
        self.poly(near_x, 'url(#%s)' % gx)
        # front slope: the hero surface, brightest at the ridge
        gy = self.lin_grad([(0.0, P.light(base, 0.26), None),
                            (0.55, base, None),
                            (1.0, P.shade(base, 0.17), None)], tag='hipy')
        self.poly(near_y, 'url(#%s)' % gy)
        # ridge rim light and the eave shadow line
        rim_light_edge(self, (rx0, ym, zr), (rx1, ym, zr), P.light(base, 0.62), 0.7, 2.4)
        rim_light_edge(self, (x1, y0, ze), (x1, y1, ze), P.light(base, 0.30), 0.35, 2.0)
        return near_y

    def eave_shadow(self, x0, y0, x1, y1, z, depth=9.0):
        """The soft band a roof overhang throws onto the wall below."""
        if not self.is_art():
            return
        a, b = self.pt(x0, y1, z), self.pt(x1, y1, z)
        gid = self.lin_grad([(0.0, P.INK, 0.30), (1.0, P.INK, 0.0)], tag='eave')
        self.add('<path d="M%.2f,%.2f L%.2f,%.2f L%.2f,%.2f L%.2f,%.2f Z"'
                 ' fill="url(#%s)"/>' % (a[0], a[1], b[0], b[1],
                                         b[0], b[1] + depth, a[0], a[1] + depth, gid))

    def grain(self, opacity=0.055, scale=0.85):
        """Fine tooth over the whole sprite.

        Cozy art at this size looks plasticky without it. Kept subtle
        enough to survive downscaling to @1x.
        """
        fid = self.uid('grain')
        self.defn(
            '<filter id="%s" x="0" y="0" width="100%%" height="100%%">'
            '<feTurbulence type="fractalNoise" baseFrequency="%.3f" numOctaves="3"'
            ' stitchTiles="stitch" result="n"/>'
            '<feColorMatrix in="n" type="saturate" values="0"/>'
            '</filter>' % (fid, scale))
        self.add('<rect width="%.2f" height="%.2f" filter="url(#%s)"'
                 ' opacity="%.3f" style="mix-blend-mode:multiply"/>'
                 % (self.w, self.h, fid, opacity))

    def render(self, grain=True):
        if grain:
            self.grain()
        defs = '<defs>%s</defs>' % ''.join(self.defs) if self.defs else ''
        return ('<svg xmlns="http://www.w3.org/2000/svg" width="%.0f" height="%.0f"'
                ' viewBox="0 0 %.0f %.0f" shape-rendering="geometricPrecision">'
                '%s%s</svg>' % (self.w, self.h, self.w, self.h, defs,
                                ''.join(self.body)))


# ---- shared sub-passes ------------------------------------------------------
def contact_shadow(w, h, cx, cy, rx, ry, name='sh'):
    """A standalone soft shadow sprite (§1.3 — always a separate file)."""
    s = Scene(w, h, origin=(cx, cy), name=name)
    fid = s.uid('blur')
    s.defn('<filter id="%s" x="-50%%" y="-50%%" width="200%%" height="200%%">'
           '<feGaussianBlur stdDeviation="%.2f"/></filter>' % (fid, max(2.0, rx * 0.10)))
    gid = s.rad_grad([(0.0, P.INK, 0.44), (0.62, P.INK, 0.22), (1.0, P.INK, 0.0)])
    s.add('<ellipse cx="%.2f" cy="%.2f" rx="%.2f" ry="%.2f" fill="url(#%s)"'
          ' filter="url(#%s)"/>' % (cx, cy, rx, ry, gid, fid))
    return s.render(grain=False)


def rim_light_edge(s, a, b, colour, opacity=0.5, sw=2.0):
    pa, pb = s.pt(*a), s.pt(*b)
    s.path('M%.2f,%.2f L%.2f,%.2f' % (pa[0], pa[1], pb[0], pb[1]),
           stroke=colour, sw=sw, opacity=opacity)


def jitter(seed):
    """Deterministic pseudo-random in [0,1). Same asset always looks the same."""
    x = math.sin(seed * 12.9898) * 43758.5453
    return x - math.floor(x)
