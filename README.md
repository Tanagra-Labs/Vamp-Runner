# Vamp Runner

A mobile vampire platformer from Tanagra Labs. Run and jump through the city to your crypt before sunrise. Collect blood syringes and IV power-ups, save grave dirt for upgrades, and stun humans before biting them into vampires.

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
- Stun within 78 pixels, then approach within 52 pixels and bite before the stun expires. Each turned human becomes a vampire and earns **250 points**. Humans wander, flee or approach depending on their behavior.
- Grave dirt is currency, with richer caches on optional rooftops. It earns 25 points per unit and stays with you across nights and runs.
- At the crypt, spend dirt on permanent running-speed, stun-duration or IV-duration upgrades. Each has three levels. Restore a missing coffin for 18 dirt, up to three.
- Each night switches to the next of three districts. The sunrise timer starts at 85 seconds and shortens to a minimum of 50; human speed increases within a fixed limit.
- Reaching the crypt earns `night × 500 + rounded-up remaining seconds × 10`. Surviving unlocks the next night with your score, coffins and upgrades intact.

High scores, settings and progression are saved on the current browser/device. Existing `vampRunnerScores` entries are retained. If browser storage is blocked, play still works and upgrades remain available for the current session; the crypt indicates the saving limitation.

## Version 1.2: back to the platformer concept

The previous version was a top-down maze. This version restores side-scrolling platforming, jumping, rooftop detours, stun-then-bite interactions, IV power-ups and grave-dirt upgrades.

**Next Night fix:** the old overlay fixed its parent container on screen while its interactive children retained world scroll factors. Phaser's input hit test then displaced the buttons after the camera moved. All screen controls now have their own zero scroll factor, and the crypt/shop has a separate scene and camera. Transition guards prevent double taps from skipping a night, and every gameplay entry resets temporary state.

The actual movement, platform collisions, pickups, damage and progression run in the same fixed-step simulation in both the browser and automated tests. Phaser renders the game and handles input; it is not a second physics implementation.

## Validation

```sh
npm run check
npm test
```

26 tests cover complete playable routes through all three layouts and later nights; climbing to rooftop IV pickups; exact garlic/cross rules; stun and bite range/timing; falling, sunrise, jump buffering and coyote time; purchases and persistence; camera-offset button taps; two-finger input; pause cleanup; five consecutive night transitions using the same scene objects; scores; and the HTTP server.

Scene tests use a Node adapter and Phaser's scroll-coordinate formula. They do **not** run the actual browser renderer or device input. Before release, play at phone and desktop sizes: hold an arrow while jumping, stun then bite a human, collect rooftop blood and dirt, buy an upgrade, tap Next Night repeatedly, pause/resume, and check sound and reduced motion. The development browser blocks local previews, so live visual/device behavior still needs that playtest.

## Files

- `game.js`: Phaser scenes, procedural artwork, controls, feedback, crypt shop and menus.
- `rules.js`: the browser-independent platformer simulation, level layouts and progression.
- `index.html` / `styles.css`: responsive game frame and desktop guide.
- `server.js`: dependency-free asset server and Railway health endpoint.
- `test/`: gameplay, scene/input and HTTP regression checks.
