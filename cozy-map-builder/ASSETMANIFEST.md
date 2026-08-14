# ASSET MANIFEST — Cozy Map Builder
## Every asset required, with type, format, dimensions, and count

---

## 1. TECHNICAL FOUNDATIONS

Read this section first. Every dimension in this document derives from it.

### 1.1 Isometric grid geometry

Standard **2:1 isometric** projection (each tile is twice as wide as it is tall).

| Grid | Diamond size @1x | Notes |
|---|---|---|
| **Coarse tile** | 128 × 64 px | Houses, pools, large trees snap here |
| **Fine sub-cell** | 32 × 16 px | 4×4 fine cells per coarse tile. Flowers, lanterns, decor |

**Footprint → base diamond formula:**
For an object occupying N × M coarse tiles:
`base width = (N + M) × 64 px` · `base height = (N + M) × 32 px`

| Footprint | Base diamond @1x |
|---|---|
| 1 × 1 | 128 × 64 |
| 2 × 2 | 256 × 128 |
| 3 × 3 | 384 × 192 |
| 4 × 4 | 512 × 256 |

Sprite canvases are taller than the base diamond because objects have height. Canvas
sizes per category are given in each section below.

### 1.2 Authoring and export resolution

- **Author everything at @3x.** Multiply every @1x dimension in this document by 3.
- **Export at @1x, @2x, @3x.** Godot selects by device density.
- All @1x dimensions in this document are divisible by 4 so they scale cleanly.

**Example:** a 2×2 starter cottage is listed as `256 × 320 @1x`. Author it at
`768 × 960`. Export three PNGs: `256×320`, `512×640`, `768×960`.

### 1.3 File formats

| Asset type | Format | Notes |
|---|---|---|
| Sprites | **PNG-32** (RGBA, 8-bit per channel) | Transparent background, no baked shadow |
| Shadows | **PNG-32**, separate file | Must be separate — it detaches during lift animation |
| Masks | **PNG-24** (RGB, no alpha) | Channel-packed, see §1.5 |
| Tilesets | PNG sprite sheet + Godot `.tres` TileSet resource | |
| UI | **SVG** preferred, PNG @3x acceptable | SVG scales perfectly |
| Icons | **SVG** | Single-colour where possible so they can be tinted |
| Fonts | **TTF** or **OTF** | Must include full Latin Extended |
| Music | **OGG Vorbis**, 44.1 kHz, ~160 kbps | Godot's preferred looping format |
| Sound effects | **WAV**, 44.1 kHz, 16-bit mono | Short files; Godot handles these best uncompressed |
| Marketing | PNG (screenshots), JPG acceptable for store banners | |

**No baked shadows in the sprite.** Every placeable object ships with its shadow as a
separate file, because the placement animation lifts the object and separates the
shadow.

### 1.4 Texture atlases

Individual PNGs are the *source of truth*; they get packed into atlases at build time.

| Atlas | Contents | Max size |
|---|---|---|
| `atlas_terrain` | Ground, grass, scatter, water tiles | 2048 × 2048 |
| `atlas_structures` | Houses and their customisation masks | 4096 × 4096 |
| `atlas_edges` | All fence and path tilesets | 2048 × 2048 |
| `atlas_nature` | Trees, plants, flowers, bushes | 2048 × 2048 |
| `atlas_decor` | All decor objects | 2048 × 2048 |
| `atlas_seasonal` | Seasonal overlays and items | 2048 × 2048 |
| `atlas_landmarks` | Toronto landmarks | 4096 × 4096 |
| `atlas_avatar` | Avatar body parts, hair, clothing | 4096 × 4096 |
| `atlas_ui` | UI elements and icons | 2048 × 2048 |
| `atlas_vfx` | Particles and effect sprites | 1024 × 1024 |

Keep every atlas at or under 4096 × 4096 — older Android devices fail above this.

### 1.5 Mask channels (critical — read carefully)

Two runtime recolouring systems need mask files.

**A. Customisation mask** — for objects the player recolours (houses, fences, paths).

One RGB PNG per object, same dimensions as the sprite. Each channel marks which pixels
respond to which customisation slot:

| Channel | Controls |
|---|---|
| **Red** | Primary surface (wall colour, fence body, path surface) |
| **Green** | Secondary surface (roof colour, fence posts, path border) |
| **Blue** | Trim / accent (window frames, door, edging) |
| **Black** | Not customisable — renders as authored |

Channel value = blend strength (255 = fully tinted, 128 = half strength). This lets
shading survive tinting, which is what stops recoloured objects looking flat.

