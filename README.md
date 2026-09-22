# Vamp Runner

A mobile vampire platformer from Tanagra Labs. Survive a 12-night campaign across eight districts, find the keys to your crypt before sunrise, and take on harder Blood Moon runs. Fly as a bat, earn invitations, explore underground, and glamour humans before biting them into vampires.

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
| Glamour nearby human | Hold E (or J), facing them while stationary | Hold Glamour |
| Bite glamoured human | F (or K), within close range | Bite button |
| Fly upward as a bat | Hold Space, Up, W or Z; release to descend | Hold Flap; release to descend |
| Glamour a window resident | Hold E (or J) while they are calm | Hold Glamour |
| Choose an invitation response | 1, 2 or 3 | Named response |
| Pause / resume | Escape or P | Pause / Resume |

You can hold a direction with one finger and use the action buttons with another. Release movement before attempting glamour. The game automatically pauses when its tab is hidden or its window loses focus. Sound is optional and off initially; enable it in the menu or the ground-level pause screen. Reduced motion follows the device preference until changed in the menu.

## Your rules

- Start each run with **three coffins**. Three garlic hits cost one coffin; a cross costs one coffin immediately. Brief recovery prevents a single contact from causing damage every frame.
- Losing every coffin or running out of time triggers sunrise and ends the run. Falling costs one coffin and returns you to the most recent safe checkpoint. The clock keeps counting.
- Blood syringes earn 100 points and heal one garlic hit. IV blood gives six seconds of protection from garlic and crosses, plus an 18% speed boost. It does not save you from falling or sunrise.
- Hold glamour while grounded, nearly stationary and facing the target: **0.75 seconds** for civilians, **1 second** for hunters, **1.25 seconds** for priests. Range is 72 pixels for civilians and 64 for threats. Moving, jumping, releasing, looking away, leaving range or taking a hit interrupts focus. A priest's raised cross also interrupts it. Hunters can still finish a throw while you concentrate.
- Successful glamour grants **2 dirt once per human**. You then have **1.4 seconds** to approach within 30 pixels and bite; Mesmer Eyes adds 0.45 seconds per upgrade. Civilians give another **4 dirt and 250 points**; hunters and priests give **8 dirt and 400 points**. Every bite heals one garlic hit and permanently removes that human's attacks for the night.
- Every third conversion earns a **Shadow Veil** that absorbs one garlic or cross hit. One veil can be held at a time; it cannot prevent falling or sunrise, and resets between nights. The HUD shows conversions and progress to the next veil.
- Grave dirt is currency, with richer caches on optional rooftops. Map pickups earn 25 points per unit. Currency stays with you across nights and runs; glamour income does not count toward the map-dirt challenge.
- At the crypt, spend dirt on permanent running-speed, stun-duration or IV-duration upgrades. Each has three levels, costing 45, 40 or 55 dirt multiplied by the level being bought. Restore a missing coffin for **32 dirt**, up to three. Existing earned upgrades carry over.
- Collect every **blue crypt key** before finishing a night. The HUD points toward the nearest missing key; some require climbing or boarding a ferry. Later nights require three keys.
- Reaching the crypt earns `night × 500 + rounded-up remaining seconds × 10`. Surviving unlocks the next night with your score, coffins and upgrades intact.

High scores, settings, upgrades, grave dirt and challenge marks are saved on the current browser/device. Each crypt also saves the next night, score, coffins and route seed. Choose **Save & Quit**, then **Continue** in the menu to resume later. Saving is between nights, not mid-level. Death or **End Run & Save Score** ends that campaign checkpoint. Existing `vampRunnerScores` entries are retained. If browser storage is blocked, progress lasts for the current session; the crypt indicates the saving limitation.

## Version 1.5: flight, invitations and the dawn

Each district now has a procedural sound palette: low plucked phrases in the streets, airy roof tones, garden pulses, canal drops, market chimes, cathedral bells, deep catacomb echoes and hollow sewer tones. Jumps, dirt, blood, keys, glamour, bites, shields and damage have separate voices. Repeated pickups vary their pitch. Audio stops on pause and scene exit; there are no background audio timers.

The sunrise clock shows minutes and seconds, a moving sun marker and a gradually warming sky. Warnings sound at 60, 30 and 10 seconds, with a heartbeat during the final ten seconds. Slow frames still consume active time; pausing freezes it. Underground, light enters through ceiling cracks and the dawn curse still ends the run outside the sealed crypt.

Nights **9 and 10** descend into the catacombs and undercity sewers, with sixteen new encounters, burial hoists, crumbling bone bridges, pipe crossings, drain ferries, caches and warned garlic vents. Cross-bearing priests appear from night 3 and guard later areas. Their larger crosses visibly lower, rise and burn; glamour only works while the cross is lowered.

The bat stage currently connects **Next Night → flight → window invitation → ground map**. Hold Flap to rise and release to descend through rooftop gaps. A collision costs a coffin and retries near the obstacle. At the window, read the resident's concern, hold glamour through 1.1 seconds of calm, then choose a fitting promise within four seconds. Five residents have different concerns and shuffled responses. A wrong promise costs two seconds; three refusals cost a coffin. An invitation awards **5 dirt and 200 points**, once. Remaining time, coffins, currency and score carry into the ground map; the clock does not restart at the window.

**Progression placement is provisional:** bat stages currently run before nights 2 onward for testing. Their eventual placement at defined vampire-development milestones remains a design decision; the mechanics are ready for that later integration.

## Routes with their own shape

