"""Build driver — collects sprite definitions, rasterizes, post-processes.

Contract per ASSET MANIFEST:
  §1.2  author @3x, export @1x/@2x/@3x
  §1.3  sprites PNG-32 RGBA, shadows a separate PNG-32, masks PNG-24 RGB
  §1.5  customisation mask is channel-packed R/G/B; season mask is grayscale
  §1.6  {category}_{name}_{variant}_{state}@{scale}.png
"""
import json
import os
import subprocess
import sys

from . import palette as P

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'out')
NODE_ENV = dict(os.environ, NODE_PATH='/opt/node22/lib/node_modules')


class Build:
    def __init__(self, outdir=OUT):
        self.outdir = outdir
        self.jobs = []
        self.masks = []       # (path_stem, kind) to post-process after raster
        self.manifest = []

    # ---- queueing -----------------------------------------------------------
    def sprite(self, category, name, svg, w, h, variant=None, state='base',
               scales=(1, 2, 3), kind='sprite'):
        """Queue one file. Returns its path stem (no @Nx.png)."""
        # Masks encode channel data, not colour, so the palette lock does
        # not apply to them — only to anything a player actually sees.
        if kind == 'sprite':
            P.verify_palette(svg, where='%s/%s' % (category, name))
        parts = [category, name] + ([variant] if variant else []) + [state]
        stem = os.path.join(self.outdir, category, '_'.join(str(p) for p in parts))
        self.jobs.append({'svg': svg, 'out': stem, 'w': w, 'h': h,
                          'scales': list(scales)})
        if kind in ('mask', 'seasonmask'):
            self.masks.append((stem, kind, list(scales)))
        self.manifest.append({'category': category, 'name': name,
                              'variant': variant, 'state': state,
                              'kind': kind, 'w': w, 'h': h,
                              'stem': os.path.relpath(stem, ROOT)})
        return stem

    # ---- execution ----------------------------------------------------------
    def run(self):
        if not self.jobs:
            print('nothing queued')
            return
        jobfile = os.path.join(self.outdir, '_jobs.json')
        os.makedirs(self.outdir, exist_ok=True)
        with open(jobfile, 'w') as f:
            json.dump(self.jobs, f)

        r = subprocess.run(
            ['node', os.path.join(ROOT, 'tools', 'rasterize.mjs'), jobfile],
            capture_output=True, text=True, env=NODE_ENV, cwd=ROOT)
        if r.returncode != 0:
            sys.exit('rasterizer failed:\n%s\n%s' % (r.stdout[-3000:], r.stderr[-3000:]))
        print('rasterized:', r.stdout.strip())

        self._post_process_masks()
        os.remove(jobfile)

        mf = os.path.join(self.outdir, 'manifest.json')
        with open(mf, 'w') as f:
            json.dump(self.manifest, f, indent=1)
        print('%d sprite defs -> %s' % (len(self.manifest), os.path.relpath(mf, ROOT)))

    def _post_process_masks(self):
        """Masks ship without alpha (§1.3: PNG-24 RGB).

        Chromium always gives us RGBA, so flatten onto black — black means
        'not customisable', which is exactly the right default for any pixel
        the mask author left transparent.
        """
        from PIL import Image
        n = 0
        for stem, kind, scales in self.masks:
            for s in scales:
                p = '%s@%dx.png' % (stem, s)
                if not os.path.exists(p):
                    continue
                im = Image.open(p).convert('RGBA')
                flat = Image.new('RGB', im.size, (0, 0, 0))
                flat.paste(im, mask=im.split()[3])
                if kind == 'seasonmask':
                    flat = flat.convert('L').convert('RGB')
                flat.save(p)
                n += 1
        if n:
            print('flattened %d mask files to RGB' % n)
