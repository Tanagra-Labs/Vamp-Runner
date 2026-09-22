/* Authored campaign chapters, assembled from distinct platforming encounters. */
(function (root) {
  "use strict";
  const FLOOR = 625, SECTION_WIDTH = 1000;
  const THEMES = {
    quarter: { name: "Old Quarter", sky: 0x41303e, stone: 0x293742, trim: 0x8b9e98, motif: "city" },
    roofs: { name: "The High Roofs", sky: 0x303657, stone: 0x2c2d44, trim: 0xb1a0bb, motif: "spires" },
    gardens: { name: "Hollow Gardens", sky: 0x233e3a, stone: 0x293b36, trim: 0x9aad7c, motif: "trees" },
    canals: { name: "Drowned Canals", sky: 0x203b4f, stone: 0x243d49, trim: 0x8bb9c3, motif: "water" },
    market: { name: "Blood Market", sky: 0x50333c, stone: 0x41313a, trim: 0xd5a680, motif: "awnings" },
    cathedral: { name: "Cathedral Ward", sky: 0x443450, stone: 0x323344, trim: 0xc4b18b, motif: "spires" },
  };
  const CAMPAIGN = [
    { name: "First Blood", theme: "quarter", seconds: 100, keys: 1, sections: ["lane", "steps", "lane", "bridge", "market", "lane"] },
    { name: "Above the Streets", theme: "roofs", seconds: 118, keys: 2, sections: ["steps", "roofs", "market", "steps", "roofs", "bridge", "lane"] },
    { name: "Roots & Ruin", theme: "gardens", seconds: 120, keys: 2, sections: ["steps", "ruins", "lane", "ruins", "market", "bridge", "steps"] },
    { name: "Still Water", theme: "canals", seconds: 130, keys: 2, sections: ["lane", "canal", "steps", "canal", "bridge", "market", "lane"] },
    { name: "The Price of Blood", theme: "market", seconds: 122, keys: 2, sections: ["market", "steps", "market", "bridge", "roofs", "market", "steps", "lane"] },
    { name: "The Bells Toll", theme: "cathedral", seconds: 132, keys: 2, sections: ["steps", "chapel", "roofs", "chapel", "bridge", "market", "steps", "chapel"] },
    { name: "Graveyard Shift", theme: "quarter", seconds: 132, keys: 3, sections: ["ruins", "market", "steps", "bridge", "chapel", "roofs", "ruins", "lane"] },
    { name: "Gutter Crown", theme: "roofs", seconds: 135, keys: 3, sections: ["roofs", "steps", "roofs", "canal", "chapel", "bridge", "roofs", "market"] },
    { name: "The Forgotten", theme: "gardens", seconds: 140, keys: 3, sections: ["ruins", "steps", "ruins", "chapel", "market", "roofs", "ruins", "bridge", "lane"] },
    { name: "Undertow", theme: "canals", seconds: 150, keys: 3, sections: ["canal", "bridge", "market", "canal", "steps", "ruins", "canal", "chapel", "lane"] },
    { name: "The Procession", theme: "cathedral", seconds: 145, keys: 3, sections: ["chapel", "market", "roofs", "chapel", "canal", "ruins", "steps", "chapel", "bridge"] },
    { name: "The Longest Night", theme: "cathedral", seconds: 158, keys: 3, sections: ["steps", "chapel", "canal", "ruins", "market", "roofs", "chapel", "bridge", "steps", "chapel"] },
  ];
  const HINTS = {
    lane: "Choose the street or the rooftops.",
    steps: "Climb the stairs. Keys glow blue.",
    roofs: "Stay high. The street falls away.",
    ruins: "Cracked ledges collapse. Keep moving.",
    canal: "Ride the ferry. Jump to the far bank.",
    market: "Hunters throw garlic. Jump or stun them.",
    chapel: "Crosses flash before they strike. Wait, then go.",
    bridge: "Short landings. Time each jump.",
  };
  function random(seed) {
    let state = (seed >>> 0) || 1;
    return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  }
  function nightSettings(night = 1) {
    const n = Number.isFinite(night) ? Math.max(1, Math.floor(night)) : 1;
    const chapter = (n - 1) % CAMPAIGN.length, cycle = Math.floor((n - 1) / CAMPAIGN.length), spec = CAMPAIGN[chapter];
    return { night: n, chapter, cycle, variant: chapter, duration: spec.seconds - Math.min(28, cycle * 7), speed: Math.min(1.55, 1 + chapter * 0.03 + cycle * 0.07) };
  }
  function buildLevel(night = 1, seed = 1) {
    const settings = nightSettings(night), spec = CAMPAIGN[settings.chapter];
    const rng = random((seed >>> 0) + settings.night * 7919);
    const types = spec.sections.slice();
    // Keep the introductory approach and final encounter. Remix the middle.
    if (settings.night > 1) for (let i = types.length - 2; i > 1; i--) {
      const j = 1 + Math.floor(rng() * i); [types[i], types[j]] = [types[j], types[i]];
    }
    const platforms = [], gaps = [], pickups = [], hazards = [], humans = [], sections = [], checkpoints = [80];
    const keySections = settings.chapter === 0 ? [1] : Array.from({ length: spec.keys }, (_, i) => Math.floor((i + 1) * types.length / (spec.keys + 1)));
    const platform = (x, y, w, extra = {}) => {
      const p = { id: platforms.length, x, y, baseX: x, baseY: y, w, h: 16, active: true, crumbleTime: 0, respawn: 0, ...extra };
      platforms.push(p); return p;
    };
    const pickup = (kind, x, y, value = 1, extra = {}) => {
      const p = { id: pickups.length, kind, x, y, value, active: true, ...extra }; pickups.push(p); return p;
    };
    const person = (x, behavior = "wander", y = FLOOR, min = x - 75, max = x + 75) => {
      humans.push({ id: humans.length, x, y: y - 38, w: 24, h: 38, min, max, direction: rng() > 0.5 ? 1 : -1, behavior, state: "human", stunned: 0, cooldown: 1.4 + rng(), windup: 0, phase: rng() * 3.8 });
    };
    const hazard = (kind, x, extra = {}) => hazards.push({ kind, x, y: FLOOR - 18, w: 26, h: 36, ...extra });
    types.forEach((type, index) => {
      const start = index * SECTION_WIDTH, end = start + SECTION_WIDTH;
      const section = { type, start, end, name: type.toUpperCase(), hint: HINTS[type], index };
      sections.push(section); checkpoints.push(start + 80);
      let keyAnchor;
      const roof = (x, y, w, extra) => platform(start + x, y, w, extra);
      const gap = (x, width) => gaps.push({ x: start + x, width, water: type === "canal" });
      if (type === "lane" || type === "market" || type === "chapel") {
        roof(250, 535, 155); roof(420, 445, 190); roof(670, 535, 150);
        keyAnchor = { x: start + 540, y: 418 };
        if (type === "lane") hazard("garlic", start + 725);
        if (type === "market") {
          person(start + 545, "hunter", FLOOR, start + 475, start + 620);
          hazard("garlic", start + 850);
        }
        if (type === "chapel") {
          hazard("cross", start + 340, { pulse: true, period: 3.8, phase: rng() * 3.8, y: FLOOR - 57, h: 114, w: 34 });
          hazard("cross", start + 795, { pulse: true, period: 4.4, phase: rng() * 4.4, y: FLOOR - 57, h: 114, w: 34 });
          person(start + 650, "priest", FLOOR, start + 620, start + 720);
        }
      } else if (type === "steps") {
        roof(220, 535, 160); roof(390, 445, 160); roof(570, 355, 175); roof(785, 445, 145);
        keyAnchor = { x: start + 665, y: 328 };
        hazard("garlic", start + 850);
      } else if (type === "roofs") {
        gap(340, 410);
        roof(215, 535, 160); roof(400, 445, 155); roof(600, 445, 155); roof(785, 535, 145);
        keyAnchor = { x: start + 670, y: 418 };
      } else if (type === "canal") {
        gap(310, 355);
        const ferry = roof(440, 585, 90, { motion: { axis: "x", range: 120, period: 5.5, phase: -Math.PI / 2 } });
        keyAnchor = { x: ferry.x + 45, y: 558, platform: ferry.id };
        roof(735, 535, 145);
        pickup("iv", start + 800, 509);
      } else if (type === "ruins") {
        gap(325, 360);
        roof(280, 575, 96, { crumble: true }); roof(430, 525, 100, { crumble: true }); roof(585, 575, 100, { crumble: true });
        keyAnchor = { x: start + 480, y: 498 };
        roof(760, 535, 130);
      } else if (type === "bridge") {
        gap(245, 90); gap(475, 100); gap(710, 110);
        roof(375, 533, 95); roof(605, 533, 100);
        keyAnchor = { x: start + 655, y: 506 };
      }
      if (keySections.includes(index)) {
        const key = pickup("key", keyAnchor.x, keyAnchor.y, 1, keyAnchor.platform === undefined ? {} : { platform: keyAnchor.platform });
        section.keyId = key.id;
      }
      for (const p of platforms.filter((p) => p.x >= start && p.x < end && !p.motion)) {
        pickup("dirt", p.x + p.w * 0.3, p.y - 23, 2);
        pickup("dirt", p.x + p.w * 0.7, p.y - 23, 2);
      }
      [140, 180].forEach((x) => pickup("dirt", start + x, FLOOR - 22));
      pickup("syringe", start + 945, FLOOR - 25);
      if (index % 3 === 1 && type !== "canal") pickup("iv", keyAnchor.x - 45, keyAnchor.y);
      if (settings.chapter === 0 && index === 0) pickup("iv", start + 530, 418);
      if (!['canal', 'roofs', 'ruins'].includes(type)) person(start + 165, ["wander", "flee", "brave"][index % 3], FLOOR, start + 105, start + 210);
      if ((settings.chapter >= 6 || settings.cycle) && index % 3 === 2 && type !== "chapel") person(start + 900, "hunter", FLOOR, start + 860, start + 930);
    });
    const width = types.length * SECTION_WIDTH + 450;
    // Carve real ground gaps; all encounter boundaries and checkpoints are solid.
    gaps.sort((a, b) => a.x - b.x);
    let edge = 0;
    for (const g of gaps) { platform(edge, FLOOR, g.x - edge, { ground: true, h: 120 }); edge = g.x + g.width; }
    platform(edge, FLOOR, width - edge, { ground: true, h: 120 });
    const contracts = [
      { key: "turned", target: Math.min(5, 2 + Math.floor(settings.chapter / 4)), reward: 14, title: "Turn humans" },
      { key: "dirt", target: 32 + Math.floor(settings.chapter / 3) * 8, reward: 14, title: "Collect grave dirt" },
      settings.chapter % 2 ? { key: "time", target: Math.round(settings.duration * 0.65), reward: 18, title: "Seconds to spare" } : { key: "untouched", target: 0, reward: 18, title: "Lose no coffins" },
    ];
    return { ...settings, seed: seed >>> 0, name: spec.name, theme: THEMES[spec.theme], width, platforms, gaps, pickups, hazards, humans, sections, checkpoints, contracts, requiredKeys: spec.keys, crypt: { x: width - 110, y: FLOOR } };
  }
  const api = { FLOOR, SECTION_WIDTH, CAMPAIGN, THEMES, HINTS, nightSettings, buildLevel };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.VampLevels = api;
})(typeof window !== "undefined" ? window : this);
