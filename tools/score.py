# -*- coding: utf-8 -*-
"""
Longmen Ruckus (龍門鬧江湖) - the original score: every melody, chord progression and drum pattern here was written
for this game. tools/render_music.py plays it with recorded instruments through the sampler of Longmen Quest II
(C:/LongmenQuest2/tools/orch.py, CC0 samples), into ../audio/*.m4a.

Score format: see C:/LongmenQuest2/tools/music.py (NOTE:dur in 16th steps, | bar lines checked, [..]*N repeats,
drum letters k s h o c g w v t T R). The parsing helpers are borrowed from that file.
"""
import importlib.util
import os

_spec = importlib.util.spec_from_file_location('lq2_music_helpers', os.environ.get('LQ2_MUSIC', 'C:/LongmenQuest2/tools/music.py'))
_H = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_H)
parse, parse_drums, harm, chord_pcs, bass_line, arp_line, midi_of = _H.parse, _H.parse_drums, _H.harm, _H.chord_pcs, _H.bass_line, _H.arp_line, _H.midi_of


def D(*bars):
    return '|'.join(bars) + '|'


T = {}

# ---- title 「江湖開鑼」: the gong opens the show - a festive pentatonic tune in C
title_mel = '''
G4:2 A4:2 C5:2 D5:2 E5:4 D5:2 C5:2 | D5:2 E5:2 G5:4 E5:4 r:4 | A5:4 G5:2 E5:2 D5:2 C5:2 D5:4 | ~E5:12 r:4 |
G4:2 A4:2 C5:2 D5:2 E5:4 G5:4 | A5:2 G5:2 E5:2 G5:2 A5:4 C6:4 | D6:4 C6:2 A5:2 G5:4 E5:4 | !G5:12 r:4 |
C6:4 A5:2 G5:2 A5:4 E5:4 | G5:2 E5:2 D5:2 C5:2 D5:8 | E5:2 G5:2 A5:2 C6:2 D6:4 C6:4 | ~A5:12 r:4 |
C6:2 D6:2 C6:2 A5:2 G5:4 E5:4 | D5:2 E5:2 G5:2 A5:2 G5:8 | E5:4 D5:2 C5:2 D5:4 E5:4 | C5:12 r:4 |'''
title_ch = ['C', 'G', 'Am', 'Em', 'C', 'F', 'G', 'G', 'Am', 'Em', 'F', 'Am', 'F', 'C', 'G', 'C']
title_dr = D('g...........ssss', 'k.h.s.h.k.k.s.h.', 'k.h.s.h.k.k.s.h.', 'k.h.s.h.k.s.ssss',
             'c.h.s.h.k.k.s.h.', 'k.h.s.h.k.k.s.hh', 'k.h.s.h.k.k.s.h.', 'k.h.s.h.kkt.t.tt',
             'c.h.s.h.k.k.s.h.', 'k.h.s.h.k.k.s.hh', 'k.h.s.h.k.k.s.h.', 'k.h.s.h.k.s.ssss',
             'c.h.s.h.k.k.s.h.', 'k.h.s.h.k.k.s.hh', 'k.h.s.h.k.k.s.h.', 'k...s...s.ssc...')
T['title'] = dict(loop=True, sections=[dict(bpm=120, transpose=0, p1=title_mel, p2=arp_line(title_ch, 'up16', 0, lo=55),
    tri=bass_line(title_ch, 'gallop', 0), noise=title_dr)])

# ---- town 「客棧大街」: Longmen Inn Street - a bouncy market tune (F gong)
town_mel = '''
C5:2 r:2 E5:2 G5:2 A5:4 G5:4 | E5:2 D5:2 C5:2 D5:2 E5:8 | G5:2 r:2 A5:2 G5:2 E5:2 D5:2 C5:4 | D5:4 E5:2 D5:2 C5:8 |
C5:2 r:2 E5:2 G5:2 A5:4 C6:4 | D6:2 C6:2 A5:2 G5:2 A5:8 | G5:2 E5:2 D5:2 E5:2 G5:2 E5:2 D5:4 | C5:12 r:4 |
A5:2 r:2 A5:2 G5:2 E5:4 G5:4 | D5:2 r:2 D5:2 E5:2 C5:8 | A4:2 C5:2 D5:2 E5:2 G5:4 A5:4 | G5:12 r:4 |
C6:2 r:2 A5:2 G5:2 A5:4 G5:4 | E5:2 G5:2 E5:2 D5:2 C5:8 | D5:2 E5:2 G5:2 E5:2 D5:2 C5:2 D5:4 | C5:12 r:4 |'''
town_ch = ['C', 'C', 'Am', 'G', 'C', 'F', 'G', 'C', 'F', 'C', 'Am', 'G', 'F', 'C', 'G', 'C']
T['town'] = dict(loop=True, sections=[dict(bpm=116, transpose=5, p1=town_mel, p2=arp_line(town_ch, 'off', 5, lo=57),
    tri=bass_line(town_ch, 'oompah', 5), noise=D(*(['k.w.h.w.k.wvh.w.', 'k.w.h.w.k.w.hwhw'] * 8)))])

