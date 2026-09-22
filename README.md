# Vamp Runner

A mobile vampire platformer from Tanagra Labs. Survive a 12-night campaign across six districts, find the keys to your crypt before sunrise, and take on harder Blood Moon runs. Collect blood syringes and IV power-ups, save grave dirt for upgrades, and stun humans before biting them into vampires.

## Play locally

Node.js 18 or newer; no install or build step:

```sh
npm start
```

Open `http://localhost:3000`. Phaser **3.60.0** loads from jsDelivr, requiring internet access. Artwork is generated in code. Railway's existing start command, health check and keep-alive remain supported. `PORT` defaults to 3000.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Start / next night / replay | Enter | Named button |
| Move left / right | Left / Right, A / D, or Q / D | Hold an arrow |
| Jump | Space, Up, W, or Z | Jump button |
| Stun nearby human | E (or J) | Stun button |
| Bite stunned human | F (or K) | Bite button |
| Pause / resume | Escape or P | Pause / Resume |

You can hold a direction with one finger and use the action buttons with another. The game automatically pauses when its tab is hidden or its window loses focus. Sound is optional and off initially. Reduced motion follows the device preference until changed in the menu.

## Your rules

- Start each run with **three coffins**. Three garlic hits cost one coffin; a cross costs one coffin immediately. Brief recovery prevents a single contact from causing damage every frame.
- Losing every coffin or running out of time triggers sunrise and ends the run. Falling costs one coffin and returns you to the most recent safe checkpoint. The clock keeps counting.
- Blood syringes earn 100 points and heal one garlic hit. IV blood gives six seconds of protection from garlic and crosses, plus an 18% speed boost. It does not save you from falling or sunrise.
- Stun within 78 pixels, then approach within 52 pixels and bite before the stun expires. Civilians earn **250 points**; hunters and priests earn **400**. Turning a hunter or priest also removes that threat.
- Grave dirt is currency, with richer caches on optional rooftops. It earns 25 points per unit and stays with you across nights and runs.
- At the crypt, spend dirt on permanent running-speed, stun-duration or IV-duration upgrades. Each has three levels, costing 45, 40 or 55 dirt multiplied by the level being bought. Restore a missing coffin for **32 dirt**, up to three. Existing earned upgrades carry over.
- Collect every **blue crypt key** before finishing a night. The HUD points toward the nearest missing key; some require climbing or boarding a ferry. Later nights require three keys.
- Reaching the crypt earns `night × 500 + rounded-up remaining seconds × 10`. Surviving unlocks the next night with your score, coffins and upgrades intact.

High scores, settings, upgrades, grave dirt and challenge marks are saved on the current browser/device. Each crypt also saves the next night, score, coffins and route seed. Choose **Save & Quit**, then **Continue** in the menu to resume later. Saving is between nights, not mid-level. Death or **End Run & Save Score** ends that campaign checkpoint. Existing `vampRunnerScores` entries are retained. If browser storage is blocked, progress lasts for the current session; the crypt indicates the saving limitation.

## Version 1.4: routes with their own shape

The campaign now draws from **36 authored encounters**, replacing the small pool of repeating stair patterns. Every night uses different encounter shapes without repeating one inside that night. Section lengths, landing widths, jump heights and gaps vary; hints and one-way gates follow the actual boundaries.

| District | Platforming character |
| --- | --- |
| Old Quarter | Broad courtyards, balcony climbs, sunken lanes and short well crossings |
| High Roofs | Narrow chimneys and spires, long terraces, descending roof valleys and hanging scaffolds |
| Hollow Gardens | Low roots, high boughs, collapsing gravestones and uneven rubble |
| Drowned Canals | Ferry transfers, vertical lock lifts, cargo hoists and spillway stones |
| Blood Market | Wide canopies, stacked stalls, warehouse jumps and back-alley caches |
| Cathedral Ward | Narrow pillars, high bell lifts, long nave platforms and reliquary climbs |

Each encounter has two authored dirt patterns: small trails, richer caches and intentionally empty ledges. Six optional cache climbs offer extra dirt; their balconies leave the lower landing visible. Larger caches display their value. IVs appear in two selected encounters per night, and blood syringes appear in roughly half, with locations chosen for the route. Ferry and lift rewards stay attached at their individual positions.

