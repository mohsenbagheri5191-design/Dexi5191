from tools.build import Build
from tools.assets import style_bible as SB

b = Build()
b.sprite('house', 'cottage-starter', SB.cottage('base'), SB.COTTAGE_W, SB.COTTAGE_H, state='base')
b.sprite('house', 'cottage-starter', SB.cottage('mask'), SB.COTTAGE_W, SB.COTTAGE_H, state='mask', kind='mask')
b.sprite('house', 'cottage-starter', SB.cottage_shadow(), SB.COTTAGE_W, SB.COTTAGE_H, state='shadow')

for v in range(4):
    b.sprite('terrain', 'grass', SB.grass(v, 'base'), 128, 64, variant='v%02d' % v, state='base')
b.sprite('terrain', 'grass', SB.grass(0, 'season'), 128, 64, variant='v00', state='seasonmask', kind='seasonmask')

for st, nm in enumerate(('sapling', 'young', 'mature')):
    b.sprite('plant', 'tree-oak', SB.oak(st, 'base'), SB.OAK_W, SB.OAK_H, variant=nm, state='base')
    b.sprite('plant', 'tree-oak', SB.oak(st, 'season'), SB.OAK_W, SB.OAK_H, variant=nm, state='seasonmask', kind='seasonmask')
    b.sprite('plant', 'tree-oak', SB.oak_shadow(st), SB.OAK_W, SB.OAK_H, variant=nm, state='shadow')

b.sprite('decor', 'bench-wooden', SB.bench('base'), 128, 96, state='base')
b.sprite('decor', 'bench-wooden', SB.bench('mask'), 128, 96, state='mask', kind='mask')
b.sprite('decor', 'bench-wooden', SB.bench_shadow(), 128, 96, state='shadow')
b.run()
