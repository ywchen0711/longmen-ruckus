# Credits

龍門鬧江湖 Longmen Ruckus is an original game. Its rules, boards, events, items, minigames, dialogue, art direction,
music and code were made for it. It is a genre take on party board games (roll, move, buy the goal item, a minigame
every round) and uses no names, characters, boards, minigame designs, art, music or interface from any commercial
party game.

## Art (original)
- **The cast:** 奕叡, 奕碩, 冷笑天, 柳寒煙, 苦禪, 屠千秋, 白先生 and the 黑風寨 bandits (黑熊, 刀疤, 瘦猴) from the 龍門武林
  series, and 胡半仙, 賈八方, 武大膽, 文對仗, 楚天闊, 牛飽飽, 霍天下, 阿蠻 from Longmen Quest II: original art from the
  Character Gallery (ywchen0711/character-gallery), `nes` style (48x56 portraits, 16x24 sprites), packed by `tools/atlas.py`.
- **Boards, props and minigame scenes:** drawn in code (`js/boards.js`, `js/minigames.js`, `js/view.js`).

## Music and sound (original)
- **Soundtrack:** composed for this game (the score is `tools/score.py`): 江湖開鑼 · The Gong Opens the Jianghu;
  客棧大街 · Longmen Inn Street; 萬妖山上 · Up Myriad Beast Mountain; 畫舫遊江 · Painted Boats on the River;
  小試身手 · A Quick Test of Skill; 手忙腳亂 · All Thumbs; 放榜 · The Scores Go Up; 江湖第一 · Champion of the Jianghu.
  It is played by recorded instruments with the sampler and mixer of Longmen Quest II (`tools/orch.py` in
  ywchen0711/longmen-quest-2), driven by `tools/render_music.py`. The instrument samples are listed under Third-party.
- **Sound effects:** synthesised in the browser with Web Audio.

## Third-party
- **Instrument samples for the soundtrack.** All are [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)
  (public domain dedication); they are credited here with thanks. Changes made: notes cut, trimmed, retuned,
  level-matched, pitch-shifted and mixed into the rendered music.
  - **VS Chamber Orchestra: Community Edition (VSCO-2 CE)** by Versilian Studios (recorded by Sam Gossner and Simon
    Dalzell, sample cutting by Elan Hickler / Soundemote): string sections, harp, flute, bassoon, French horn,
    trumpet, glockenspiel, timpani and percussion. https://github.com/sgossner/VSCO-2-CE
  - **Erhu:** "Chinese Erhu" pack by tarane468 (freesound.org). https://freesound.org/people/tarane468/packs/26451/
  - **Dizi:** "Flute Dizi C all notes + pitched semitones" pack by Hypnotriod (freesound.org).
    https://freesound.org/people/Hypnotriod/packs/21613/
  - **Guzheng:** "LOVELY CHINESE GUZHENG PLUCKED.wav" by Pufermufin (freesound.org).
    https://freesound.org/people/Pufermufin/sounds/396868/
  - **Muyu:** "Mokugyo.wav" by jonopodmore. https://freesound.org/people/jonopodmore/sounds/607215/
  - **Temple blocks:** "Temple Blocks (5pcs) - Hard Wood Mallets" by sazanami12.
    https://freesound.org/people/sazanami12/sounds/863784/
  - **Opera cymbal:** "cymbal splash hit nearby chinese opera in park" by kyles. https://freesound.org/people/kyles/sounds/452400/
  - **Taiko:** "taiko.wav" and "taiko2.wav" by Anuj_Shrestha1.
    https://freesound.org/people/Anuj_Shrestha1/sounds/486140/ and https://freesound.org/people/Anuj_Shrestha1/sounds/486141/
- **Cubic 11 (俐方體11號)** by ACh-K and contributors, SIL Open Font License 1.1 (`fonts/Cubic_11-LICENSE.txt`). It
  includes glyphs from JF Dot M+H 12 and the M+ bitmap fonts.
- **PeerJS 1.5.4** (loaded from jsDelivr), © Michelle Bu, Eric Zhang and contributors, MIT License. The rooms use the
  free PeerJS cloud signalling server.