# ---- mountain 「萬妖山上」: up the mountain - erhu over strings, a little danger, a lot of mischief (A yu)
mount_mel = '''
A4:4 C5:2 D5:2 E5:4 G5:4 | /A5:6 G5:2 E5:4 D5:4 | C5:2 D5:2 E5:4 D5:2 C5:2 A4:4 | ~E5:12 r:4 |
A4:4 C5:2 D5:2 E5:4 A5:4 | C6:6 A5:2 G5:4 E5:4 | D5:2 E5:2 G5:2 A5:2 G5:4 E5:4 | ~A5:12 r:4 |
E5:4 G5:4 A5:6 G5:2 | E5:4 D5:4 C5:8 | D5:4 E5:2 G5:2 A5:4 C6:4 | !D6:12 r:4 |
C6:4 A5:2 G5:2 E5:4 G5:4 | A5:4 G5:2 E5:2 D5:8 | C5:2 D5:2 E5:2 G5:2 E5:4 D5:4 | A4:12 r:4 |'''
mount_ch = ['Am', 'Am', 'C', 'Em', 'Am', 'F', 'G', 'Am', 'C', 'Am', 'Dm', 'G', 'F', 'C', 'G', 'Am']
T['mountain'] = dict(loop=True, sections=[dict(bpm=100, transpose=0, p1=mount_mel, p2=arp_line(mount_ch, 'broken8', 0, lo=52),
    tri=bass_line(mount_ch, 'walk', 0), noise=D(*(['k...s...k.k.s...', 'k...s...k...s.ss'] * 8)))])

# ---- river 「畫舫遊江」: painted boats - flute and guzheng drifting along (D gong)
river_mel = '''
E5:6 D5:2 C5:4 D5:4 | E5:4 G5:4 A5:8 | G5:6 E5:2 D5:4 C5:4 | D5:12 r:4 |
E5:6 D5:2 C5:4 A4:4 | G4:4 A4:4 C5:8 | D5:4 E5:2 D5:2 C5:4 A4:4 | C5:12 r:4 |
A5:6 G5:2 A5:4 C6:4 | D6:4 C6:4 A5:8 | G5:6 A5:2 G5:4 E5:4 | D5:12 r:4 |
E5:4 G5:4 A5:4 G5:4 | E5:4 D5:4 C5:8 | D5:4 E5:2 G5:2 E5:4 D5:4 | C5:12 r:4 |'''
river_ch = ['C', 'Am', 'Em', 'G', 'Am', 'C', 'F', 'C', 'F', 'Dm', 'C', 'G', 'C', 'Am', 'G', 'C']
T['river'] = dict(loop=True, sections=[dict(bpm=88, transpose=2, p1=river_mel, p2=arp_line(river_ch, 'pluck4', 2, lo=52),
    tri=bass_line(river_ch, 'stride', 2), noise=D(*(['v.......w.......', 'v.......w...w...'] * 8)))])

# ---- minigame 「小試身手」: a quick, driving contest tune (A minor pentatonic)
mg_a = '''
A4:2 A4:2 C5:2 A4:2 D5:2 C5:2 E5:4 | G5:2 E5:2 D5:2 C5:2 D5:2 C5:2 A4:4 | A4:2 A4:2 C5:2 D5:2 E5:2 G5:2 A5:4 | G5:2 E5:2 G5:2 A5:2 E5:8 |
A5:2 A5:2 G5:2 E5:2 G5:2 E5:2 D5:4 | E5:2 E5:2 D5:2 C5:2 D5:2 C5:2 A4:4 | C5:2 D5:2 E5:2 G5:2 A5:2 C6:2 A5:2 G5:2 |'''
mg_mel = mg_a + ' A5:8 r:4 E5:2 G5:2 |' + mg_a + ' !A5:12 r:4 |'
mg_ch = ['Am', 'G', 'Am', 'Em', 'F', 'G', 'C', 'Am'] * 2
T['minigame'] = dict(loop=True, sections=[dict(bpm=140, transpose=0, p1=mg_mel, p2=arp_line(mg_ch, 'roll16', 0, lo=57),
    tri=bass_line(mg_ch, 'drive', 0), noise=D(*(['k.hsk.hsk.hsk.hs', 'k.hsk.hsk.hsksss'] * 7), 'k.hsk.hsk.hsk.hs', 'c.ssssssk.k.ssss'))])