**B. Season mask** — for objects that shift with the seasons (all foliage, some ground).

One grayscale PNG per object. White = fully season-responsive, black = never changes.
Runtime multiplies the season tint only where the mask is light.

**Both masks may be omitted** for objects that are neither customisable nor seasonal —
most decor, for example.

### 1.6 Naming convention

```
{category}_{name}_{variant}_{state}@{scale}.png
```

Examples:
```
house_cottage_starter_base@3x.png
house_cottage_starter_mask@3x.png
house_cottage_starter_shadow@3x.png
fence_wicker_tile-06@3x.png
plant_tree_oak_base@3x.png
plant_tree_oak_seasonmask@3x.png
decor_bench_wooden_base@3x.png
```

Lowercase, underscores between words, hyphens inside a compound term. No spaces ever.

### 1.7 Palette lock

Every asset uses only these colours (plus shading derivatives):

```
Cream base      #F6F1E7
Cream dark      #EDE4D0
Off-white       #FBF8F1
Sage            #A8BFA3
Sage dark       #7A9A78
Warm brown      #8B6F4E
Dusty blue      #8AA9BF
Warm terracotta #D28860
Warm amber      #F4C97A
Ink (outline)   #3F3A34
```

**Banned:** pure black `#000000`, pure white `#FFFFFF`, harsh red, neon, dark purple,
hot pink.

**Outlines** use Ink `#3F3A34` at 2px @1x (6px @3x), never pure black.

---

## 2. TERRAIN AND GROUND

| Asset | Type | Canvas @1x | Count | Masks |
|---|---|---|---|---|
| Grass tile (base) | Tile | 128 × 64 | 4 variants | Season |
| Grass tile edge (autotile) | Tileset | 128 × 64 | 16 tiles | Season |
| Dirt / bare ground tile | Tile | 128 × 64 | 3 variants | — |
| Plot boundary marker | Sprite | 128 × 96 | 1 | Customisation |
| Plot corner post | Sprite | 64 × 96 | 1 | Customisation |
| Buildable-zone glow overlay | Sprite | 256 × 128 | 1 | — |
| Ghost placement tint overlay | Shader, not art | — | — | — |
| Grid guide overlay (build mode) | Tile | 128 × 64 | 2 (coarse, fine) | — |

**Empty-plot procedural scatter** — small items dropped by the seeded scatter system:

| Asset | Canvas @1x | Count |
|---|---|---|
| Wildflower cluster | 48 × 48 | 6 variants |
| Small stone | 40 × 32 | 4 variants |
| Mossy stump | 64 × 56 | 3 variants |
| Tall grass tuft | 48 × 56 | 5 variants |
| Fallen twig | 48 × 24 | 3 variants |

**Section total: 51 files** (before shadow and mask variants)

---

## 3. HOUSES

The flagship assets. Each needs a base sprite, a customisation mask, and a shadow.

| House | Footprint | Canvas @1x | Style variants | Files each |
|---|---|---|---|---|
| Starter cottage | 2 × 2 | 256 × 320 | 1 | base + mask + shadow = 3 |
| Woven-thatch cabin | 2 × 2 | 256 × 320 | 1 | 3 |
| Gabled cottage | 3 × 3 | 384 × 448 | 1 | 3 |
| Two-storey townhouse | 3 × 3 | 384 × 512 | 1 | 3 |
| Shopfront with awning | 3 × 3 | 384 × 448 | 1 | 3 |
| Grand house | 4 × 4 | 512 × 576 | 1 | 3 |

**Rotation:** every house needs **4 rotations** (the four isometric facings). Either
author 4 sprites per house, or author 2 and mirror horizontally (cheaper, works for
symmetric designs — check each design individually).

**Component parts** (needed for the customisation system to swap pieces independently):

| Component | Canvas @1x | Variants |
|---|---|---|
| Roof — peaked | 256 × 128 | 4 materials (shingle, thatch, tile, metal) |
| Roof — flat | 256 × 96 | 4 materials |
| Roof — gabled | 384 × 160 | 4 materials |
| Door | 48 × 80 | 6 styles |
| Window — small | 40 × 40 | 5 styles |
| Window — large | 64 × 56 | 5 styles |
| Window — lit overlay (night) | matches window | 10 (one per window style) |
| Awning | 128 × 48 | 4 styles |
| Chimney | 40 × 64 | 3 styles |
| Porch / step | 96 × 48 | 3 styles |

**Prestige / earn-only house variants:** budget **4 additional houses** at launch,
authored at the same specs, visually distinct enough to read as special.

