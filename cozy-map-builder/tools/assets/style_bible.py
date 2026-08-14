"""Style bible — ASSET MANIFEST §24.

The five assets that get approved before any bulk work starts. Houses set
the style for everything that follows, so the cottage carries the most
detail and everything else is calibrated against it.

Each asset is authored once as a mode-aware function. Calling it with
mode='base' paints art; mode='mask' paints flat §1.5 channel colours
through the identical geometry, so the mask can never drift out of
alignment with the sprite. That is the single biggest source of bugs in a
hand-authored mask set, and generating both from one description removes
it entirely.
"""
from .. import palette as P
from ..iso import Scene, contact_shadow, jitter


# ---- shared wall helpers ----------------------------------------------------
def _panel_y(y, xa, xb, za, zb):
    """A rectangle lying on a y=const wall plane (the lit, front-left face)."""
    return [(xa, y, za), (xb, y, za), (xb, y, zb), (xa, y, zb)]


def _panel_x(x, ya, yb, za, zb):
    """A rectangle lying on an x=const wall plane (the shaded, right face)."""
    return [(x, ya, za), (x, yb, za), (x, yb, zb), (x, ya, zb)]


def _window(s, quad, lit_face=True, slot='trim'):
    """A recessed window: frame, glass with a sky gradient, sill, reflection."""
    if not s.is_art():
        s.poly(quad, s.slot_fill(slot, shaded=not lit_face))
        return
    frame = P.OFF_WHITE if lit_face else P.shade(P.OFF_WHITE, 0.18)
    s.poly(quad, frame)
    # glass, inset
    inner = _inset(quad, 0.055, 5.0)
    g = s.lin_grad([(0.0, P.light(P.DUSTY_BLUE, 0.34), None),
                    (0.5, P.DUSTY_BLUE, None),
                    (1.0, P.shade(P.DUSTY_BLUE, 0.34), None)], tag='glass')
    s.poly(inner, 'url(#%s)' % g)
    # a single diagonal reflection reads as glass without going busy
    a, b, c, d = [s.pt(*p) for p in inner]
    s.add('<path d="M%.2f,%.2f L%.2f,%.2f L%.2f,%.2f Z" fill="%s" opacity=".30"/>'
          % (a[0], a[1], b[0], b[1], d[0], d[1], P.OFF_WHITE))
    # top-inner shadow, so the window reads recessed rather than pasted on
    s.add('<path d="M%.2f,%.2f L%.2f,%.2f" stroke="%s" stroke-width="2.4"'
          ' opacity=".28" fill="none"/>' % (d[0], d[1], c[0], c[1], P.INK))


def _inset(quad, fx, fz):
    """Shrink a wall quad inward. fx in world units, fz in pixels."""
    (xa, ya, za), (xb, yb, _), (xc, yc, zb), _ = quad
    if abs(ya - yb) < 1e-9:            # y=const plane
        return [(xa + fx, ya, za + fz), (xb - fx, ya, za + fz),
                (xb - fx, ya, zb - fz), (xa + fx, ya, zb - fz)]
    return [(xa, ya + fx, za + fz), (xa, yb - fx, za + fz),
            (xa, yb - fx, zb - fz), (xa, ya + fx, zb - fz)]


# =============================================================================
# 1. STARTER COTTAGE — 2x2 footprint, 256 x 320 @1x
# =============================================================================
COTTAGE_W, COTTAGE_H = 256, 320


