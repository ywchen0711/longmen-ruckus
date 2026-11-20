# 龍門鬧江湖 Longmen Ruckus

An original wuxia party board game for four, starring the Longmen Wulin cast. Play online with friends (each on
their own browser) or solo against bots. Open `index.html?v=1`; no build step.

## How it plays
- **Board:** four heroes take turns rolling a die and moving. Blue spaces pay 3 silver, red spaces take 3. "?" spaces
  are jianghu events, "店" is Jia Bafang's item stall, "寶" gives a free item, "鬥" is a dice duel against a player
  of your choice, and teal spaces are the board's gimmick.
- **Goal:** reach Mr Bai's storytelling stall (it moves after every sale) and pay 20 silver for a **Secret Manual
  (武林秘笈)**. Most manuals at the end wins; silver breaks ties. Three bonus awards at the end give one more manual each.
- **Every round ends with a minigame:** free-for-all, 2 vs 2 or 1 vs 3. Placings pay silver (10/5/3/1; team wins 10
  each; a 1 vs 3 solo win pays 15).
- **Last three turns:** blue and red spaces count double.
- **Settings:** 10/15/20 turns, board, bot skill (easy/normal/hard), 中文/English.

## Heroes (12, each with an intro line, a victory line and a small quirk)
奕叡 (starts with a Qinggong Talisman), 奕碩 (+1 on duel rolls), 冷笑天 (bandits take half), 柳寒煙 (red spaces cost 2),
苦禪 (blue spaces give 4), 屠千秋 (lifts 1 silver from anyone he walks past), 武大膽 (1-in-3 chance to hide in a jar
from bandits and bad events), 文對仗 (doubles on a two-dice roll give +5), 楚天闊 (duel wins pay 2 more), 牛飽飽 (the
coin-eating event pays him instead), 霍天下 (+1 whenever someone else buys a manual), 阿蠻 (carries 4 items).
Mr Bai, Jia Bafang, Hu Banxian and the Black Wind bandits appear as board characters.

## Boards
- **龍門客棧大街 Longmen Inn Street:** a loop round the inn and the teahouse, an alley shortcut, rickshaws to a random stand.
- **萬妖山 Myriad Beast Mountain:** a rope-bridge shortcut over the gorge that goes up or down every round; mountain gusts blow you forward.
- **江上畫舫 Painted Boats on the River:** ferries across the river, a painted-boat shortcut with whirlpools that drag you back.

## Items
輕功符 two dice · 點穴針 someone skips a turn · 迷魂香 swap places · 鐵布衫 blocks the next loss (passive) ·
金算盤 take 3-8 silver from someone · 醒木 Mr Bai moves his stall.

## Events
胡半仙's always-wrong fortunes, 賈八方's "heirlooms", a 黑風寨 ambush, 牛飽飽 eating your coins, 武大膽's runaway wine
jar, 文對仗's couplet test, 冷笑天's three cold laughs, 苦禪's alms, 白先生 moving his stall mid-story, 楚天闊's
challenge and 阿蠻's wolf pack.

## Minigames (15)
Free-for-all: 屋瓦雨 Roof-Tile Rain, 點穴節拍 Pressure-Point Rhythm, 輕功屋頂賽 Qinggong Rooftop Race, 包子大胃王 Bun-Eating
Contest, 接燈籠 Lantern Catch, 接劍！ Catch the Sword!, 竹竿平衡 Bamboo Balance, 擂台推手 Ring Push-Out, 暗器打靶
Hidden-Weapon Targets, 真假白先生 Find the Real Mr Bai, 疊茶杯 Tea-Cup Tower.
2 vs 2: 划龍舟 Dragon-Boat Dash, 泥坑拔河 Mud-Pit Tug of War. 1 vs 3: 醉拳棍掃 Drunken Staff Sweep, 屋頂惡作劇 Rooftop Prank.

## Controls
Keyboard: arrows / WASD and Space / Enter / Z. Gamepad: stick or d-pad and A. Touch: tap the buttons on the board;
in minigames the left half of the screen is a stick and the right half is the A button. Menus also work with arrows + Enter.

## Online
One player taps **Create room** and shares the 5-letter code or the invite link; up to three friends join from their
own browsers. Connections are WebRTC through PeerJS (the free PeerJS cloud server only introduces the browsers). The
host's browser is authoritative: it runs the board, dice, events, minigame simulation and payouts; the others send
their button presses and answers and draw what the host sends. Empty seats are bots, and a player who drops out is
replaced by a bot mid-game. Solo play needs no network.

## Files
- `js/main.js` menus, lobby, rooms · `js/host.js` the game rules (host only) · `js/view.js` drawing and UI ·
  `js/minigames.js` the 15 minigames and their bots · `js/boards.js` boards and backdrops · `js/data.js` heroes, items, text ·
  `js/net.js` PeerJS rooms · `js/input.js` keyboard/gamepad/touch · `js/audio.js` music and sfx.
- `assets/chars.png` the cast, packed from the Character Gallery by `tools/atlas.py`.
- `tools/score.py` the original score; `tools/render_music.py` renders it with recorded instruments (see CREDITS.md).
- Test hooks: `?fast=N` speeds the host up, `?auto=1` lets a bot play your seat, `?mg=all` (or `?mg=tiles,buns`) plays only minigames.