**Section total: 6 houses × 4 rotations × 3 files = 72 files**, plus **50 component
files**, plus **12 prestige files** = **134 files**

---

## 4. FENCES (autotile)

Fences sit on cell edges and auto-connect. Each fence type needs a **16-tile bitmask
set** covering every neighbour configuration.

The 16 tiles: isolated post · 4 end caps · straight horizontal · straight vertical ·
4 corners · 4 T-junctions · cross.

| Fence type | Tile canvas @1x | Tiles | Masks |
|---|---|---|---|
| Woven wicker | 128 × 96 | 16 | Customisation |
| Wooden picket | 128 × 96 | 16 | Customisation |
| Low stone wall | 128 × 88 | 16 | Customisation |
| Garden hedge | 128 × 104 | 16 | Customisation + Season |
| Iron railing | 128 × 96 | 16 | Customisation |

Each set also needs a matching **shadow tileset** (16 tiles).

**Section total: 5 types × 16 tiles × 3 files (base, mask, shadow) = 240 files**

*Cost-saving option: ship 3 fence types at launch instead of 5 → 144 files.*

---

## 5. PATHS (autotile)

Paths are surface tiles that blend. A **16-tile cardinal bitmask** is the minimum and
looks good in a cozy style. A 47-tile blob set looks better on diagonals but triples
the work — **use 16 at launch.**

| Path type | Tile canvas @1x | Tiles | Masks |
|---|---|---|---|
| Cobblestone | 128 × 64 | 16 | Customisation |
| Warm brick | 128 × 64 | 16 | Customisation |
| Wooden planks | 128 × 64 | 16 | Customisation |
| Gravel | 128 × 64 | 16 | Customisation |
| Stepping stones | 128 × 64 | 16 | Customisation |

Paths lie flat — **no shadow files needed.**

**Section total: 5 types × 16 tiles × 2 files (base, mask) = 160 files**

---

## 6. PLANTS

All plants need a **season mask**. All need a shadow.

### Trees

| Tree | Footprint | Canvas @1x | Growth stages |
|---|---|---|---|
| Rounded oak | 1 × 1 | 192 × 256 | 3 (sapling, young, mature) |
| Slender birch | 1 × 1 | 160 × 288 | 3 |
| Blossom tree | 1 × 1 | 192 × 240 | 3 |
| Small fruit tree | 1 × 1 | 160 × 224 | 3 |
| Evergreen | 1 × 1 | 176 × 288 | 3 |
| Large old tree | 2 × 2 | 320 × 384 | 1 |

### Bushes and small plants

| Asset | Canvas @1x | Variants |
|---|---|---|
| Round bush | 96 × 96 | 4 |
| Flowering bush | 96 × 104 | 4 |
| Low hedge block | 128 × 80 | 3 |
| Tall ornamental grass | 64 × 112 | 4 |
| Fern | 80 × 88 | 3 |

### Flowers and beds

| Asset | Canvas @1x | Variants |
|---|---|---|
| Flowerbed (1 fine cell) | 64 × 56 | 8 colours |
| Flowerbed (1 coarse tile) | 128 × 88 | 6 colours |
| Single flower cluster | 48 × 48 | 8 colours |
| Wildflower patch | 96 × 72 | 4 |

### Containers and climbers

| Asset | Canvas @1x | Variants |
|---|---|---|
| Potted plant — small | 56 × 80 | 6 |
| Potted plant — large | 88 × 128 | 4 |
| Hanging planter | 72 × 96 | 4 |
| Window box | 80 × 56 | 3 |
| Climbing vine (autotile, wall-mounted) | 64 × 96 | 8 tiles |
| Garden arch with vine | 160 × 192 | 2 |

**Section total: ~120 base sprites × 3 files (base, season mask, shadow) = 360 files**

---

## 7. WATER

| Asset | Footprint | Canvas @1x | Notes |
|---|---|---|---|
| Small pond | 2 × 2 | 256 × 160 | Animated surface, 8 frames |
| Large pond | 3 × 3 | 384 × 224 | Animated, 8 frames |
| Fountain | 2 × 2 | 256 × 288 | Animated water, 12 frames |
| Stream tile (autotile) | 1 × 1 | 128 × 72 | 16 tiles, animated 8 frames each |
| Well | 1 × 1 | 128 × 176 | Static |
| Water shimmer overlay | — | 128 × 64 | 8 frames, tiles seamlessly |
| Lily pad | fine | 48 × 32 | 4 variants |
| Small dock / jetty | 1 × 2 | 192 × 112 | 1 |