The campaign now draws from **52 authored encounters**, replacing the small pool of repeating stair patterns. Every night uses different encounter shapes without repeating one inside that night. Section lengths, landing widths, jump heights and gaps vary; hints and one-way gates follow the actual boundaries.

| District | Platforming character |
| --- | --- |
| Old Quarter | Broad courtyards, balcony climbs, sunken lanes and short well crossings |
| High Roofs | Narrow chimneys and spires, long terraces, descending roof valleys and hanging scaffolds |
| Hollow Gardens | Low roots, high boughs, collapsing gravestones and uneven rubble |
| Drowned Canals | Ferry transfers, vertical lock lifts, cargo hoists and spillway stones |
| Blood Market | Wide canopies, stacked stalls, warehouse jumps and back-alley caches |
| Cathedral Ward | Narrow pillars, high bell lifts, long nave platforms and reliquary climbs |
| Catacombs | Tomb niches, bone bridges, burial hoists and urn galleries |
| Undercity | Pipe climbs, sump ferries, pump pistons and pulsing garlic vents |

Each encounter has two authored dirt patterns: small trails, richer caches and intentionally empty ledges. Eight optional cache climbs offer extra dirt; their balconies leave the lower landing visible. Larger caches display their value. IVs appear in two selected encounters per night, and blood syringes appear in roughly half, with locations chosen for the route. Ferry and lift rewards stay attached at their individual positions.

The opening night teaches a stable route. Later nights remix section order and selected directions; the second half of the campaign combines districts and reverses most encounters, changing the approach to each landing. Timers account for the longer routes. Required keys remain on the main path, while high caches offer a reason to explore before committing through a gate.

## The twelve-night hunt

The campaign introduces different demands over twelve chapters: rooftop climbs, broken bridges, ledges that crumble after landing, moving canal ferries, garlic-throwing hunters, and timed cross hazards guarded by priests. Eight district palettes and scenery styles distinguish the streets, roofs, gardens, canals, market, cathedral, catacombs and sewers. Each chapter combines authored encounters; new hunts remix the middle sections while preserving the introductory route and each chapter's entry and exit.

Hunters show a wind-up before throwing. Crosses and priests' auras warn before becoming harmful. Crumbling ledges show a countdown and return after collapsing, allowing another attempt if a coffin remains. There are safe checkpoints between encounters.

From **night 7 onward**, crossing into a new section seals an iron gate behind you. The first six nights allow full backtracking. Later, you can still move left to line up jumps within the current section, but any blood, dirt or humans left in earlier sections are gone for that night. Gates are marked **NO RETURN** before crossing and **SEALED** afterward. An exit stays locked while a required key is still behind you, and falling always returns you to a checkpoint on the accessible side. The rule continues through Blood Moon cycles.

Every night offers three optional challenges: turn humans, collect grave dirt, and either lose no coffins or finish with at least 65% of the starting timer left. Completed challenges award extra dirt and points. Earn all **36 permanent marks** across repeated hunts. Pause to see the current goals; the crypt shows the results. These goals are optional; keys are required.

After night 12, **Blood Moon** cycles continue with remixed routes, shorter timers and faster humans. Additional hunters appear in the later campaign and throughout Blood Moon runs. Upgrades and spare coffins compete for the same dirt, while optional rooftops offer more resources at the cost of time.

Side-scrolling platforming, jumping, glamour-then-bite interactions, IV power-ups and grave-dirt upgrades remain the core of play.

**Next Night fix:** the old overlay fixed its parent container on screen while its interactive children retained world scroll factors. Phaser's input hit test then displaced the buttons after the camera moved. All screen controls now have their own zero scroll factor, and the crypt/shop has a separate scene and camera. Transition guards prevent double taps from skipping a night, and every gameplay entry resets temporary state.

The actual movement, moving platforms, enemy attacks, collisions, pickups, damage and progression run in the same fixed-step simulation in both the browser and automated tests. Phaser renders the game and handles input; it is not a second physics implementation.

## Validation

```sh
npm run check
npm test
```

63 tests cover all twelve ground chapters at three seeds with starting abilities; surface cache climbs in both directions and underground caches; a full campaign including bat flights and shared deadlines; five consecutive crypt/flight/invitation/map transitions; five resident concerns, wrong promises and invitation rewards; glamour interruption and anti-farming; conversion healing and veil rules; priest resistance and cross timing; underground vents; sunrise warnings and slow-frame deadlines; distinct sound voices, mute and cleanup; moving platforms; one-way gates; save/resume; input, upgrades, scores and the HTTP server.

Route tests supply movement and action inputs to the real simulation, without teleporting or granting immunity. Scene tests use a Node adapter and Phaser's scroll-coordinate formula; audio tests use a Web Audio adapter. These checks do not run the actual browser renderer, device input or speakers. Before release, play at phone and desktop sizes: hold glamour and approach to bite, face a priest, fly and earn an invitation, enter an underground district, and check Next Night, save/resume, two-finger controls, sound and reduced motion. The development browser blocks local previews, so visual/device behavior, listening quality and human difficulty tuning still need that playtest.

## Files

- `game.js`: Phaser scenes, procedural artwork, controls, feedback, crypt shop and menus.
- `levels.js`: twelve campaign chapters, encounter layouts, seeded variation and challenge goals.
- `rules.js`: the browser-independent platformer simulation, enemy behavior and progression.
- `bat.js`: flight, resident attention, invitation choices and the shared deadline.
- `audio.js`: district motifs, event voices and Web Audio lifecycle.
- `index.html` / `styles.css`: responsive game frame and desktop guide.
- `server.js`: dependency-free asset server and Railway health endpoint.
- `test/`: gameplay, scene/input and HTTP regression checks.
