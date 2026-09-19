# Vamp Runner — Nightfall

A portrait, top-down vampire escape game from Tanagra Labs. Find the northern crypt before sunrise, collect blood, and charm civilians into helping you survive another night.

## Run locally

Requires Node.js 18 or newer. No install or build step:

```sh
npm start
```

Open `http://localhost:3000`. Phaser **3.60.0** loads from jsDelivr, so the first load needs internet access. All game artwork is drawn in code. The existing Railway start command and keep-alive behavior remain supported; `PORT` defaults to 3000.

## Controls

| Action | Keyboard | Touch / mouse |
| --- | --- | --- |
| Start / next night / replay | Enter | On-screen button |
| Move | Arrows, WASD, or ZQSD | Drag the joystick or an open play area |
| Shadow dash | Space or Shift | Dash button |
| Charm civilian | E | Charm button or tap a nearby civilian |
| Pause / resume | Escape or P | Pause / Resume button |

The game pauses when its tab becomes hidden or its window loses focus. Resume explicitly when you return. Sound is optional and off initially; reduced motion follows the device preference until changed in the menu.

## Rules

- Start with three coffins. A hunter's cross costs one; three garlic hits cost one. Brief protection after a hit prevents damage from stacking immediately.
- Shadow dash protects you from hazards for 0.19 seconds, with a 3.5-second recharge. It does **not** pass through walls.
- Blood is worth 300 points, removes one garlic hit, and reduces dash recharge by 1.2 seconds.
- Charm a blue civilian within 112 pixels and clear sight. Each ally earns 150 points, routes around walls to collect blood, and stuns nearby hunters.
- Sunlight advances from the **south**, behind your starting position. Reach the green crypt in the north before time runs out.
- Each night cycles to the next of three districts. Nights begin at 90 seconds and shorten to a minimum of 40; hunter speed is bounded.
- Surviving earns `night × 500 + remaining seconds × 15`, plus pickups and allies, minus 200 per lost coffin. A failed night earns only its pickup/ally score, less damage penalties. Scores cannot fall below zero.
- Every third completed night restores one coffin, up to three. At the crypt, choose the next night or end the run and save.

Personal high scores and settings stay on the device. Existing `vampRunnerScores` entries are retained. Score saving is optional; replay is always available, including when browser storage is unavailable.

## What changed in 1.1

- Gothic city artwork, title screen, clearer HUD, minimap and crypt direction, hunter alerts, dash trails, pickup feedback, and optional sound.
- Keyboard and two-finger touch controls, analog movement, shadow dash, automatic pause, and deliberate night transitions.
- Fair sunrise direction and scoring, reachable NPC spawns, pathfinding allies/hunters, bounded difficulty, and harmless stunned enemies.
- Defensive score loading and static asset serving that does not expose repository files.

## Validation

```sh
npm run check
npm test
```

25 tests cover district reachability, sunlight and scoring, movement, dash and damage, glamour sight/range, multi-touch release, pause/resume, night transitions, storage errors, and the real HTTP server. Scene tests use a lightweight Node adapter: they do **not** run Phaser's renderer or browser input/physics.

A browser playtest is still needed before release. Check the title, gameplay, pause, crypt transition, and score screens at phone and desktop sizes; move and dash with two fingers; switch tabs and resume; and confirm audio and reduced motion. The development environment used for this update blocked local browser previews, so visual and device behavior have not been verified.

## Files

- `game.js`: Phaser scenes, generated textures, controls, actors, feedback, and menus.
- `rules.js`: browser-independent maps, pathfinding, scoring, and validation helpers.
- `index.html` / `styles.css`: responsive game frame and desktop guide.
- `server.js`: dependency-free server and Railway health endpoint.
- `test/`: deterministic rules, scene orchestration, and HTTP regression tests.