**Section total: ~170 files** (frame counts dominate)

---

## 8. DECOR

The personality layer. Most need only a base sprite and a shadow — no masks unless
noted.

| Asset | Canvas @1x | Variants | Customisable |
|---|---|---|---|
| Bench — wooden | 128 × 96 | 3 styles | Yes |
| Bench — stone | 128 × 88 | 2 styles | Yes |
| Café table | 96 × 96 | 2 | Yes |
| Café chair | 56 × 88 | 3 | Yes |
| Picnic blanket + basket | 128 × 72 | 3 | Yes |
| Lamppost | 64 × 224 | 4 styles | Yes |
| Lamppost — lit overlay | 64 × 224 | 4 | — |
| Mailbox | 48 × 96 | 4 | Yes |
| Birdhouse | 56 × 120 | 3 | Yes |
| Firewood stack | 96 × 72 | 2 | — |
| Wind chimes | 40 × 104 | 3 | — |
| String lights (autotile span) | 128 × 64 | 8 tiles | Yes |
| String lights — lit overlay | 128 × 64 | 8 tiles | — |
| Outdoor rug | 128 × 64 | 6 patterns | Yes |
| Hammock | 192 × 112 | 2 | Yes |
| Signpost (player text) | 64 × 128 | 3 | Yes |
| Bicycle | 112 × 96 | 3 colours | Yes |
| Planter box | 96 × 72 | 3 | Yes |
| Garden swing | 160 × 176 | 2 | Yes |
| Garden gnome / ornament | 40 × 64 | 6 | — |
| Fire pit | 96 × 72 | 2 | — |
| Fire pit — flame overlay | 96 × 96 | 8 frames | — |
| Umbrella / parasol | 128 × 160 | 4 colours | Yes |
| Bird bath | 72 × 104 | 2 | — |
| Trellis | 96 × 160 | 2 | Yes |
| Small shed | 2 × 2 / 256 × 256 | 2 | Yes |
| Bunting / banner (autotile span) | 128 × 48 | 8 tiles | Yes |
| Stack of crates | 88 × 96 | 3 | — |
| Barrel | 56 × 72 | 3 | — |
| Watering can | 40 × 48 | 2 | — |
| Basket | 48 × 40 | 3 | — |
| Wheelbarrow | 96 × 72 | 2 | — |

**Section total: ~130 base sprites, ~90 with masks, all with shadows ≈ 350 files**

---

## 9. SEASONAL ASSETS

Most seasonal change is runtime colour tinting (§1.5), which costs no art. These are
the **overlays and items that tinting cannot fake.**

### Overlays (applied across the world)

| Asset | Canvas @1x | Frames | Season |
|---|---|---|---|
| Snow overlay — ground (autotile) | 128 × 64 | 16 tiles | Winter |
| Snow overlay — roof caps | matches each roof type | 12 | Winter |
| Snow overlay — object dusting | 128 × 128 | 8 generic | Winter |
| Fallen leaves — ground (autotile) | 128 × 64 | 16 tiles | Autumn |
| Blossom petal — ground scatter | 96 × 48 | 6 | Spring |
| Puddle overlay | 96 × 48 | 4 | Spring |

### Particles

| Asset | Canvas @1x | Frames |
|---|---|---|
| Falling snowflake | 16 × 16 | 4 shapes |
| Drifting blossom petal | 24 × 24 | 6 |
| Falling leaf | 32 × 32 | 6 |
| Summer pollen mote | 12 × 12 | 3 |

### Seasonal decor items

| Season | Items | Each canvas @1x |
|---|---|---|
| **Spring** | Blossom garland, tulip bed, spring bunting, nest box | ~96 × 96 |
| **Summer** | Paper lantern, parasol, ice-cream cart (2×2), lemonade stand (2×2) | up to 256 × 256 |
| **Autumn** | Pumpkin (3 sizes), leaf pile, harvest basket, corn stack, scarecrow | up to 128 × 192 |
| **Winter** | Wreath, snowman, warm lantern, gift stack, ice-skate rack | up to 128 × 160 |

**Section total: ~140 files**

---

## 10. TORONTO LANDMARKS

Stylised, non-buildable, display-only. Large hero assets — these are the "wow" moments
when panning the city.

