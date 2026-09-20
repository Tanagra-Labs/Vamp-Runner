/* The platformer simulation used by both the browser and the Node tests. */
(function (root) {
  "use strict";
  const FLOOR = 625, GRAVITY = 1450, JUMP_SPEED = 600, PLAYER_SPEED = 220;
  const MAX_LIVES = 3, GARLIC_HITS_PER_LIFE = 3, STEP = 1 / 120;
  const DISTRICTS = ["THE OLD QUARTER", "CATHEDRAL ROW", "HOLLOW GARDENS"];
  const UPGRADES = [
    { key: "stride", name: "Velvet boots", detail: "+18 running speed per level", cost: 20 },
    { key: "stun", name: "Mesmer eyes", detail: "+1 second to bite a stunned human", cost: 16 },
    { key: "iv", name: "Deep veins", detail: "+2 seconds of IV protection", cost: 24 },
  ];
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const integer = (n, fallback = 0) => Number.isFinite(n) ? Math.max(0, Math.floor(n)) : fallback;
  function cleanProgress(value) {
    return { dirt: Math.min(999999, integer(value?.dirt)), upgrades: Object.fromEntries(UPGRADES.map(({ key }) => [key, clamp(integer(value?.upgrades?.[key]), 0, 3)])) };
  }
  function purchase(profile, key) {
    const item = UPGRADES.find((item) => item.key === key);
    if (!item || profile.upgrades[key] >= 3) return false;
    const cost = item.cost * (profile.upgrades[key] + 1);
    if (profile.dirt < cost) return false;
    profile.dirt -= cost;
    profile.upgrades[key]++;
    return true;
  }
  function nightSettings(night) {
    const n = Math.max(1, integer(night, 1));
    return { night: n, variant: (n - 1) % 3, duration: Math.max(50, 85 - (n - 1) * 5), speed: Math.min(1.65, 1 + (n - 1) * 0.06) };
  }
  function buildLevel(night = 1) {
    const settings = nightSettings(night), variant = settings.variant;
    const width = 3400 + variant * 180, platforms = [], pickups = [], hazards = [], humans = [];
    const gaps = [{ x: 870 + variant * 25, width: 88 + variant * 8 }, { x: 1830 + variant * 40, width: 96 + variant * 8 }, { x: 2800 + variant * 45, width: 102 + variant * 8 }];
    let edge = 0;
    for (const gap of gaps) {
      platforms.push({ x: edge, y: FLOOR, w: gap.x - edge, h: 120, ground: true });
      edge = gap.x + gap.width;
    }
    platforms.push({ x: edge, y: FLOOR, w: width - edge, h: 120, ground: true });
    const add = (kind, x, y, value = 1) => pickups.push({ id: pickups.length, kind, x, y, value, active: true });
    for (let section = 0; section < 3; section++) {
      const x = 320 + section * 970 + variant * section * 35;
      // Optional alley: two jumps to the rooftops, then back to the street.
      platforms.push({ x, y: 531, w: 140, h: 16 });
      platforms.push({ x: x + 145, y: 439, w: 185, h: 16 });
      platforms.push({ x: x + 350, y: 531, w: 105, h: 16 });
      add("dirt", x + 44, 509, 3);
      add("dirt", x + 90, 509, 3);
      add("dirt", x + 190, 417, 5);
      add("dirt", x + 238, 417, 5);
      add(section === 1 ? "syringe" : "iv", x + 291, 411);
      add("syringe", x + 401, 507);
      hazards.push({ kind: section === 1 || variant === 1 ? "cross" : "garlic", x: x + 330, y: FLOOR - 18, w: 27, h: 36 });
      const hx = x + 175;
      humans.push({ id: humans.length, x: hx, y: FLOOR - 38, w: 24, h: 38, home: hx, min: x + 40, max: x + 260, direction: section % 2 ? -1 : 1, behavior: ["wander", "flee", "brave"][(section + variant) % 3], state: "human", stunned: 0 });
    }
    [150, 200, 250].forEach((x) => add("dirt", x, FLOOR - 22));
    add("syringe", 780, FLOOR - 28);
    add("syringe", 1710 + variant * 25, FLOOR - 28);
    add("syringe", 2690 + variant * 30, FLOOR - 28);
    for (const gap of gaps) {
      [35, 75].forEach((offset) => add("dirt", gap.x - offset, FLOOR - 22));
      add("dirt", gap.x + gap.width / 2, FLOOR - 95, 3);
    }
    if (variant > 0) hazards.push({ kind: "garlic", x: 2100, y: FLOOR - 18, w: 27, h: 36 });
    return { ...settings, name: DISTRICTS[variant], width, platforms, pickups, hazards, humans, gaps, crypt: { x: width - 100, y: FLOOR }, checkpoints: [80, gaps[0].x + gaps[0].width + 70, gaps[1].x + gaps[1].width + 70, gaps[2].x + gaps[2].width + 70] };
  }
  function createWorld(data = {}) {
    const level = buildLevel(data.nightNumber), profile = cleanProgress(data.profile);
    return { level, profile, night: level.night, timeLeft: level.duration, score: integer(data.score), lives: clamp(integer(data.lives, MAX_LIVES), 1, MAX_LIVES), garlicHits: 0,
      player: { x: 80, y: FLOOR - 42, w: 24, h: 42, vx: 0, vy: 0, grounded: true, facing: 1 }, checkpoint: 80, status: "playing", reason: "", iv: 0, invulnerable: 0, coyote: 0.12, jumpBuffer: 0, stunCooldown: 0, elapsed: 0, stats: { blood: 0, turned: 0, dirt: 0 }, events: [] };
  }
  function overlap(a, b) { return Math.abs(a.x - b.x) < (a.w + b.w) / 2 && a.y < b.y + b.h && a.y + a.h > b.y; }
  function lose(world, reason) {
    if (world.status !== "playing") return;
    world.status = "dead"; world.reason = reason;
    world.player.vx = world.player.vy = 0;
    world.events.push({ kind: "dead", text: reason });
  }
  function hurt(world, kind) {
    if (world.status !== "playing" || world.invulnerable > 0 || (world.iv > 0 && kind !== "fall")) return false;
    if (kind === "garlic") world.garlicHits++;
    if (kind !== "garlic" || world.garlicHits >= GARLIC_HITS_PER_LIFE) { world.lives--; world.garlicHits = 0; }
    world.invulnerable = 1.4;
    world.events.push({ kind: "hurt", text: kind === "garlic" && world.garlicHits ? `Garlic ${world.garlicHits}/3` : "A coffin lost" });
    if (!world.lives) lose(world, "Your last coffin is gone. The sun rises.");
    return true;
  }
  function collect(world, pickup) {
    if (!pickup.active || world.status !== "playing") return false;
    pickup.active = false;
    let text;
    if (pickup.kind === "dirt") { world.profile.dirt += pickup.value; world.stats.dirt += pickup.value; world.score += 25 * pickup.value; text = `+${pickup.value} grave dirt`; }
    else if (pickup.kind === "syringe") { world.garlicHits = Math.max(0, world.garlicHits - 1); world.stats.blood++; world.score += 100; text = "Blood +100 · garlic healed"; }
    else { world.iv = 6 + 2 * world.profile.upgrades.iv; world.score += 150; text = "IV rush · protected + faster"; }
    world.events.push({ kind: pickup.kind, text, x: pickup.x, y: pickup.y });
    return true;
  }
  function targetHuman(world, range = 78, stunnedOnly = false) {
    return world.level.humans.filter((h) => h.state !== "vampire" && (!stunnedOnly || h.state === "stunned") && Math.abs(h.y - world.player.y) < 38 && Math.abs(h.x - world.player.x) < range).sort((a, b) => Math.abs(a.x - world.player.x) - Math.abs(b.x - world.player.x))[0];
  }
  function stun(world) {
    if (world.status !== "playing" || world.stunCooldown > 0) return false;
    const h = targetHuman(world);
    if (!h || h.state === "stunned") return false;
    h.state = "stunned"; h.stunned = 3.5 + world.profile.upgrades.stun; world.stunCooldown = 1;
    world.events.push({ kind: "stun", text: "Stunned! Get close and bite.", x: h.x, y: h.y });
    return true;
  }
  function bite(world) {
    if (world.status !== "playing") return false;
    const h = targetHuman(world, 52, true);
    if (!h) return false;
    h.state = "vampire"; h.stunned = 0; world.stats.turned++; world.score += 250;
    world.events.push({ kind: "bite", text: "+250 · a vampire is born", x: h.x, y: h.y });
    return true;
  }
  function finishNight(world) {
    if (world.status !== "playing") return false;
    const bonus = world.night * 500 + Math.ceil(world.timeLeft) * 10;
    world.score += bonus; world.bonus = bonus; world.status = "safe";
    world.player.vx = world.player.vy = 0;
    world.events.push({ kind: "safe", text: "The crypt is yours." });
    return true;
  }
  // A fixed timestep makes jump arcs and hit rules identical at 30/60/120 Hz.
  function step(world, input = {}, dt = STEP) {
    if (world.status !== "playing") return;
    dt = clamp(dt, 0, 1 / 30);
    const p = world.player;
    world.elapsed += dt; world.timeLeft = Math.max(0, world.timeLeft - dt);
    if (!world.timeLeft) { lose(world, "Sunrise caught you outside the crypt."); return; }
    for (const key of ["iv", "invulnerable", "jumpBuffer", "stunCooldown"]) world[key] = Math.max(0, world[key] - dt);
    world.coyote = p.grounded ? 0.12 : Math.max(0, world.coyote - dt);
    if (input.jump) world.jumpBuffer = 0.14;
    if (input.stun) stun(world);
    if (input.bite) bite(world);
    const direction = clamp(input.move || 0, -1, 1);
    const speed = (PLAYER_SPEED + world.profile.upgrades.stride * 18) * (world.iv > 0 ? 1.18 : 1);
    const desired = direction * speed, acceleration = (direction ? 1800 : 2200) * dt;
    p.vx += clamp(desired - p.vx, -acceleration, acceleration);
    if (direction) p.facing = Math.sign(direction);
    if (world.jumpBuffer > 0 && world.coyote > 0) {
      p.vy = -JUMP_SPEED; p.grounded = false; world.coyote = world.jumpBuffer = 0;
      world.events.push({ kind: "jump" });
    }
    const previousBottom = p.y + p.h;
    p.x = clamp(p.x + p.vx * dt, p.w / 2, world.level.width - p.w / 2);
    p.vy = Math.min(850, p.vy + GRAVITY * dt); p.y += p.vy * dt; p.grounded = false;
    if (p.vy >= 0) {
      let top = Infinity;
      for (const platform of world.level.platforms) {
        if (p.x + p.w / 2 > platform.x && p.x - p.w / 2 < platform.x + platform.w && previousBottom <= platform.y + 0.5 && p.y + p.h >= platform.y) top = Math.min(top, platform.y);
      }
      if (Number.isFinite(top)) { p.y = top - p.h; p.vy = 0; p.grounded = true; }
    }
    if (p.y > 712) {
      // Falling costs a coffin, including during an IV rush or hit recovery.
      world.invulnerable = 0; hurt(world, "fall");
      p.x = world.checkpoint; p.y = FLOOR - p.h; p.vx = p.vy = 0; p.grounded = true;
      world.coyote = world.jumpBuffer = 0;
    }
    if (world.status !== "playing") return;
    for (const checkpoint of world.level.checkpoints) {
      if (p.grounded && p.y + p.h === FLOOR && p.x >= checkpoint) world.checkpoint = Math.max(world.checkpoint, checkpoint);
    }
    for (const h of world.level.humans) {
      if (h.state === "stunned") { h.stunned = Math.max(0, h.stunned - dt); if (!h.stunned) h.state = "human"; continue; }
      if (h.state === "vampire") continue;
      let direction = h.direction;
      const nearby = Math.abs(p.x - h.x) < 115 && Math.abs(p.y - h.y) < 45;
      if (nearby && h.behavior === "flee") direction = Math.sign(h.x - p.x) || 1;
      if (nearby && h.behavior === "brave") direction = Math.sign(p.x - h.x);
      h.x = clamp(h.x + direction * (h.behavior === "flee" ? 58 : 30) * world.level.speed * dt, h.min, h.max);
      if (h.x === h.min) h.direction = 1;
      if (h.x === h.max) h.direction = -1;
    }
    for (const hazard of world.level.hazards) if (overlap(p, { ...hazard, y: hazard.y - hazard.h / 2 })) hurt(world, hazard.kind);
    if (world.status !== "playing") return;
    for (const pickup of world.level.pickups) if (pickup.active && overlap(p, { x: pickup.x, y: pickup.y - 13, w: 26, h: 26 })) collect(world, pickup);
    if (p.x >= world.level.crypt.x - 20 && p.y + p.h >= FLOOR - 50 && p.grounded) finishNight(world);
  }
  function cleanScores(value) {
    if (!Array.isArray(value)) return [];
    return value.filter((s) => s && typeof s.name === "string" && Number.isFinite(s.score) && s.score >= 0).map((s) => ({ name: s.name.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 7) || "ANON", score: Math.floor(s.score) })).sort((a, b) => b.score - a.score).slice(0, 10);
  }
  const api = { FLOOR, GRAVITY, JUMP_SPEED, PLAYER_SPEED, MAX_LIVES, GARLIC_HITS_PER_LIFE, STEP, DISTRICTS, UPGRADES, cleanProgress, purchase, nightSettings, buildLevel, createWorld, step, hurt, collect, targetHuman, stun, bite, finishNight, cleanScores };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.VampRules = api;
})(typeof window !== "undefined" ? window : this);
