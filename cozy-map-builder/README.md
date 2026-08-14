# Cozy Map Builder — art pipeline

A separate project from Pinly. Godot isometric city builder; this directory
holds the art generation toolchain and its output, built to `ASSETMANIFEST.md`.

## Why generated, not hand-drawn

The manifest asks for ~4,270 source files, ~9,000 after exporting three
densities. Hand-authoring that is months of studio time, and the two things
most likely to go wrong at that volume are exactly the things a generator
removes:

- **Style drift.** §24 warns that fixing drift after 200 assets is
  catastrophically expensive. Here every surface is shaded by one lighting
  model in `tools/iso.py`, so asset 3,000 is lit identically to asset 1.
- **Mask misalignment.** A customisation mask that is one pixel off its
  sprite produces coloured fringing at runtime. Each asset is authored once
  as a mode-aware function: `mode='base'` paints art, `mode='mask'` paints
  flat §1.5 channel colours through *the same geometry calls*. They cannot
  drift.

## Layout

```
tools/palette.py     §1.7 palette lock + warm shading derivatives + a guard
tools/iso.py         2:1 isometric projection, boxes, hip roofs, AO, rim light
tools/rasterize.mjs  SVG -> PNG via Chromium at @1x/@2x/@3x
tools/build.py       queue -> rasterize -> flatten masks to RGB -> manifest.json
tools/assets/        the asset definitions themselves
out/                 generated PNGs, named per §1.6
```

## Build

```
python3 build_style_bible.py     # writes out/ and out/manifest.json
node review.mjs                  # renders review.png, a composed scene
```

## Conventions enforced in code, not by hand

- **Palette lock (§1.7).** `verify_palette()` runs on every art sprite before
  it is queued and rejects pure black, pure white, and anything reading as
  dark purple. Masks are exempt — their channels are data, not colour.
- **Warm derivatives.** Shading travels toward Ink and terracotta, never
  toward grey or blue. Darkening toward neutral is what makes cozy art look
  muddy; darkening toward violet is what made an earlier pass read as dated.
- **One light.** High and to the upper left, everywhere. Left wall lit, right
  wall shaded, top brightest.
- **No baked shadows (§1.3).** Every placeable ships a separate shadow file
  because placement animation lifts the object away from it.
- **Ground tiles carry no gradient and no grain.** Both make a tiled field
  read as quilting — each tile announcing its own edges. Tiles get a flat
  base, interior-only decoration, and a half-pixel bleed so antialiased
  neighbours overlap instead of leaving seams.

## Status

Style bible only — the §24 approval gate. 5 asset families, 20 sprite
definitions, 60 PNGs across three densities.

| Built | Files |
|---|---|
| Starter cottage — base, customisation mask, shadow | 9 |
| Grass — 4 variants + season mask | 15 |
| Rounded oak — 3 growth stages, each with season mask + shadow | 27 |
| Wooden bench — base, mask, shadow | 9 |

## Not producible here

Flagged early rather than at the end:

- **Audio (§19, 65 files).** No music or SFX generation available. Needs a
  composer, or licensed library tracks.
- **Fonts (§18, 4 files).** Cannot author TTF/OTF. Can select and wire up
  OFL-licensed faces that meet the tabular-figures requirement.
- **Store screenshots and preview video (§21).** Need the built game running.