| Landmark | Canvas @1x | Notes |
|---|---|---|
| CN Tower | 320 × 896 | Tallest asset in the game; needs a lit overlay for night |
| Casa Loma | 512 × 384 | |
| Union Station | 640 × 320 | |
| Rogers Centre | 512 × 288 | Domed roof |
| Nathan Phillips Square + rink | 512 × 256 | Rink needs an animated shimmer, 8 frames |
| Royal Ontario Museum | 448 × 320 | The crystal facet is the recognisable feature |
| Ripley's Aquarium | 384 × 224 | |
| Distillery District | 512 × 288 | Cluster of small brick buildings |
| St. Lawrence Market | 448 × 256 | |
| Toronto Islands | 768 × 384 | Wide, low, tree-covered |

Each needs: **base sprite · night-lit overlay · shadow** = 3 files.
Nathan Phillips Square and the Islands need season masks.

**Section total: 32 files**

---

## 11. CIVIC OBJECTS

Placed on shared city land. Should read as slightly more "official" than personal decor
— a touch more uniform, a touch more municipal.

| Asset | Canvas @1x | Variants |
|---|---|---|
| Civic lamppost | 64 × 240 | 2 |
| Civic lamppost — lit overlay | 64 × 240 | 2 |
| Boulevard tree | 192 × 288 | 3 |
| Civic bench | 128 × 96 | 2 |
| Civic flowerbed | 128 × 80 | 4 |
| Fountain (large, plaza) | 384 × 320 | 1, animated 12 frames |
| Public sculpture | 128 × 224 | 4 |
| Small bridge | 256 × 128 | 2 |
| Planter (municipal) | 96 × 88 | 2 |

**Section total: ~55 files** (all need shadows; trees need season masks)

---

## 12. THE AVATAR SYSTEM

**Critical technical decision: use skeletal (cutout) animation, not frame-by-frame.**

Frame-by-frame would require every clothing item to be redrawn across ~116 frames per
direction. Skeletal animation means each clothing item is a **small set of static
pieces** attached to a rig — dramatically cheaper and the only realistic path to a
large wardrobe.

### 12.1 Rig

One shared skeleton, used by every player. Body parts as separate sprites:

| Part | Canvas @1x | Notes |
|---|---|---|
| Head | 96 × 96 | Recolourable (skin) |
| Torso | 80 × 88 | Recolourable |
| Upper arm (L, R) | 40 × 56 | Recolourable |
| Forearm + hand (L, R) | 40 × 56 | Recolourable |
| Thigh (L, R) | 44 × 56 | Recolourable |
| Shin + foot (L, R) | 44 × 60 | Recolourable |
| Face — eyes | 48 × 24 | 6 variants + blink frames |
| Face — mouth | 40 × 20 | 8 expressions |

**Directions:** 4 isometric facings (NE, SE, SW, NW). Author 2 and mirror for the other
2 where the design is symmetric.

**Total body: ~14 parts × 4 directions = 56 base part files**

### 12.2 Animations

Built from the rig, not drawn as frames:

| Animation | Length | Loops |
|---|---|---|
| Idle (with breathing) | 2.5s | Yes |
| Blink | 0.2s | Triggered randomly |
| Walk | 0.8s | Yes |
| Place / build gesture | 1.2s | No |
| Sit | 0.5s in, hold | Hold |
| Wave / greet | 1.5s | No |

**Presence avatars in friends' towns use the idle loop only**, running locally.

### 12.3 Hair

Each hairstyle is a set of pieces attached to the head bone.

| Piece | Canvas @1x |
|---|---|
| Hair — back layer | 112 × 112 |
| Hair — front layer | 112 × 112 |

**Launch target: 24 hairstyles × 2 layers × 4 directions = 192 files**
Each hairstyle ships with a **recolour mask** so it supports the full colour range →
**+192 mask files**

Hair colour palette: 16 colours minimum (natural range plus a few pastels).

### 12.4 Clothing

| Slot | Pieces per item | Canvas @1x |
|---|---|---|
| **Top** | Torso + 2 upper arms + 2 forearms = 5 | matches body parts |
| **Bottom** | 2 thighs + 2 shins = 4 | matches body parts |
| **Shoes** | 2 feet = 2 | 44 × 40 |
| **Hat** | 1 | 112 × 96 |
| **Glasses** | 1 | 72 × 32 |
| **Scarf / accessory** | 1–2 | 88 × 64 |
| **Bag** | 1 | 64 × 72 |

**Launch wardrobe target:**

| Slot | Items | Pieces each | × 4 directions | Files |
|---|---|---|---|---|
| Tops | 30 | 5 | 4 | 600 |
| Bottoms | 24 | 4 | 4 | 384 |
| Shoes | 16 | 2 | 4 | 128 |
| Hats | 20 | 1 | 4 | 80 |
| Glasses | 10 | 1 | 4 | 40 |
| Scarves / accessories | 12 | 2 | 4 | 96 |
| Bags | 8 | 1 | 4 | 32 |

