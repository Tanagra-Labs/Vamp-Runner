/* An authored hunt: approach, steal the seal, escape. Uses the main simulation. */
(function (root) {
  "use strict";
  const Levels = typeof module !== "undefined" && module.exports ? require("./levels") : root.VampLevels;
  const { FLOOR } = Levels;
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const MAX_BLOOD = 3, DASH_SECONDS = 0.22, DASH_SPEED = 850;

  function buildLevel(seed = 1) {
    const platforms = [], pickups = [], humans = [], sections = [];
    const deck = (x, y, w, extra = {}) => {
      const p = { id: platforms.length, x, y, baseX: x, baseY: y, w, h: 16, active: true, crumbleTime: 0, respawn: 0, skin: "beam", ...extra };
      platforms.push(p); return p.id;
    };
    const item = (kind, x, y, value = 1) => pickups.push({ id: pickups.length, kind, x, y, value, active: true });
    const area = (name, start, end, hint, decks) => {
      const route = decks.map(([x, y, w, extra]) => deck(x, y, w, extra));
      sections.push({ index: sections.length, type: "bellkeeper", name, start, end, hint, route, detour: route.slice(), mirrored: false });
      return route;
    };
    const ground = (x, w) => deck(x, FLOOR, w, { ground: true, h: 120 });
    ground(0, 2600); ground(4250, 400);
    area("THE WATCHED STREET", 0, 1600, "The shadows hide you when you stop.", [
      [220, 545, 160], [440, 450, 140], [650, 355, 250],
      [970, 425, 150], [1210, 520, 170],
    ]);
    area("THE BELLKEEPER", 1600, 2500, "Steal his seal. Or turn his people against him.", [
      [1770, 540, 140], [1990, 450, 150], [2290, 510, 180],
    ]);
    const escape = area("THE BURNING ROOFS", 2500, 4250, "The bell has woken the ward. Keep moving.", [
      [2520, 545, 160], [2770, 470, 150], [3010, 390, 160],
      [3260, 460, 120, { crumble: true }], [3470, 525, 150],
      [3710, 450, 160], [3960, 525, 170], [4230, 570, 150],
    ]);
    area("A DOOR IN THE DARK", 4250, 4650, "Almost home. Don't look back.", []);
    sections[1].exitGround = sections[2].exitGround = false;
    // High route spends blood on long crossings. The lower route needs no power.
    const highRoute = [deck(2520, 400, 150, { bonus: true }), deck(2820, 340, 140, { bonus: true }), deck(3180, 350, 130, { bonus: true }), deck(3520, 350, 150, { bonus: true })];
    const bridge = deck(2980, 355, 180, { bonus: true, shadowBridge: true, active: false });
    item("key", 2380, 480);
    for (const [x, y, value] of [[765, 329, 9], [1050, 398, 4], [2070, 423, 6], [2890, 314, 8], [3590, 324, 10]]) item("dirt", x, y, value);
    item("syringe", 1360, FLOOR - 28); item("syringe", 3100, 360); item("syringe", 4010, 496);
    const person = (x, behavior, name, role, radius = 24) => humans.push({ id: humans.length, x, y: FLOOR - 38, w: 24, h: 38, min: x - radius, max: x + radius, direction: -1, behavior, name, role, state: "human", stunned: 0, cooldown: 1.5, windup: 0, phase: 0, suspicion: 0 });
    person(285, "wander", "The lamplighter", "lamps");
    person(830, "hunter", "The watchman", "bridge");
    person(1220, "wander", "The bellringer", "bell");
    person(1690, "hunter", "The sexton", "bell");
    person(2230, "priest", "The Bellkeeper", "priest", 18);
    return {
      night: 1, chapter: 0, cycle: 0, variant: 0, oneWay: false, duration: 180, speed: 1,
      seed: seed >>> 0, name: "The Bellkeeper", themeKey: "cathedral", theme: Levels.THEMES.cathedral,
      width: 4650, platforms, pickups, humans, hazards: [], sections, gates: [],
      gaps: [{ x: 2600, width: 1650, water: false }], checkpoints: [80, 1520, 2470, 4300],
      requiredKeys: 1, crypt: { x: 4520, y: FLOOR }, bridge, highRoute, escape,
      shadows: [{ x: 65, w: 115 }, { x: 500, w: 125 }, { x: 1030, w: 115 }, { x: 1510, w: 115 }, { x: 1880, w: 100 }],
      lanterns: [720, 1440, 2110],
      contracts: [
        { key: "turned", target: 2, reward: 18, title: "Build a coven" },
        { key: "dirt", target: 25, reward: 18, title: "Raid the rooftops" },
        { key: "untouched", target: 0, reward: 24, title: "Lose no coffins" },
      ],
    };
  }
  function createState() {
    return { phase: "approach", blood: 2, dash: 0, cooldown: 0, hidden: false, heat: 0, alarm: false,
      lampsOut: false, bridgeOpen: false, bellCut: false, wardBroken: false, allies: 0,
      sealAt: null, sealFocus: 0, sealReady: false, safeSpot: null, pursuitX: 2170, beam: null, nextBeam: 0, nextBell: 0, deniedUntil: 0, flash: 0,
      told: new Set(), totalDashes: 0, witnesses: 0 };
  }
  function say(w, kind, text, extra = {}) { w.events.push({ kind, text, ...extra }); }
  function hidden(w) {
    const p = w.player;
    return p.grounded && Math.abs(p.vx) < 32 && w.hunt.dash <= 0 && w.level.shadows.some(s => p.x > s.x && p.x < s.x + s.w && p.y + p.h > FLOOR - 5);
  }
  function sees(w, h, x = w.player.x, y = w.player.y) {
    return h.state === "human" && Math.abs(x - h.x) < 230 && Math.abs(y - h.y) < 65 && (x - h.x) * h.direction > -20 && !w.hunt.hidden;
  }
  function lanternX(w, index) { return w.level.lanterns[index] + Math.sin(w.elapsed * 0.7 + index * 2) * 85; }
  function atSeal(w) {
    const p = w.player;
    return w.hunt.phase === "approach" && Math.abs(p.x - 2380) < 42 && Math.abs(p.y + p.h - 510) < 8 && p.grounded;
  }
  function beginStep(w, input, dt) {
    const h = w.hunt;
    const wasDashing = h.dash > 0;
    h.dash = Math.max(0, h.dash - dt); h.cooldown = Math.max(0, h.cooldown - dt); h.flash = Math.max(0, h.flash - dt);
    if (wasDashing && !h.dash) w.player.vx = w.player.facing * 220;
    h.hidden = hidden(w);
    if (input.dash && h.cooldown <= 0) {
      if (h.blood < 1) {
        if (w.elapsed > h.deniedUntil) { say(w, "empty-blood", "No blood left. Bite, or take the lower roofs."); h.deniedUntil = w.elapsed + 2; }
      } else {
        h.blood--; h.dash = DASH_SECONDS; h.cooldown = 0.7; h.hidden = false; h.totalDashes++;
        w.focus = null; w.player.facing = Math.sign(input.move) || w.player.facing;
        w.player.vy = Math.min(w.player.vy, -35);
        say(w, "swarm", "", { x: w.player.x, y: w.player.y + 20 });
      }
    }
  }
  function onBite(w, human) {
    const h = w.hunt;
    h.blood = Math.min(MAX_BLOOD, h.blood + 1);
    human.ally = { progress: 0, fromX: human.x, fromY: human.y, role: human.role };
    human.suspicion = 0;
    const witnesses = w.level.humans.filter(other => other.id !== human.id && sees(w, other, human.x, human.y));
    if (witnesses.length) { h.heat = Math.min(100, h.heat + 60); h.witnesses += witnesses.length; say(w, "witness", "Someone saw the bite."); }
    say(w, "coven-born", human.role === "priest" ? "His own blessing turns against him." : `${human.name} is yours.\n${human.role === "lamps" ? "“I'll put out the lights.”" : human.role === "bridge" ? "“I know a way across the roofs.”" : "“He won't hear the bell.”"}`);
  }
  function onCollect(w, pickup) {
    if (pickup.kind === "syringe") w.hunt.blood = Math.min(MAX_BLOOD, w.hunt.blood + 1);
    if (pickup.kind !== "key" || w.hunt.phase === "escape") return;
    const h = w.hunt;
    h.phase = "escape"; h.sealAt = w.elapsed; h.blood = MAX_BLOOD; h.flash = 1.4;
    h.beam = null; w.projectiles = []; w.checkpoint = 2470;
    say(w, "seal-stolen", h.bellCut ? "THE SEAL IS YOURS.\nYour coven bought you time. Run." : "THE SEAL IS YOURS.\nThe ward is burning. RUN.");
  }
  function update(w, input, dt, hurt, lose) {
    const h = w.hunt, p = w.player;
    h.hidden = hidden(w);
    if (!h.sealReady) {
      h.sealFocus = atSeal(w) && input.stun && !input.move && !input.jump && Math.abs(p.vx) < 24 && !h.dash ? h.sealFocus + dt : 0;
      if (h.sealFocus >= 1.5) h.sealReady = true;
    }
    if (h.phase === "escape" && p.grounded && p.x > 2530) {
      const platform = w.level.platforms[p.groundId];
      if (platform && !platform.crumble && p.x > platform.x + 18 && p.x < platform.x + platform.w - 18) h.safeSpot = { x: p.x, y: p.y, groundId: p.groundId };
    }
    for (const person of w.level.humans) {
      if (person.ally && person.ally.progress < 1) {
        const a = person.ally;
        a.progress = Math.min(1, a.progress + dt / 3.2);
        person.x = a.fromX + ((a.role === "bridge" ? 3060 : 2160) - a.fromX) * a.progress;
        person.y = a.fromY + (345 - a.fromY) * a.progress - Math.sin(a.progress * Math.PI) * 150;
        if (a.progress === 1) {
          h.allies++;
          if (a.role === "lamps") { h.lampsOut = true; say(w, "sabotage", "The lamps go dark.\nThe watch has lost your trail."); }
          if (a.role === "bridge") { h.bridgeOpen = true; w.level.platforms[w.level.bridge].active = true; say(w, "sabotage", "A bridge of shadow.\nYour watchman has opened the high route."); }
          if (a.role === "bell") { h.bellCut = true; say(w, "sabotage", "The bell rope snaps.\nThe ward will rise more slowly."); }
          if (a.role === "priest") { h.wardBroken = true; h.bellCut = true; h.beam = null; say(w, "sabotage", "THE BELLKEEPER KNEELS.\nHis cross can no longer find you."); }
        }
      }
      if (person.state !== "human") continue;
      const looking = sees(w, person) && !w.focus && h.phase !== "escape";
      person.suspicion = clamp(person.suspicion + (looking ? dt / 1.8 : -dt / 1.1), 0, 1);
      if (person.suspicion >= 1 && !person.reported) {
        person.reported = true; h.heat = Math.min(100, h.heat + 55); h.witnesses++;
        say(w, "witness", "“There! In the street!”\nBreak their sight. Find a shadow.");
      }
    }
    const lit = !h.lampsOut && h.phase === "approach" && p.y + p.h > FLOOR - 80 && !h.hidden && w.level.lanterns.some((_, i) => Math.abs(lanternX(w, i) - p.x) < 50);
    h.heat = clamp(h.heat + (lit ? 26 : h.hidden ? -24 : -2) * dt, 0, 100);
    if (h.heat >= 99 && !h.alarm) { h.alarm = true; say(w, "alarm", "THE WATCH IS HUNTING.\nThe bell carries your name."); }
    if (h.alarm && !h.bellCut && w.elapsed > h.nextBell) { h.nextBell = w.elapsed + 8; say(w, "bell", ""); }
    if (!h.wardBroken && h.phase === "approach" && p.x > 1900 && p.x < 2510) {
      if (!h.beam && w.elapsed >= h.nextBeam) {
        h.beam = { x: p.x + p.vx * 0.22, age: 0 };
        say(w, "consecrate", "The cross marks the ground. MOVE.");
      }
      if (h.beam) {
        h.beam.age += dt;
        if (h.beam.age > 1.2 && h.beam.age < 1.85 && Math.abs(p.x - h.beam.x) < 39) hurt(w, "cross");
        if (h.beam.age >= 1.85) { h.beam = null; h.nextBeam = w.elapsed + (h.bellCut ? 3.4 : h.alarm ? 1.4 : 2.3); }
      }
    } else h.beam = null;
    if (h.phase === "escape") {
      const grace = h.bellCut ? 7 : 4, speed = h.bellCut ? 90 : h.alarm ? 145 : 125;
      h.pursuitX = 2170 + Math.max(0, w.elapsed - h.sealAt - grace) * speed;
      if (p.x < h.pursuitX && p.y < 720) lose(w, "The Bellkeeper's ward caught you on the roofs.");
    }
    for (const [id, condition, text] of [
      ["first", p.x > 180, "Turn the lamplighter to darken the street.\nHold E to glamour. Move close; F to bite."],
      ["choice", p.x > 560, "The watch owns the street.\nThe rooftops belong to you."],
      ["blood", p.x > 1100, "Jump, then SWARM to cross farther.\nEach burst costs blood. A bite restores it."],
      ["priest", p.x > 1750, "Hold GLAMOUR beside the seal to break its ward.\nMove when the cross marks the ground."],
    ]) if (condition && !h.told.has(id)) { h.told.add(id); say(w, "hunt-hint", text); }
  }
  function objective(w) {
    const h = w.hunt;
    return h.phase === "escape" ? `ESCAPE → ${Math.max(0, Math.ceil((w.level.crypt.x - w.player.x) / 10))}m` : `STEAL THE SEAL ${w.player.x > 2380 ? "←" : "→"} ${Math.ceil(Math.abs(2380 - w.player.x) / 10)}m`;
  }
  function result(w) {
    const h = w.hunt;
    return h.wardBroken ? "THE USURPER" : h.allies >= 2 ? "COVEN MASTER" : !h.alarm && h.witnesses === 0 ? "A GHOST IN THE CITY" : "NIGHT SURVIVOR";
  }
  const api = { MAX_BLOOD, DASH_SECONDS, DASH_SPEED, buildLevel, createState, beginStep, update, onBite, onCollect, sees, hidden, lanternX, atSeal, objective, result };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.VampHunt = api;
})(typeof window !== "undefined" ? window : this);
