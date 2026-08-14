"""Palette lock — ASSET MANIFEST §1.7.

Every colour in the game comes from here. Nothing else is legal.

The one rule that matters beyond the hex list: derivatives are made by
travelling toward *warm* light and *warm* shadow, never toward grey or
black. Darkening toward neutral is what makes cozy art look muddy and
cheap, and darkening toward blue-violet is what made the previous pass
read as dated. Shadows here move toward Ink, which is a warm brown-grey.
"""

# ---- the locked palette -----------------------------------------------------
CREAM       = '#F6F1E7'
CREAM_DARK  = '#EDE4D0'
OFF_WHITE   = '#FBF8F1'
SAGE        = '#A8BFA3'
SAGE_DARK   = '#7A9A78'
WARM_BROWN  = '#8B6F4E'
DUSTY_BLUE  = '#8AA9BF'
TERRACOTTA  = '#D28860'
AMBER       = '#F4C97A'
INK         = '#3F3A34'

LOCKED = {
    'cream': CREAM, 'cream_dark': CREAM_DARK, 'off_white': OFF_WHITE,
    'sage': SAGE, 'sage_dark': SAGE_DARK, 'warm_brown': WARM_BROWN,
    'dusty_blue': DUSTY_BLUE, 'terracotta': TERRACOTTA, 'amber': AMBER,
    'ink': INK,
}

# Banned outright by §1.7. Checked by verify_palette() so a stray colour
# can never reach an exported sprite.
BANNED = {'#000000', '#FFFFFF'}

OUTLINE = INK
OUTLINE_PX_1X = 2       # §1.7: 2px @1x, 6px @3x


# ---- colour maths -----------------------------------------------------------
def _to_rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def _to_hex(rgb):
    return '#%02X%02X%02X' % tuple(max(0, min(255, int(round(c)))) for c in rgb)


def mix(a, b, t):
    """Linear blend, t=0 -> a, t=1 -> b."""
    ra, rb = _to_rgb(a), _to_rgb(b)
    return _to_hex(tuple(ra[i] + (rb[i] - ra[i]) * t for i in range(3)))


# Warm anchors for shading. Shadows travel toward Ink, never toward black;
# light travels toward Off-white, never toward pure white.
_SHADOW_ANCHOR = INK
_LIGHT_ANCHOR = OFF_WHITE
# A touch of amber in the light and terracotta in the shadow is what gives
# the set its warmth. Without this the palette reads clinical.
_LIGHT_WARMTH = AMBER
_SHADOW_WARMTH = TERRACOTTA


def shade(c, amount):
    """Darken toward warm shadow. amount 0..1."""
    out = mix(c, _SHADOW_ANCHOR, amount * 0.86)
    return mix(out, _SHADOW_WARMTH, amount * 0.10)


def light(c, amount):
    """Lighten toward warm light. amount 0..1."""
    out = mix(c, _LIGHT_ANCHOR, amount * 0.82)
    return mix(out, _LIGHT_WARMTH, amount * 0.13)


def alpha(c, a):
    """rgba() string, for soft overlays."""
    r, g, b = _to_rgb(c)
    return 'rgba(%d,%d,%d,%.3f)' % (r, g, b, a)


# ---- isometric face shading -------------------------------------------------
# Light sits high and to the upper left. These are the multipliers each face
# of a box gets, so every object in the game is lit from the same place.
FACE_TOP = 0.00      # fully lit
FACE_LEFT = 0.13     # the lit side wall
FACE_RIGHT = 0.30    # the shaded side wall


def face(c, which):
    """Shade a base colour for a given isometric face."""
    return {
        'top': lambda x: light(x, 0.10),
        'left': lambda x: shade(x, FACE_LEFT),
        'right': lambda x: shade(x, FACE_RIGHT),
    }[which](c)


# ---- guard rails ------------------------------------------------------------
def verify_palette(svg, where=''):
    """Fail loudly if an SVG contains a banned or off-palette colour.

    Catches the two things that actually go wrong in a generated set: a
    hardcoded #000/#fff sneaking into a shadow or a highlight, and any
    colour drifting into the violet range the brief rules out.
    """
    import re
    bad = []
    for hexcol in set(re.findall(r'#[0-9A-Fa-f]{6}', svg)):
        up = '#' + hexcol[1:].upper()
        if up in BANNED:
            bad.append((hexcol, 'banned pure black/white'))
            continue
        r, g, b = _to_rgb(up)
        # Purple/violet guard: blue clearly dominant over green, red pulled up
        # toward blue, and the whole thing dark. That is the signature of the
        # dark purple the brief bans.
        if b > g + 18 and b > r + 10 and (r + g + b) / 3 < 150:
            bad.append((hexcol, 'reads as dark purple'))
    if bad:
        lines = '\n'.join('    %s  — %s' % (c, why) for c, why in sorted(bad))
        raise ValueError('palette violation in %s:\n%s' % (where or 'svg', lines))
    return True