**Section total: ~1,360 clothing files + 384 hair files + 56 body files ≈ 1,800 files**

**This is by far the largest single art cost in the project.** Consider launching with
half this wardrobe (roughly 900 files) and adding pieces as seasonal content drops —
which doubles as retention content.

---

## 13. COMPANION PETS

| Pet | Canvas @1x | Animations |
|---|---|---|
| Cat | 96 × 96 | Idle, walk, sit, sleep, stretch |
| Dog | 112 × 104 | Idle, walk, sit, sleep, wag |
| Rabbit | 80 × 88 | Idle, hop, sit, sleep, twitch |
| Fox | 104 × 96 | Idle, walk, sit, sleep, curl |

Each: 4 directions, ~5 animations. Skeletal animation recommended here too.
Each pet needs 3–5 colour variants (recolour mask).

**Section total: ~4 pets × 4 directions × ~12 parts = 192 files, + masks**

---

## 14. AMBIENT LIFE

| Asset | Canvas @1x | Frames |
|---|---|---|
| Small bird — perched | 40 × 40 | Idle 4, hop 4 |
| Small bird — flying | 56 × 40 | 6 |
| Butterfly | 32 × 32 | 6 |
| Frog | 48 × 40 | Idle 4, hop 4 |
| Dragonfly | 40 × 24 | 4 |
| Firefly (night) | 12 × 12 | 3 |

3 colour variants each.

**Section total: ~90 files**

---

## 15. PARTICLES AND VFX

| Effect | Canvas @1x | Frames |
|---|---|---|
| Placement dust puff | 64 × 48 | 6 |
| Placement sparkle | 48 × 48 | 8 |
| Delete dissolve particle | 24 × 24 | 6 |
| Credit coin | 32 × 32 | 8 (spin) |
| Tip sparkle burst | 128 × 128 | 12 |
| Tip petal | 24 × 24 | 4 |
| Level-up glow | 192 × 192 | 12 |
| Reward arc trail | 16 × 16 | 4 |
| Water ripple | 64 × 32 | 8 |
| Smoke wisp (chimney) | 48 × 64 | 8 |
| Night bloom halo | 96 × 96 | 1 (shader-scaled) |
| Overgrowth vine (decay) | 96 × 128 | 5 density stages |
| Overgrowth wildflower (decay) | 64 × 64 | 5 density stages |

**Section total: ~95 files**

---

## 16. UI KIT

All SVG where possible.

### 16.1 Panels and containers

| Element | Size @1x | Notes |
|---|---|---|
| Bottom drawer background | 1080 × 640 | 9-slice, rounded top corners |
| Right-side panel background | 400 × 1400 | 9-slice |
| Card background — small | 640 × 240 | 9-slice |
| Card background — large | 960 × 1200 | 9-slice |
| Modal background | 880 × 640 | 9-slice |
| Tooltip bubble | 320 × 120 | 9-slice with tail |
| Divider line | 4 × 4 | Tiled |
| Scroll indicator | 8 × 64 | |

### 16.2 Buttons and controls

| Element | Size @1x | States |
|---|---|---|
| Primary button | 320 × 96 | default, pressed, disabled |
| Secondary button | 280 × 88 | 3 states |
| Icon button — round | 96 × 96 | 3 states |
| Icon button — small | 64 × 64 | 3 states |
| Tab (drawer category) | 128 × 96 | active, inactive |
| Toggle switch | 96 × 56 | on, off |
| Slider track + handle | 400 × 48 | |
| Colour swatch | 72 × 72 | default, selected |
| Item tile (build drawer) | 160 × 200 | default, selected, locked |
| Close button | 64 × 64 | 2 states |
| Back chevron | 48 × 48 | |

### 16.3 HUD

| Element | Size @1x |
|---|---|
| Credits counter background | 280 × 88 |
| Credit icon | 48 × 48 |
| Menu button | 96 × 96 |
| Build button | 128 × 128 |
| Undo button | 80 × 80 |
| Redo button | 80 × 80 |
| Health bar — track + fill | 320 × 32 |
| XP bar — track + fill | 480 × 24 |
| Level badge | 72 × 72 |
| Unread pulsing dot | 24 × 24 |

### 16.4 Profile and social