def cottage(mode='base'):
    s = Scene(COTTAGE_W, COTTAGE_H, origin=(128, 184), name='cottage', mode=mode)
    x0, y0, x1, y1 = 0.16, 0.16, 1.84, 1.84
    # Taller walls and a shallower ridge than the first pass: a roof that
    # takes two thirds of the silhouette reads as a shed, not a home.
    wall_top = 96.0
    ridge = 146.0

    # --- plinth: a low stone course the house sits on -------------------------
    s.box(x0 - 0.05, y0 - 0.05, x1 + 0.05, y1 + 0.05, 0, 11,
          P.CREAM_DARK, rim=False, slot=None)

    # --- walls ---------------------------------------------------------------
    s.box(x0, y0, x1, y1, 10, wall_top, P.CREAM, rim=True, slot='primary')

    # board-and-batten battens on both visible walls: cheap to draw, and it
    # is the difference between a painted surface and a flat fill
    if s.is_art():
        for i in range(1, 9):
            xx = x0 + (x1 - x0) * i / 9.0
            a, b = s.pt(xx, y1, 12), s.pt(xx, y1, wall_top - 2)
            s.path('M%.2f,%.2f L%.2f,%.2f' % (a[0], a[1], b[0], b[1]),
                   stroke=P.shade(P.CREAM, 0.16), sw=1.5, opacity=0.55)
        for i in range(1, 9):
            yy = y0 + (y1 - y0) * i / 9.0
            a, b = s.pt(x1, yy, 12), s.pt(x1, yy, wall_top - 2)
            s.path('M%.2f,%.2f L%.2f,%.2f' % (a[0], a[1], b[0], b[1]),
                   stroke=P.shade(P.CREAM, 0.22), sw=1.5, opacity=0.42)

    # --- openings on the lit (front-left) wall --------------------------------
    door = _panel_y(y1, 0.72, 1.16, 10, 62)
    if s.is_art():
        dg = s.lin_grad([(0.0, P.light(P.WARM_BROWN, 0.20), None),
                         (1.0, P.shade(P.WARM_BROWN, 0.22), None)], tag='door')
        s.poly(door, 'url(#%s)' % dg)
        s.poly(_inset(door, 0.055, 5.0), P.shade(P.WARM_BROWN, 0.10))
        k = s.pt(1.10, y1, 35)
        s.add('<circle cx="%.2f" cy="%.2f" r="2.6" fill="%s"/>' % (k[0], k[1], P.AMBER))
    else:
        s.poly(door, s.slot_fill('trim'))

    _window(s, _panel_y(y1, 0.24, 0.60, 34, 70), lit_face=True)
    _window(s, _panel_x(x1, 0.42, 0.86, 36, 72), lit_face=False)

    # --- porch awning over the door ------------------------------------------
    # The one piece of colour that makes the house feel occupied rather than
    # placed. Striped in amber over off-white, which reads at @1x.
    if s.is_art():
        aw = [(0.66, y1 + 0.30, 62), (1.22, y1 + 0.30, 62),
              (1.22, y1 - 0.01, 76), (0.66, y1 - 0.01, 76)]
        ag = s.lin_grad([(0.0, P.light(P.AMBER, 0.24), None),
                         (1.0, P.shade(P.AMBER, 0.20), None)], tag='awn')
        s.poly(aw, 'url(#%s)' % ag)
        acid = s.clip(aw)
        s.add('<g clip-path="url(#%s)">' % acid)
        for i in range(6):
            xx = 0.66 + i * 0.094
            a, b = s.pt(xx, y1 + 0.30, 62), s.pt(xx, y1 - 0.01, 76)
            s.path('M%.2f,%.2f L%.2f,%.2f' % (a[0], a[1], b[0], b[1]),
                   stroke=P.OFF_WHITE, sw=5.0, opacity=0.72)
        s.add('</g>')
        e0, e1 = s.pt(0.66, y1 + 0.30, 62), s.pt(1.22, y1 + 0.30, 62)
        s.path('M%.2f,%.2f L%.2f,%.2f' % (e0[0], e0[1], e1[0], e1[1]),
               stroke=P.shade(P.TERRACOTTA, 0.18), sw=2.6, opacity=0.85)

    # --- roof: overhangs the walls on every side ------------------------------
    ov = 0.17
    s.eave_shadow(x0, y0, x1, y1, wall_top, depth=11.0)
    s.roof_hip(x0 - ov, y0 - ov, x1 + ov, y1 + ov, wall_top - 3, ridge,
               P.TERRACOTTA, inset=0.46)

    # shingle courses on the front slope, fading toward the ridge
    if s.is_art():
        ym = (y0 + y1) / 2.0
        for i in range(1, 7):
            t = i / 7.0
            yy = y1 + ov - (y1 + ov - ym) * t
            zz = (wall_top - 3) + (ridge - wall_top + 3) * t
            a = s.pt(x0 - ov + 0.46 * t, yy, zz)
            b = s.pt(x1 + ov - 0.46 * t, yy, zz)
            s.path('M%.2f,%.2f L%.2f,%.2f' % (a[0], a[1], b[0], b[1]),
                   stroke=P.shade(P.TERRACOTTA, 0.30), sw=1.6,
                   opacity=0.30 * (1.0 - t * 0.55))

    # --- chimney --------------------------------------------------------------
    s.box(0.30, 0.30, 0.56, 0.56, 122, 178, P.CREAM_DARK, rim=True, slot=None)
    s.box(0.26, 0.26, 0.60, 0.60, 174, 182, P.WARM_BROWN, rim=False, slot=None)

    # --- planter under the front window --------------------------------------
    if s.is_art():
        s.box(0.20, y1 - 0.02, 0.64, y1 + 0.16, 10, 26, P.WARM_BROWN, rim=True)
        for i in range(7):
            r = jitter(i * 3.1 + 1.0)
            px, pz = 0.24 + i * 0.06, 26 + 4 + r * 9
            c = s.pt(px, y1 + 0.07, pz)
            s.add('<ellipse cx="%.2f" cy="%.2f" rx="%.2f" ry="%.2f" fill="%s"/>'
                  % (c[0], c[1], 5.2 + r * 2.0, 4.0 + r * 1.6,
                     P.SAGE if r > 0.45 else P.SAGE_DARK))
            if r > 0.72:
                s.add('<circle cx="%.2f" cy="%.2f" r="2.0" fill="%s"/>'
                      % (c[0] + 2, c[1] - 3, P.AMBER))

    # --- step at the door -----------------------------------------------------
    s.box(0.76, y1, 1.12, y1 + 0.20, 0, 10, P.CREAM_DARK, rim=False, slot=None)

    return s.render(grain=s.is_art())


