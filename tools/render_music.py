# -*- coding: utf-8 -*-
"""
Renders the Longmen Ruckus score (tools/score.py) with recorded instruments, using the sampler and mixer of
Longmen Quest II (C:/LongmenQuest2/tools/orch.py, read only) and its prepared CC0 sample cache.

  python -P tools/render_music.py <cache_dir> [track ...]      -> audio/<track>.m4a
"""
import importlib.util
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import score  # noqa: E402

LQ2 = os.environ.get('LQ2_TOOLS', 'C:/LongmenQuest2/tools')
spec = importlib.util.spec_from_file_location('lq2_orch', os.path.join(LQ2, 'orch.py'))
orch = importlib.util.module_from_spec(spec)
spec.loader.exec_module(orch)
P = orch.P
C_MAJ = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
CH = score.CHORDS

ARR = {}
# title: dizi tune, strings, guzheng runs, horns and festival drums
ARR['title'] = dict(rt=2.0, wet=0.2, target=-16.0, parts=[
    P('p1', 'dizi', gain=-1, pan=0.05, vel=0.85, rev=0.8),
    P('p1', 'vln', short='vlnsp', oct=-12, gain=-9, pan=-0.35, vel=0.7, rel=0.25),
    P('p2', 'guzheng', gain=-8, pan=0.4, vel=0.65, ring=0.5),
    P('harm', 'vla', scale=C_MAJ, bars=(8, 16), gain=-8, pan=0.3, vel=0.6, rel=0.3),
    P('tri', 'vc', short='vcsp', gain=-8, pan=-0.2, vel=0.75, gate=0.8, lo=36),
    P('tri', 'cbpz', gain=-9, pan=0.15, vel=0.8, oct=-12, lo=28),
    P('pad', 'hn', chords=CH['title'], range=(48, 62), gain=-11, pan=0.25, vel=0.55, att=0.25),
    P('drums', None, kit='wuxia', gain=-1),
])
# town: dizi and flute over pizzicato off-beats, plucked bass, woodblocks
ARR['town'] = dict(rt=1.4, wet=0.16, target=-16.0, parts=[
    P('p1', 'dizi', gain=-1, pan=0.0, vel=0.8, gate=0.8),
    P('p1', 'flst', oct=12, gain=-15, pan=0.35, vel=0.5, short_max=9, skip=lambda st, d, m: d > 3),
    P('p2', 'vlnpz', gain=-6, pan=-0.35, vel=0.75),
    P('p2', 'guzheng', gain=-11, pan=0.45, vel=0.55, ring=0.3),
    P('tri', 'cbpz', gain=-6, pan=0.1, vel=0.85, lo=31),
    P('tri', 'bsn', gain=-12, pan=-0.15, vel=0.7, lo=40),
    P('drums', None, kit='light', gain=-2, map={'k': [('bdsoft', -6), ('bighand', -10)], 'w': [('blockhi', -8)], 'v': [('blocklo', -7)], 'h': [('shaker', -15)]}),
])
# mountain: erhu with slides over strings and horns, steady drum
ARR['mountain'] = dict(rt=2.0, wet=0.22, target=-16.5, parts=[
    P('p1', 'erhu', gain=-1, pan=0.05, vel=0.8, vib=6, rel=0.25, rev=0.9),
    P('p2', 'harp', gain=-10, pan=-0.4, vel=0.6, ring=0.6),
    P('tri', 'vc', short='vcsp', gain=-8, pan=0.2, vel=0.7, gate=0.85, lo=36),
    P('tri', 'cbpz', gain=-11, pan=0.0, vel=0.7, oct=-12, lo=28),
    P('pad', 'vla', chords=CH['mountain'], range=(57, 71), gain=-14, pan=0.35, vel=0.45, att=0.4),
    P('pad', 'hn', chords=CH['mountain'], range=(48, 60), gain=-16, pan=-0.25, vel=0.4, att=0.5, voices=2),
    P('drums', None, kit='wuxia', gain=-4),
])
# river: flute and guzheng, harp, soft strings, woodblock and muyu
ARR['river'] = dict(rt=2.2, wet=0.24, target=-17.0, parts=[
    P('p1', 'fl', gain=-1, pan=0.1, vel=0.72, rel=0.3, rev=0.9),
    P('p2', 'guzheng', gain=-6, pan=-0.35, vel=0.7, ring=1.2),
    P('p2', 'harp', oct=12, gain=-16, pan=0.45, vel=0.4, ring=0.6, skip=lambda st, d, m: st % 8 != 0),
    P('tri', 'vc', gain=-11, pan=0.25, vel=0.55, gate=0.9, lo=36),
    P('tri', 'cbpz', gain=-13, pan=0.0, vel=0.6, oct=-12, lo=28),
    P('pad', 'vla', chords=CH['river'], range=(55, 69), gain=-14, pan=0.3, vel=0.4, att=0.5),
    P('drums', None, kit='light', gain=-5, map={'w': [('blockmid', -9)], 'v': [('muyu', -8)]}),
])
# minigame: trumpet stabs and dizi, driving spiccato, battle drums
ARR['minigame'] = dict(rt=1.5, wet=0.16, target=-15.5, parts=[
    P('p1', 'dizi', gain=-1, pan=0.0, vel=0.85, gate=0.85),
    P('p1', 'tpt', short='tptst', oct=-12, gain=-10, pan=0.3, vel=0.7, short_max=0.15),
    P('p2', 'vlnsp', gain=-9, pan=-0.35, vel=0.7),
    P('tri', 'vc', short='vcsp', gain=-7, pan=0.15, vel=0.8, gate=0.8, lo=36),
    P('tri', 'cb', short='cbsp', gain=-9, pan=0.0, vel=0.75, gate=0.8, lo=28, oct=-12),
    P('pad', 'hn', chords=CH['minigame'], range=(48, 62), gain=-14, pan=0.25, vel=0.5, att=0.2),
    P('drums', None, kit='battle', gain=-1),
])
# minigame2: comic bassoon, pizzicato, glockenspiel winks, blocks
ARR['minigame2'] = dict(rt=1.3, wet=0.14, target=-15.5, parts=[
    P('p1', 'bsn', oct=-12, gain=-2, pan=-0.1, vel=0.85),
    P('p1', 'vlnpz', gain=-6, pan=0.3, vel=0.75),
    P('p1', 'glock', oct=12, gain=-15, pan=0.45, vel=0.5, skip=lambda st, d, m: st % 16 not in (0, 8)),
    P('p2', 'vlnpz', oct=-12, gain=-8, pan=-0.4, vel=0.7),
    P('tri', 'cbpz', gain=-6, pan=0.05, vel=0.85, lo=31),
    P('tri', 'vcpz', gain=-9, pan=0.0, vel=0.8, lo=36),
    P('drums', None, kit='light', gain=-3, map={'w': [('blockhi', -8)], 'v': [('blocklo', -7)], 'k': [('bighand', -5)]}),
])
ARR['results'] = dict(rt=1.8, wet=0.2, target=-15.5, tail=1.8, parts=[
    P('p1', 'tpt', gain=-1, pan=0.0, vel=0.85), P('p1', 'dizi', oct=12, gain=-8, pan=0.2, vel=0.7),
    P('p2', 'hn', gain=-6, pan=-0.3, vel=0.7), P('tri', 'vc', gain=-6, pan=0.1, vel=0.8, lo=36), P('tri', 'cbpz', gain=-9, vel=0.8, lo=28),
    P('drums', None, kit='orch', gain=-2, map={'c': [('crash', -6)]}),
])
ARR['final'] = dict(rt=2.4, wet=0.24, target=-15.5, tail=3.0, parts=[
    P('p1', 'tpt', gain=-1, pan=0.0, vel=0.85, short='tptst', short_max=0.14), P('p1', 'dizi', oct=12, gain=-9, pan=0.2, vel=0.7),
    P('p1', 'vln', oct=-12, gain=-8, pan=-0.35, vel=0.7),
    P('p2', 'guzheng', gain=-9, pan=0.4, vel=0.6, ring=0.6),
    P('tri', 'vc', short='vcsp', gain=-7, pan=-0.2, vel=0.8, lo=36), P('tri', 'cbpz', gain=-9, vel=0.8, oct=-12, lo=28),
    P('pad', 'hn', chords=CH['final'], range=(48, 62), gain=-9, pan=0.25, vel=0.6, att=0.2),
    P('drums', None, kit='battle', gain=-1),
])

orch.M = score
orch.ARR = ARR
orch.TEMPO = 1.0
orch.OUT = os.path.normpath(os.path.join(HERE, '..', 'audio'))
orch.TMP = os.environ.get('LR_MUSIC_TMP', os.path.join(orch.OUT, '_wav'))

if __name__ == '__main__':
    cache = sys.argv[1]
    which = sys.argv[2:] or list(score.T)
    orch.render(cache, which)
    for k in which:                    # the game only uses m4a
        o = os.path.join(orch.OUT, k + '.ogg')
        if os.path.exists(o):
            os.remove(o)
