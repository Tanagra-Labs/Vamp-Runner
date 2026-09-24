/* The gameplay simulation used by both the browser and Node tests. */
(function (root) {
  "use strict";
  const Levels = typeof module !== "undefined" && module.exports ? require("./levels") : root.VampLevels;
  const Hunt = typeof module !== "undefined" && module.exports ? require("./hunt") : root.VampHunt;
  const { FLOOR, CAMPAIGN, nightSettings, sectionAt, buildLevel } = Levels;
  const GRAVITY = 1450, JUMP_SPEED = 600, PLAYER_SPEED = 220;
  const MAX_LIVES = 3, GARLIC_HITS_PER_LIFE = 3, STEP = 1 / 120, COFFIN_COST = 32;
  const GATE_HALF_WIDTH = 12;
  const GLAMOUR_DIRT = 2, FEEDS_PER_VEIL = 3;
  const UPGRADES = [
    { key: "stride", name: "Velvet boots", detail: "+18 running speed per level", cost: 45 },
    { key: "stun", name: "Mesmer eyes", detail: "+0.45 seconds to reach and bite", cost: 40 },
    { key: "iv", name: "Deep veins", detail: "+2 seconds of IV protection", cost: 55 },
  ];
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const integer = (n, fallback = 0) => Number.isFinite(n) ? Math.max(0, Math.floor(n)) : fallback;
  function cleanProgress(value) {
    return {
      dirt: Math.min(999999, integer(value?.dirt)),
      upgrades: Object.fromEntries(UPGRADES.map(({ key }) => [key, clamp(integer(value?.upgrades?.[key]), 0, 3)])),
      medals: Array.from({ length: CAMPAIGN.length }, (_, i) => clamp(integer(value?.medals?.[i]), 0, 7)),
      bestNight: Math.min(9999, integer(value?.bestNight)),
    };
  }
  function cleanRun(value) {
    if (!value || value.version !== 1 || !Number.isInteger(value.nightNumber) || value.nightNumber < 2 || value.nightNumber > 10000 || !Number.isInteger(value.lives) || value.lives < 1 || value.lives > MAX_LIVES) return null;
    return { version: 1, nightNumber: value.nightNumber, lives: value.lives, score: integer(value.score), seed: integer(value.seed, 1) >>> 0 };
  }
  function purchase(profile, key) {
    const item = UPGRADES.find((item) => item.key === key);
    if (!item || profile.upgrades[key] >= 3) return false;
    const cost = item.cost * (profile.upgrades[key] + 1);
    if (profile.dirt < cost) return false;
    profile.dirt -= cost; profile.upgrades[key]++;
    return true;
  }
  function createWorld(data = {}) {
    const level = data.mode === "bellkeeper" ? Hunt.buildLevel(integer(data.seed, 1)) : buildLevel(data.nightNumber, integer(data.seed, 1));
    return {
      level, profile: cleanProgress(data.profile), night: level.night, seed: level.seed,
      timeLeft: Number.isFinite(data.timeLeft) ? clamp(data.timeLeft, 0, level.duration) : level.duration, score: integer(data.score), lives: clamp(integer(data.lives, MAX_LIVES), 1, MAX_LIVES), garlicHits: 0,
      player: { x: 80, y: FLOOR - 42, w: 24, h: 42, vx: 0, vy: 0, grounded: true, groundId: null, facing: 1 },
      checkpoint: 80, returnLimit: 0, status: "playing", reason: "", iv: 0, invulnerable: 0,
      coyote: 0.12, jumpBuffer: 0, stunCooldown: 0, elapsed: 0, keys: 0,
      stats: { blood: 0, turned: 0, dirt: 0, lost: 0, glamoured: 0, glamourDirt: 0 }, events: [], projectiles: [],
      veil: false, feeds: 0, focus: null,
      hunt: data.mode === "bellkeeper" ? Hunt.createState() : null,
      lastSection: -1, gateMessageAt: -10,
    };
  }
  function overlap(a, b) {
    return Math.abs(a.x - b.x) < (a.w + b.w) / 2 && a.y < b.y + b.h && a.y + a.h > b.y;
  }
  function lose(world, reason) {
    if (world.status !== "playing") return;
    world.status = "dead"; world.reason = reason;
    world.player.vx = world.player.vy = 0;
    world.events.push({ kind: "dead", text: reason });
  }
  function hurt(world, kind) {
    if (world.status !== "playing" || world.invulnerable > 0 || (world.iv > 0 && kind !== "fall")) return false;
    if (world.hunt?.dash > 0 && kind === "garlic") return false;
    interruptGlamour(world);
    if (world.hunt) world.hunt.sealFocus = 0;
    if (world.veil && kind !== "fall") {
      world.veil = false; world.invulnerable = 0.8;
      world.events.push({ kind: "veil-blocked", text: "Shadow veil absorbed the hit." });
      return false;
    }
    if (kind === "garlic") world.garlicHits++;
    if (kind !== "garlic" || world.garlicHits >= GARLIC_HITS_PER_LIFE) {
      world.lives--; world.stats.lost++; world.garlicHits = 0;
    }
    world.invulnerable = 1.4;
    world.events.push({ kind: "hurt", text: kind === "garlic" && world.garlicHits ? `Garlic ${world.garlicHits}/3` : "A coffin lost" });
    if (!world.lives) lose(world, "Your last coffin is gone. The sun rises.");
    return true;
  }
  function collect(world, pickup) {
    if (!pickup.active || world.status !== "playing") return false;
    if (world.hunt && pickup.kind === "key" && !world.hunt.sealReady) return false;
    pickup.active = false;
    let text;
    if (pickup.kind === "dirt") {
      world.profile.dirt += pickup.value; world.stats.dirt += pickup.value;
      world.score += 25 * pickup.value; text = `+${pickup.value} grave dirt`;
    } else if (pickup.kind === "syringe") {
      world.garlicHits = Math.max(0, world.garlicHits - 1);
      world.stats.blood++; world.score += 100; text = "Blood +100 · garlic healed";
    } else if (pickup.kind === "key") {
      world.keys++; world.score += 200;
      text = world.hunt ? "Seal taken. Get to the crypt." : world.keys === world.level.requiredKeys ? "All keys found. The crypt is open!" : `Crypt key ${world.keys}/${world.level.requiredKeys}`;
    } else {
      world.iv = 6 + 2 * world.profile.upgrades.iv; world.score += 150;
      text = "IV rush · protected + faster";
    }
    world.events.push({ kind: pickup.kind, text, x: pickup.x, y: pickup.y });
    if (world.hunt) Hunt.onCollect(world, pickup);
    return true;
  }
  function targetHuman(world, range = 78, stunnedOnly = false) {
    return world.level.humans.filter((h) => h.state !== "vampire" && (!stunnedOnly || h.state === "stunned") && Math.abs(h.y - world.player.y) < 38 && Math.abs(h.x - world.player.x) < range)
      .sort((a, b) => Math.abs(a.x - world.player.x) - Math.abs(b.x - world.player.x))[0];
  }
  function canGlamour(world, h) {
    const p = world.player;
    return !!h && h.state === "human" && p.grounded && Math.abs(p.vx) < 24 && Math.abs(h.y - p.y) < 18 && (h.x - p.x) * p.facing >= 0 && Math.abs(h.x - p.x) < (h.behavior === "priest" || h.behavior === "hunter" ? 64 : 72) && (h.behavior !== "priest" || pulseState(world.elapsed, 3.8, h.phase) === "safe");
  }
  function interruptGlamour(world) {
    if (!world.focus) return;
    world.focus = null; world.stunCooldown = Math.max(world.stunCooldown, 0.35);
    world.events.push({ kind: "focus-lost", text: "Glamour interrupted." });
  }
  function stun(world) {
    if (world.status !== "playing" || world.stunCooldown > 0 || world.focus) return false;
    const h = targetHuman(world);
    if (!canGlamour(world, h)) return false;
    world.focus = { id: h.id, elapsed: 0, duration: h.behavior === "priest" ? 1.25 : h.behavior === "hunter" ? 1 : 0.75 };
    world.events.push({ kind: "focus", text: "Keep holding Glamour until the bar fills." });
    return true;
  }
  function updateGlamour(world, input, dt) {
    if (!input.stun || input.move || input.jump) { interruptGlamour(world); return; }
    if (!world.focus) stun(world);
    if (!world.focus) return;
    const h = world.level.humans.find(h => h.id === world.focus.id);
    if (!canGlamour(world, h)) { interruptGlamour(world); return; }
    world.focus.elapsed += dt;
    if (world.focus.elapsed < world.focus.duration) return;
    world.focus = null;
    h.state = "stunned"; h.stunned = 1.4 + world.profile.upgrades.stun * 0.45;
    h.windup = 0; world.stunCooldown = 1.15;
    const reward = h.glamourRewarded ? 0 : GLAMOUR_DIRT;
    if (reward) {
      h.glamourRewarded = true; world.stats.glamoured++;
      world.profile.dirt += reward; world.stats.glamourDirt += reward;
    }
    world.events.push({ kind: "stun", text: `They're glamoured. Get close and press Bite (F).${reward ? `\n+${reward} grave dirt` : ""}`, x: h.x, y: h.y });
  }
  function bite(world) {
    if (world.status !== "playing") return false;
    const h = targetHuman(world, 30, true), p = world.player;
    if (!h || !p.grounded || Math.abs(p.y - h.y) >= 18 || (h.x - p.x) * p.facing < 0) return false;
    h.state = "vampire"; h.stunned = 0; world.stats.turned++;
    const points = ["hunter", "priest"].includes(h.behavior) ? 400 : 250;
    const reward = points === 400 ? 8 : 4, healed = world.garlicHits > 0;
    world.profile.dirt += reward; world.stats.glamourDirt += reward;
    world.garlicHits = Math.max(0, world.garlicHits - 1);
    world.feeds++;
    world.score += points;
    const bitesLeft = FEEDS_PER_VEIL - world.feeds;
    world.events.push({ kind: "bite", text: `+${points} pts · +${reward} dirt${healed ? " · 1 garlic wound healed" : ""}\n${bitesLeft ? `${bitesLeft} more ${bitesLeft === 1 ? "bite" : "bites"} for a protective veil` : "Protective veil earned."}`, x: h.x, y: h.y });
    if (world.feeds === FEEDS_PER_VEIL) {
      world.feeds = 0; world.veil = true;
      world.events.push({ kind: "veil", text: "SHADOW VEIL · next garlic or cross hit blocked" });
    }
    if (world.hunt) Hunt.onBite(world, h);
    return true;
  }
  function advanceClock(world, seconds) {
    if (world.status !== "playing" || !Number.isFinite(seconds) || seconds <= 0) return;
    const before = world.timeLeft;
    world.timeLeft = Math.max(0, before - seconds);
    for (const threshold of [60, 30, 10]) {
      if (before > threshold && world.timeLeft <= threshold && world.timeLeft > 0) {
        world.events.push({ kind: "dawn-warning", seconds: threshold, text: `${threshold} SECONDS TO SUNRISE\n${world.level.theme.underground ? "Only your sealed crypt protects you." : "Reach your crypt before the light."}` });
      }
    }
    if (!world.timeLeft) lose(world, world.level.theme.underground ? "The dawn curse reached the tunnels. Only your crypt is safe." : "Sunrise caught you outside the crypt.");
  }
  function dawnState(world) {
    const fraction = clamp(1 - world.timeLeft / world.level.duration, 0, 1);
    return { fraction, glow: clamp((fraction - 0.35) / 0.65, 0, 1), urgent: world.timeLeft <= 30, final: world.timeLeft <= 10 };
  }
  function contractResults(world) {
    return world.level.contracts.map((contract) => {
      const value = contract.key === "time" ? Math.floor(world.timeLeft) : contract.key === "untouched" ? world.stats.lost : world.stats[contract.key];
      return { ...contract, value, complete: contract.key === "untouched" ? value === 0 : value >= contract.target };
    });
  }
  function finishNight(world) {
    if (world.status !== "playing" || world.keys < world.level.requiredKeys) return false;
    const bonus = world.night * 500 + Math.ceil(world.timeLeft) * 10;
    world.contracts = contractResults(world);
    world.contractReward = 0;
    world.contracts.forEach((contract, i) => {
      if (contract.complete) {
        world.contractReward += contract.reward;
        if (!world.hunt) world.profile.medals[world.level.chapter] |= 1 << i;
        world.score += 250;
      }
    });
    world.profile.dirt += world.contractReward;
    if (!world.hunt) world.profile.bestNight = Math.max(world.profile.bestNight, world.night);
    world.score += bonus; world.bonus = bonus; world.status = "safe";
    world.player.vx = world.player.vy = 0;
    world.events.push({ kind: "safe", text: "The crypt is yours." });
    return true;
  }
  function pulseState(time, period, phase = 0) {
    const t = ((time + phase) % period) / period;
    return t < 0.5 ? "safe" : t < 0.74 ? "warning" : "active";
  }
  function gateState(world, gate) {
    if (world.returnLimit >= gate.x + GATE_HALF_WIDTH) return "sealed";
    return gate.keyIds.some((id) => world.level.pickups[id].active) ? "locked" : "open";
  }
  function updateGates(world) {
    const p = world.player;
    if (p.x < world.returnLimit + p.w / 2) {
      p.x = world.returnLimit + p.w / 2;
      p.vx = Math.max(0, p.vx);
    }
    for (const gate of world.level.gates) {
      const state = gateState(world, gate);
      if (state === "sealed") continue;
      if (state === "locked" && p.x + p.w / 2 > gate.x - GATE_HALF_WIDTH) {
        p.x = gate.x - GATE_HALF_WIDTH - p.w / 2;
        p.vx = Math.min(0, p.vx);
        if (world.elapsed - world.gateMessageAt > 3) {
          world.gateMessageAt = world.elapsed;
          world.events.push({ kind: "gate-locked", text: "A blue key is still behind you. Find it to open this gate." });
        }
        break;
      }
      // Close only once the whole player has crossed; allow local left/right movement.
      if (p.x - p.w / 2 >= gate.x + GATE_HALF_WIDTH) {
        world.returnLimit = gate.x + GATE_HALF_WIDTH;
        // This ground is safe even when crossing in midair, before touching the flag.
        world.checkpoint = gate.checkpoint;
        world.events.push({ kind: "gate-sealed", text: "Gate sealed. The route behind you is gone." });
      }
    }
  }
  function updatePlatforms(world, dt) {
    const player = world.player;
    for (const platform of world.level.platforms) {
      const oldX = platform.x, oldY = platform.y;
      if (platform.motion) {
        const m = platform.motion;
        const offset = Math.sin(world.elapsed * Math.PI * 2 / m.period + m.phase) * m.range;
        platform.x = platform.baseX + (m.axis === "x" ? offset : 0);
        platform.y = platform.baseY + (m.axis === "y" ? offset : 0);
      }
      if (platform.crumble) {
        if (!platform.active) {
          platform.respawn -= dt;
          if (platform.respawn <= 0) { platform.active = true; platform.crumbleTime = 0; }
        } else if (platform.crumbleTime > 0) {
          platform.crumbleTime += dt;
          if (platform.crumbleTime >= 0.9) {
            platform.active = false; platform.respawn = 2.7;
            if (player.groundId === platform.id) { player.grounded = false; player.groundId = null; }
          }
        }
      }
      if (player.grounded && player.groundId === platform.id && platform.active) {
        player.x += platform.x - oldX; player.y += platform.y - oldY;
      }
    }
    for (const pickup of world.level.pickups) {
      if (pickup.platform !== undefined) {
        const p = world.level.platforms[pickup.platform];
        pickup.x = p.x + (pickup.offsetX ?? p.w / 2); pickup.y = p.y + (pickup.offsetY ?? -27);
      }
    }
  }
  function updateHumans(world, dt) {
    const p = world.player;
    for (const h of world.level.humans) {
      if (h.state === "stunned") {
        h.stunned = Math.max(0, h.stunned - dt);
        if (!h.stunned) { h.state = "human"; h.cooldown = 1; }
        continue;
      }
      if (h.state === "vampire") continue;
      if (h.behavior === "hunter") {
        h.cooldown = Math.max(0, h.cooldown - dt * (world.hunt?.alarm ? 1.35 : 1));
        if (h.windup > 0) {
          h.windup = Math.max(0, h.windup - dt);
          if (!h.windup) {
            world.projectiles.push({ x: h.x, y: h.y + 10, w: 15, h: 15, vx: h.aim * (150 + Math.min(45, world.night * 3)), life: 2.8 });
            h.cooldown = Math.max(1.3, 2.7 - world.night * 0.035);
          }
          continue;
        }
        if (!h.cooldown && Math.abs(p.x - h.x) < 370 && Math.abs(p.y - h.y) < 95 && (!world.hunt || Hunt.sees(world, h))) {
          h.windup = 0.85; h.aim = Math.sign(p.x - h.x) || 1; h.direction = h.aim;
          continue;
        }
      }
      let direction = h.direction;
      const nearby = Math.abs(p.x - h.x) < 115 && Math.abs(p.y - h.y) < 45;
      if (nearby && h.behavior === "flee") direction = Math.sign(h.x - p.x) || 1;
      if (nearby && h.behavior === "brave") direction = Math.sign(p.x - h.x);
      if (world.focus?.id !== h.id) h.x = clamp(h.x + direction * (h.behavior === "flee" ? 58 : h.behavior === "priest" ? 42 : 30) * world.level.speed * dt, h.min, h.max);
      if (h.x === h.min) h.direction = 1;
      if (h.x === h.max) h.direction = -1;
      if (h.behavior === "priest" && pulseState(world.elapsed, 3.8, h.phase) === "active" && overlap(p, { x: h.x, y: h.y - 22, w: 94, h: 60 })) hurt(world, "cross");
    }
    for (const shot of world.projectiles) {
      shot.x += shot.vx * dt; shot.life -= dt;
      if (shot.life > 0 && overlap(p, shot)) { hurt(world, "garlic"); shot.life = 0; }
    }
    world.projectiles = world.projectiles.filter((shot) => shot.life > 0);
  }
  // Fixed simulation steps keep jumping and hazard timing identical across displays.
  function step(world, input = {}, dt = STEP) {
    if (world.status !== "playing") return;
    dt = clamp(dt, 0, 1 / 30);
    const p = world.player;
    world.elapsed += dt; advanceClock(world, dt);
    if (world.status !== "playing") return;
    for (const key of ["iv", "invulnerable", "jumpBuffer", "stunCooldown"]) world[key] = Math.max(0, world[key] - dt);
    if (world.hunt) Hunt.beginStep(world, input, dt);
    updatePlatforms(world, dt);
    world.coyote = p.grounded ? 0.12 : Math.max(0, world.coyote - dt);
    if (input.jump) world.jumpBuffer = 0.14;
    updateGlamour(world, world.hunt?.dash > 0 ? {} : input, dt);
    if (input.bite && !(world.hunt?.dash > 0)) bite(world);
    const direction = clamp(input.move || 0, -1, 1);
    const speed = (PLAYER_SPEED + world.profile.upgrades.stride * 18) * (world.iv > 0 ? 1.18 : 1);
    const desired = direction * speed, acceleration = (direction ? 1800 : 2200) * dt;
    p.vx += clamp(desired - p.vx, -acceleration, acceleration);
    if (direction) p.facing = Math.sign(direction);
    if (world.hunt?.dash > 0) p.vx = p.facing * Hunt.DASH_SPEED;
    if (world.jumpBuffer > 0 && world.coyote > 0) {
      p.vy = -JUMP_SPEED; p.grounded = false; p.groundId = null;
      world.coyote = world.jumpBuffer = 0; world.events.push({ kind: "jump" });
    }
    const previousBottom = p.y + p.h;
    p.x = clamp(p.x + p.vx * dt, p.w / 2, world.level.width - p.w / 2);
    updateGates(world);
    p.vy = Math.min(850, p.vy + GRAVITY * dt * (world.hunt?.dash > 0 ? 0.12 : 1)); p.y += p.vy * dt;
    p.grounded = false; p.groundId = null;
    if (p.vy >= 0) {
      let landing = null;
      for (const platform of world.level.platforms) {
        if (platform.active && p.x + p.w / 2 > platform.x && p.x - p.w / 2 < platform.x + platform.w && previousBottom <= platform.y + 0.5 && p.y + p.h >= platform.y && (!landing || platform.y < landing.y)) landing = platform;
      }
      if (landing) {
        p.y = landing.y - p.h; p.vy = 0; p.grounded = true; p.groundId = landing.id;
        if (landing.crumble && !landing.crumbleTime) landing.crumbleTime = dt;
      }
    }
    if (p.y > 712) {
      world.invulnerable = 0; hurt(world, "fall");
      p.x = world.checkpoint; p.y = FLOOR - p.h; p.vx = p.vy = 0;
      p.grounded = true; p.groundId = null; world.coyote = world.jumpBuffer = 0;
      if (world.hunt) {
        world.hunt.dash = 0;
        const spot = world.hunt.safeSpot;
        if (spot && world.level.platforms[spot.groundId].active) Object.assign(p, spot);
      }
    }
    if (world.status !== "playing") return;
    for (const checkpoint of world.level.checkpoints) {
      if (world.hunt?.phase === "escape") break;
      if (checkpoint >= world.returnLimit && p.grounded && p.y + p.h === FLOOR && p.x >= checkpoint) world.checkpoint = checkpoint;
    }
    updateHumans(world, dt);
    for (const hazard of world.level.hazards) {
      if ((!hazard.pulse || pulseState(world.elapsed, hazard.period, hazard.phase) === "active") && overlap(p, { ...hazard, y: hazard.y - hazard.h / 2 })) hurt(world, hazard.kind);
    }
    if (world.status !== "playing") return;
    for (const pickup of world.level.pickups) if (pickup.active && overlap(p, { x: pickup.x, y: pickup.y - 13, w: 26, h: 26 })) collect(world, pickup);
    if (world.hunt) Hunt.update(world, input, dt, hurt, lose);
    if (world.status !== "playing") return;
    const section = sectionAt(world.level, p.x).index;
    if (world.lastSection !== section) {
      if (world.lastSection >= 0) world.events.push({ kind: "section", text: world.level.sections[section].hint });
      world.lastSection = section;
    }
    if (p.x >= world.level.crypt.x - 20 && p.y + p.h >= FLOOR - 50 && p.grounded) {
      if (!finishNight(world) && world.elapsed - world.gateMessageAt > 3) {
        world.gateMessageAt = world.elapsed;
        world.events.push({ kind: "locked", text: world.hunt ? "You need the seal to enter.\nFollow the arrow back to the altar." : `Crypt locked. Find ${world.level.requiredKeys - world.keys} more key${world.level.requiredKeys - world.keys === 1 ? "" : "s"}. Follow the blue arrow.` });
      }
    }
  }
  function cleanScores(value) {
    if (!Array.isArray(value)) return [];
    return value.filter((s) => s && typeof s.name === "string" && Number.isFinite(s.score) && s.score >= 0)
      .map((s) => ({ name: s.name.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 7) || "ANON", score: Math.floor(s.score) }))
      .sort((a, b) => b.score - a.score).slice(0, 10);
  }
  const api = { FLOOR, GRAVITY, JUMP_SPEED, PLAYER_SPEED, MAX_LIVES, GARLIC_HITS_PER_LIFE, STEP, COFFIN_COST, GATE_HALF_WIDTH, GLAMOUR_DIRT, FEEDS_PER_VEIL, CAMPAIGN, UPGRADES, cleanProgress, cleanRun, purchase, nightSettings, sectionAt, buildLevel, createWorld, step, advanceClock, dawnState, hurt, collect, targetHuman, canGlamour, interruptGlamour, stun, glamour: stun, bite, finishNight, contractResults, pulseState, gateState, cleanScores };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.VampRules = api;
})(typeof window !== "undefined" ? window : this);