def cottage_shadow():
    return contact_shadow(COTTAGE_W, COTTAGE_H, 128, 184 + 60, 122, 56, 'cottage_sh')


# =============================================================================
# 2. GRASS TILE — 128 x 64 @1x, 4 variants, season mask
# =============================================================================
def grass(variant=0, mode='base'):
    s = Scene(128, 64, origin=(64, 0), name='grass%d' % variant, mode=mode)
    if not s.is_art():
        # fully season-responsive across the whole diamond
        s.poly([(0, 0), (1, 0), (1, 1), (0, 1)], s.SEASON[True])
        return s.render(grain=False)

    # A ground tile must never carry a gradient across its own diamond, or a
    # field of them reads as quilting — each tile announces its own edges.
    # Flat base, decoration only, and a half-pixel bleed so antialiased
    # neighbours overlap instead of leaving hairline seams.
    bleed = 0.008
    s.poly([(-bleed, -bleed), (1 + bleed, -bleed),
            (1 + bleed, 1 + bleed), (-bleed, 1 + bleed)], P.SAGE)

    cid = s.clip([(-bleed, -bleed), (1 + bleed, -bleed),
                  (1 + bleed, 1 + bleed), (-bleed, 1 + bleed)])
    s.add('<g clip-path="url(#%s)">' % cid)
    # tonal patches keep a field of these tiles from reading as a flat grid
    # Held well inside the diamond: a patch clipped by the tile edge is the
    # other half of why tiled ground reads as a grid.
    for i in range(5):
        r1, r2, r3 = jitter(i + variant * 7.7), jitter(i * 2.3 + variant), jitter(i * 5.1 + variant * 3)
        c = s.pt(0.24 + r1 * 0.52, 0.24 + r2 * 0.52)
        s.add('<ellipse cx="%.2f" cy="%.2f" rx="%.2f" ry="%.2f" fill="%s" opacity=".22"/>'
              % (c[0], c[1], 9 + r3 * 11, 4.5 + r3 * 5,
                 P.SAGE_DARK if r3 > 0.5 else P.light(P.SAGE, 0.30)))
    # blade flecks
    for i in range(26):
        r1, r2, r3 = jitter(i * 1.7 + variant * 11), jitter(i * 3.9 + variant * 5), jitter(i * 0.7 + variant)
        c = s.pt(r1, r2)
        h = 3.0 + r3 * 3.5
        s.path('M%.2f,%.2f q %.2f,%.2f %.2f,%.2f' %
               (c[0], c[1], -0.8 + r3 * 1.6, -h * 0.6, -1.4 + r3 * 2.8, -h),
               stroke=P.SAGE_DARK if r3 > 0.4 else P.light(P.SAGE, 0.42),
               sw=1.5, opacity=0.55)
    s.add('</g>')
    # No grain on ground tiles: per-tile noise is itself a visible grid.
    return s.render(grain=False)