The opening night teaches a stable route. Later nights remix section order and selected directions; the second half of the campaign combines districts and reverses most encounters, changing the approach to each landing. Timers account for the longer routes. Required keys remain on the main path, while high caches offer a reason to explore before committing through a gate.

## The twelve-night hunt

The campaign introduces different demands over twelve chapters: rooftop climbs, broken bridges, ledges that crumble after landing, moving canal ferries, garlic-throwing hunters, and timed cross hazards guarded by priests. Six district palettes and scenery styles distinguish the streets, roofs, gardens, canals, market and cathedral. Each chapter combines authored encounters; new hunts remix the middle sections while preserving the introductory route and each chapter's entry and exit.

Hunters show a wind-up before throwing. Crosses and priests' auras warn before becoming harmful. Crumbling ledges show a countdown and return after collapsing, allowing another attempt if a coffin remains. There are safe checkpoints between encounters.

From **night 7 onward**, crossing into a new section seals an iron gate behind you. The first six nights allow full backtracking. Later, you can still move left to line up jumps within the current section, but any blood, dirt or humans left in earlier sections are gone for that night. Gates are marked **NO RETURN** before crossing and **SEALED** afterward. An exit stays locked while a required key is still behind you, and falling always returns you to a checkpoint on the accessible side. The rule continues through Blood Moon cycles.

Every night offers three optional challenges: turn humans, collect grave dirt, and either lose no coffins or finish with at least 65% of the starting timer left. Completed challenges award extra dirt and points. Earn all **36 permanent marks** across repeated hunts. Pause to see the current goals; the crypt shows the results. These goals are optional; keys are required.

After night 12, **Blood Moon** cycles continue with remixed routes, shorter timers and faster humans. Additional hunters appear in the later campaign and throughout Blood Moon runs. Upgrades and spare coffins compete for the same dirt, while optional rooftops offer more resources at the cost of time.

The side-scrolling platforming, jumping, stun-then-bite interactions, IV power-ups and grave-dirt upgrades from version 1.2 remain the core of play.

**Next Night fix:** the old overlay fixed its parent container on screen while its interactive children retained world scroll factors. Phaser's input hit test then displaced the buttons after the camera moved. All screen controls now have their own zero scroll factor, and the crypt/shop has a separate scene and camera. Transition guards prevent double taps from skipping a night, and every gameplay entry resets temporary state.

The actual movement, moving platforms, enemy attacks, collisions, pickups, damage and progression run in the same fixed-step simulation in both the browser and automated tests. Phaser renders the game and handles input; it is not a second physics implementation.

## Validation

```sh
npm run check
npm test
```

51 tests cover all twelve chapters at three route seeds with the starting abilities; all six optional cache climbs in both directions; distinct geometry and reward placement; vertical hoist passengers and separate reward offsets; hints at variable section boundaries; a full campaign preserving score, currency and coffins; a Blood Moon run; one-way gates, missed-key protection and safe fall recovery; locked crypts and key collection; ferry passengers and attached keys; crumbling ledges; hunter wind-up, damage and interruption; cross and priest timing; save/quit/resume across fresh runtimes; old-save migration; exact garlic/cross rules; stun and bite range/timing; falling, sunrise, jump buffering and coyote time; purchases; camera-offset button taps; two-finger input; pause cleanup; five consecutive night transitions using the same scene objects; scores; and the HTTP server.

Route tests supply movement and action inputs to the real simulation, without teleporting or granting immunity. Scene tests use a Node adapter and Phaser's scroll-coordinate formula. Neither runs the actual browser renderer or device input, and the scripted player's timing is more precise than a person's. Before release, play at phone and desktop sizes: climb for a key, ride a ferry, cross a crumbling ledge, interrupt a hunter, buy an upgrade, tap Next Night, save/quit/resume, and check two-finger input, sound and reduced motion. The development browser blocks local previews, so live visual/device behavior and human difficulty tuning still need that playtest.

## Files

- `game.js`: Phaser scenes, procedural artwork, controls, feedback, crypt shop and menus.
- `levels.js`: twelve campaign chapters, encounter layouts, seeded variation and challenge goals.
- `rules.js`: the browser-independent platformer simulation, enemy behavior and progression.
- `index.html` / `styles.css`: responsive game frame and desktop guide.
- `server.js`: dependency-free asset server and Railway health endpoint.
- `test/`: gameplay, scene/input and HTTP regression checks.