# ---- minigame2 「手忙腳亂」: all thumbs - a comic bassoon and pizzicato romp (C major)
mg2_a = '''
C5:2 r:2 C5:2 r:2 G4:2 A4:2 B4:2 C5:2 | D5:2 r:2 D5:2 r:2 E5:4 r:4 | E5:2 F5:2 G5:2 E5:2 C5:2 D5:2 E5:2 C5:2 | D5:4 G4:4 r:8 |
C5:2 r:2 C5:2 r:2 G4:2 A4:2 B4:2 C5:2 | D5:2 r:2 D5:2 r:2 E5:2 F5:2 G5:4 | A5:2 G5:2 F5:2 E5:2 D5:2 G5:2 B4:2 D5:2 | C5:4 G4:2 C5:2 r:8 |'''
mg2_ch = ['C', 'G', 'C', 'G', 'C', 'C', 'G', 'C'] * 2
T['minigame2'] = dict(loop=True, sections=[dict(bpm=148, transpose=0, p1=mg2_a + mg2_a, p2=arp_line(mg2_ch, 'off', 0, lo=55),
    tri=bass_line(mg2_ch, 'oompah', 0), noise=D(*(['k.w.s.w.k.wws.w.', 'k.w.s.w.k.w.svsv'] * 8)))])

# ---- results 「放榜」: the scores go up (jingle)
T['results'] = dict(loop=False, sections=[dict(bpm=140, transpose=0,
    p1='C5:2 E5:2 G5:2 C6:2 A5:2 C6:2 E6:4 | D6:2 C6:2 A5:2 G5:2 ~C6:8 | r:16 |',
    p2='E4:2 G4:2 C5:2 E5:2 F5:2 A5:2 C6:4 | B5:2 A5:2 F5:2 D5:2 E5:8 | r:16 |',
    tri='C3:8 F2:8 | G2:8 C3:8 | r:16 |', noise='k...s...k.k.s...|k.s.s.ssc.......|................|')])

# ---- final 「江湖第一」: the champion's fanfare (the title tune, then a big cadence)
_fin = '''
G4:2 A4:2 C5:2 D5:2 E5:4 D5:2 C5:2 | D5:2 E5:2 G5:4 E5:4 r:4 | A5:4 G5:2 E5:2 D5:2 C5:2 D5:4 | ~E5:12 r:4 |
G4:2 A4:2 C5:2 D5:2 E5:4 G5:4 | A5:2 G5:2 E5:2 G5:2 A5:4 C6:4 | D6:4 C6:2 A5:2 G5:2 A5:2 D6:4 | ~C6:16 | r:16 |'''
_fin_ch = ['C', 'G', 'Am', 'Em', 'C', 'F', 'G', 'C']
T['final'] = dict(loop=False, sections=[dict(bpm=112, transpose=0, p1=_fin, p2=arp_line(_fin_ch, 'up16', 0, lo=55) + ' r:16 |',
    tri=bass_line(_fin_ch, 'gallop', 0) + ' r:16 |', noise=D('g.......s.s.ssss', 'k.h.s.h.k.k.s.h.', 'k.h.s.h.k.k.s.h.', 'k.h.s.h.k.s.ssss',
                                                       'c.h.s.h.k.k.s.h.', 'k.h.s.h.k.k.s.hh', 'k.h.s.h.k.k.ssss', 'c...............', 'g...............'))])

NAMES = {
    'title': ('江湖開鑼', 'The Gong Opens the Jianghu'),
    'town': ('客棧大街', 'Longmen Inn Street'),
    'mountain': ('萬妖山上', 'Up Myriad Beast Mountain'),
    'river': ('畫舫遊江', 'Painted Boats on the River'),
    'minigame': ('小試身手', 'A Quick Test of Skill'),
    'minigame2': ('手忙腳亂', 'All Thumbs'),
    'results': ('放榜', 'The Scores Go Up'),
    'final': ('江湖第一', 'Champion of the Jianghu'),
}
CHORDS = {'title': title_ch, 'town': town_ch, 'mountain': mount_ch, 'river': river_ch, 'minigame': mg_ch, 'minigame2': mg2_ch, 'final': _fin_ch + [None], 'results': ['C', 'G', None]}

if __name__ == '__main__':
    for k, tr in T.items():
        for s in tr['sections']:
            for ch in ('p1', 'p2', 'tri'):
                ev, n = parse(s[ch], 16, k + ':' + ch)
            print(k, 'ok', n / 16, 'bars', round(n * 60 / s['bpm'] / 4, 1), 's')