| Element | Size @1x | Count |
|---|---|---|
| Avatar frame — standard | 240 × 240 | 1 |
| Avatar frame — earned/prestige | 280 × 280 | **20 designs** |
| Badge | 96 × 96 | **30 designs** |
| Achievement icon | 80 × 80 | **40 designs** |
| Founder badge | 96 × 96 | 3 tiers |
| Follow / following icon | 48 × 48 | 2 states |

**Section total: ~180 UI files**

---

## 17. ICONS

Rounded, chunky, felt-cut. Single-colour SVG so they can be tinted at runtime.
**Standard size 48 × 48 @1x**, drawn on a 48-unit grid with consistent 4-unit stroke.

**Navigation & system (14):** menu · back · close · settings · home · map · search ·
filter · sort · more · help · info · check · plus

**Build (12):** build · house · fence · path · plant · decor · water · seasonal ·
rotate · move · delete · undo / redo

**Social (14):** friends · add friend · message · send · block · report · follow ·
following · visit · tip · profile · online dot · badge · achievement

**Economy (10):** credit · shop · cosmetics · materials · season pass · cart · gift ·
upkeep · lease · sell

**Status (10):** healthy · needs care · overgrown · locked · unlocked · new · featured ·
hidden gem · notification bell · warning (terracotta)

**Settings (10):** account · notifications · privacy · sound · music · ambience ·
display · accessibility · legal · logout

**Section total: 70 icons**

---

## 18. FONTS

| Use | Requirement |
|---|---|
| **UI primary** | Rounded, friendly, geometric sans-serif. Weights: Regular, Medium, Bold. Must include **tabular figures** so animated counters do not jitter |
| **In-world signs** | Small pixel-style display face, Regular only |
| **Numerals** | Can be the UI font if it has tabular figures |

**Character coverage required:** Latin Extended (for European names), plus common
punctuation and currency symbols. Add CJK only if launching in those markets.

**Licence:** must permit commercial use and embedding in an app. Check this before
committing — retrofitting a font swap is painful.

**Files: 4** (3 UI weights + 1 pixel face)

---

## 19. AUDIO

### 19.1 Music

| Track | Length | Format | Notes |
|---|---|---|---|
| Main theme (town, day) | 3–4 min | OGG, looping | Warm, gentle, marimba-led |
| Town — dusk variant | 3–4 min | OGG, looping | Softer, warmer |
| Town — night variant | 3–4 min | OGG, looping | Sparse, quiet |
| Map / exploration | 3 min | OGG, looping | Slightly more open |
| Shop | 2 min | OGG, looping | Light, curious |
| Loading / splash | 30 s | OGG, looping | Short and inviting |

**6 tracks.** Cross-fade between day/dusk/night variants rather than hard-cutting.

### 19.2 Ambience beds

| Bed | Length | Notes |
|---|---|---|
| Morning (birdsong) | 2 min loop | |
| Day (light wind, distant life) | 2 min loop | |
| Dusk (insects, settling) | 2 min loop | |
| Night (quiet, crickets) | 2 min loop | |
| Near water | 1 min loop | Layered when close to ponds |

**5 beds.**

### 19.3 Sound effects

All WAV, 44.1 kHz, 16-bit mono, kept under 2 seconds unless noted.

**Building (12):** place object · place — heavy · place — light · pick up · rotate ·
delete dissolve · invalid placement (soft low tone) · undo · redo · fence connect ·
path connect · house upgrade

**UI (14):** button tap · button — primary · panel open · panel close · drawer open ·
drawer close · tab switch · toggle on · toggle off · swatch select · scroll tick ·
modal open · modal close · back

**Economy (10):** credits earned (marimba arpeggio) · credits spent · counter tick
(single, pitched, repeated for the tick-up animation) · daily reward · level up ·
milestone reached · purchase confirmed · upkeep paid · item unlocked · task complete

**Social (8):** tip received (chime + sparkle) · tip sent · message received · message
sent · friend request received · friend accepted · visitor arrived · fly-over whoosh
(soft, 3 s)

**World (10):** door open · door close · water splash · fountain loop (10 s loop) ·
wind chime (3 variants) · footstep on grass · footstep on path · footstep on wood ·
pet sound (4: cat, dog, rabbit, fox) · bird call (3 variants)

**Section total: 6 music + 5 ambience + ~54 SFX = 65 audio files**

---

## 20. LOADING SCREEN AND KEY ART