# =============================================================================
# 3. ROUNDED OAK — 1x1, 192 x 256 @1x, season mask
# =============================================================================
OAK_W, OAK_H = 192, 256


def oak(stage=2, mode='base'):
    """stage: 0 sapling, 1 young, 2 mature."""
    s = Scene(OAK_W, OAK_H, origin=(96, 186), name='oak%d' % stage, mode=mode)
    sc = [0.42, 0.70, 1.0][stage]
    trunk_h = 46 * sc + 14
    art = s.is_art()

    # --- trunk: tapered, with a root flare ------------------------------------
    # A box trunk reads as a fence post. This is a silhouette that widens at
    # the ground and narrows under the canopy, with the lit edge on the left.
    if art:
        foot = s.pt(0.5, 0.5, 0)
        top = s.pt(0.5, 0.5, trunk_h)
        wb, wt = 13.0 * sc, 6.4 * sc
        d = ('M%.2f,%.2f C%.2f,%.2f %.2f,%.2f %.2f,%.2f '
             'L%.2f,%.2f C%.2f,%.2f %.2f,%.2f %.2f,%.2f Z') % (
            foot[0] - wb, foot[1],
            foot[0] - wb * 0.62, foot[1] - trunk_h * 0.34,
            top[0] - wt * 1.15, top[1] + trunk_h * 0.30,
            top[0] - wt, top[1],
            top[0] + wt, top[1],
            top[0] + wt * 1.15, top[1] + trunk_h * 0.30,
            foot[0] + wb * 0.62, foot[1] - trunk_h * 0.34,
            foot[0] + wb, foot[1])
        tg = s.lin_grad([(0.0, P.light(P.WARM_BROWN, 0.30), None),
                         (0.42, P.WARM_BROWN, None),
                         (1.0, P.shade(P.WARM_BROWN, 0.36), None)],
                        x1=0, y1=0, x2=1, y2=0, tag='bark')
        s.path(d, fill='url(#%s)' % tg)
        # bark grooves and the root flare shadow
        for i in range(3):
            r = jitter(i * 2.7 + stage)
            gx = foot[0] - wb * 0.45 + r * wb * 0.9
            s.path('M%.2f,%.2f C%.2f,%.2f %.2f,%.2f %.2f,%.2f' % (
                gx, foot[1] - 4, gx - 1.5, foot[1] - trunk_h * 0.35,
                gx + 1.5, foot[1] - trunk_h * 0.62, gx, top[1] + 3),
                stroke=P.shade(P.WARM_BROWN, 0.34), sw=1.4, opacity=0.42)
        s.add('<ellipse cx="%.2f" cy="%.2f" rx="%.2f" ry="%.2f" fill="%s" opacity=".26"/>'
              % (foot[0], foot[1] + 1, 15 * sc, 5.5 * sc, P.INK))

    # --- canopy: overlapping soft lobes, lit from the upper left --------------
    cx, cy = s.pt(0.5, 0.5, trunk_h + 30 * sc)
    lobes = [(-26, 10, 34), (24, 12, 32), (0, -14, 40), (-14, -34, 27), (18, -30, 25)]
    if art:
        for i, (dx, dy, r) in enumerate(lobes):
            rr = r * sc
            gid = s.rad_grad([(0.0, P.light(P.SAGE, 0.40), None),
                              (0.55, P.SAGE, None),
                              (1.0, P.shade(P.SAGE, 0.30), None)],
                             cx='34%', cy='28%', r='78%', tag='leaf%d' % i)
            s.add('<ellipse cx="%.2f" cy="%.2f" rx="%.2f" ry="%.2f" fill="url(#%s)"/>'
                  % (cx + dx * sc, cy + dy * sc, rr, rr * 0.86, gid))
        # under-canopy occlusion, then a warm top rim
        s.add('<ellipse cx="%.2f" cy="%.2f" rx="%.2f" ry="%.2f" fill="%s" opacity=".26"/>'
              % (cx, cy + 20 * sc, 44 * sc, 15 * sc, P.SAGE_DARK))
        s.add('<ellipse cx="%.2f" cy="%.2f" rx="%.2f" ry="%.2f" fill="%s" opacity=".40"/>'
              % (cx - 16 * sc, cy - 34 * sc, 22 * sc, 12 * sc, P.light(P.SAGE, 0.55)))
        # a few amber leaf specks for texture at hero size
        for i in range(9):
            r1, r2 = jitter(i * 4.3 + stage), jitter(i * 2.1 + stage * 3)
            s.add('<circle cx="%.2f" cy="%.2f" r="%.2f" fill="%s" opacity=".55"/>'
                  % (cx + (r1 - 0.5) * 84 * sc, cy + (r2 - 0.5) * 74 * sc,
                     1.6 + r1 * 1.4, P.AMBER if r2 > 0.6 else P.light(P.SAGE, 0.5)))
    else:
        # season mask: canopy fully responsive, trunk not at all
        for dx, dy, r in lobes:
            s.add('<ellipse cx="%.2f" cy="%.2f" rx="%.2f" ry="%.2f" fill="%s"/>'
                  % (cx + dx * sc, cy + dy * sc, r * sc, r * sc * 0.86, s.SEASON[True]))
    return s.render(grain=art)


def oak_shadow(stage=2):
    sc = [0.42, 0.70, 1.0][stage]
    return contact_shadow(OAK_W, OAK_H, 96, 190, 52 * sc, 21 * sc, 'oak_sh')


# =============================================================================
# 4. WOODEN BENCH — 128 x 96 @1x, customisable
# =============================================================================
def bench(mode='base'):
    s = Scene(128, 96, origin=(64, 34), name='bench', mode=mode)
    x0, x1 = 0.10, 0.90
    ya, yb = 0.34, 0.66
    seat_z, back_z = 26.0, 52.0

    # legs
    for lx in (x0 + 0.06, x1 - 0.18):
        s.box(lx, ya + 0.02, lx + 0.12, yb - 0.02, 0, seat_z,
              P.WARM_BROWN, rim=False, slot='secondary')
    # seat slab
    s.box(x0, ya, x1, yb, seat_z, seat_z + 7, P.WARM_BROWN, rim=True, slot='primary')
    # backrest
    s.box(x0, ya, x1, ya + 0.09, seat_z + 6, back_z, P.WARM_BROWN,
          rim=True, slot='primary')
    # plank seams along the seat
    if s.is_art():
        for t in (0.34, 0.66):
            yy = ya + (yb - ya) * t
            a, b = s.pt(x0, yy, seat_z + 7), s.pt(x1, yy, seat_z + 7)
            s.path('M%.2f,%.2f L%.2f,%.2f' % (a[0], a[1], b[0], b[1]),
                   stroke=P.shade(P.WARM_BROWN, 0.34), sw=1.6, opacity=0.5)
    return s.render(grain=s.is_art())


def bench_shadow():
    return contact_shadow(128, 96, 64, 34 + 30, 44, 15, 'bench_sh')