| Asset | Size | Notes |
|---|---|---|
| Loading illustration — base scene | 1080 × 1920 @3x | Cozy town at dusk |
| Loading — window lit overlays | matched layers | **12 separate window layers** that light up one by one as progress advances |
| Loading — lamppost glow layer | matched | Grows with progress |
| Loading — drifting petal sprites | 24 × 24 | 6 |
| Splash logo | 800 × 800 | Transparent PNG + SVG |
| Empty state illustration — no friends | 640 × 480 | |
| Empty state illustration — no messages | 640 × 480 | |
| Empty state illustration — nothing found | 640 × 480 | |
| Welcome-back card illustration | 720 × 400 | |
| Error state illustration | 640 × 480 | Gentle, never alarming |

**Section total: ~28 files**

---

## 21. APP ICON AND STORE ASSETS

### 21.1 App icon

| Platform | Size | Format |
|---|---|---|
| iOS master | 1024 × 1024 | PNG, no alpha, no rounded corners (Apple applies them) |
| Android adaptive — foreground | 432 × 432 | PNG with alpha, safe zone 264 × 264 centred |
| Android adaptive — background | 432 × 432 | PNG, solid or simple pattern |
| Android legacy | 512 × 512 | PNG |
| Play Store listing | 512 × 512 | PNG, 32-bit with alpha |

### 21.2 Screenshots

**iOS (required sizes):**

| Device | Portrait size |
|---|---|
| 6.9" (iPhone 16 Pro Max class) | 1320 × 2868 |
| 6.7" | 1290 × 2796 |
| 6.5" | 1242 × 2688 |
| 5.5" | 1242 × 2208 |
| iPad Pro 12.9" | 2048 × 2732 |

**Android:** minimum 320 px, maximum 3840 px on the longest side, 9:16 portrait.
Supply at 1080 × 1920.

**Count: 6–8 screenshots per size.** Show: a beautiful town, the build drawer in use,
the map view of Toronto, visiting a friend, the avatar, a seasonal scene.

### 21.3 Other store assets

| Asset | Size |
|---|---|
| Play Store feature graphic | 1024 × 500 |
| App preview video (iOS) | 1080 × 1920, 15–30 s, .mov or .mp4 |
| Promo video (Android) | YouTube link |

**Section total: ~50 files**

---

## 22. TOTALS

| Section | Files (approx) |
|---|---|
| Terrain and ground | 51 |
| Houses | 134 |
| Fences | 240 |
| Paths | 160 |
| Plants | 360 |
| Water | 170 |
| Decor | 350 |
| Seasonal | 140 |
| Landmarks | 32 |
| Civic objects | 55 |
| **Avatar system** | **1,800** |
| Companion pets | 192 |
| Ambient life | 90 |
| Particles and VFX | 95 |
| UI kit | 180 |
| Icons | 70 |
| Fonts | 4 |
| Audio | 65 |
| Loading and key art | 28 |
| Store assets | 50 |
| **TOTAL** | **≈ 4,270 files** |

Exported at three densities where applicable, this lands around **9,000–10,000 shipped
files**, roughly **400–700 MB** of source art and **80–150 MB** in the packed build
after atlas compression.

---

## 23. CUTTING SCOPE

If this is too much (it probably is for a first build), cut in this order. Each cut
preserves the game's identity.

| Cut | Saves | Cost |
|---|---|---|
| **Halve the wardrobe** (15 tops, 12 bottoms, 8 shoes, 10 hats) | ~900 files | Least painful — clothing is your best post-launch content drop |
| **3 fence types instead of 5** | ~96 files | Barely noticeable |
| **3 path types instead of 5** | ~64 files | Barely noticeable |
| **4 houses instead of 6** | ~48 files | Noticeable but survivable |
| **1 pet instead of 4** | ~144 files | Players will ask for more — good demand signal |
| **Skip growth stages on trees** | ~60 files | Minor |
| **5 landmarks instead of 10** | ~16 files | Keep CN Tower, Casa Loma, Union Station, Nathan Phillips, the Islands |
| **Defer all seasonal decor items** | ~80 files | Keep the tinting and overlays — they carry most of the effect |

**Minimum viable beautiful build: ~2,400 files.** Still substantial, but roughly half.

---

## 24. WHAT TO GIVE AN ARTIST

When commissioning, provide:

1. This document
2. The palette hex list (§1.7)
3. The reference image (the pastel isometric building)
4. **A style bible** — 3–5 finished assets they produce first, approved before bulk
   work begins. Always commission these first. Fixing style drift after 200 assets is
   catastrophically expensive.
5. The grid geometry (§1.1) and mask spec (§1.5) — most artists have not worked with
   channel-packed customisation masks and need this explained up front
6. Naming convention (§1.6)

**Order of commissioning:** style bible → houses → terrain and fences → plants →
decor → avatar system → everything else. Houses set the style for everything that
follows.
