const test = require("node:test");
const assert = require("node:assert/strict");
const R = require("../rules");
const { play } = require("./campaign-driver");
const { loadGame } = require("./scene-harness");

test("districts introduce distinct geometry with varied widths, heights and gaps", () => {
  const shapes = new Map();
  for (let night = 1; night <= 12; night++) {
    const level = R.buildLevel(night, 7);
    assert.equal(new Set(level.sections.map(s => s.type)).size, level.sections.length, "no repeated encounter in one night");
    assert.ok(new Set(level.sections.map(s => s.end - s.start)).size >= 4);
    const decks = level.platforms.filter(p => !p.ground);
    assert.ok(new Set(decks.map(p => p.w)).size >= 6, "landing widths must vary");
    assert.ok(new Set(decks.map(p => p.baseY)).size >= 6, "jump heights must vary");
    if (night > 6) continue;
    for (const section of level.sections) {
      const platforms = decks.filter(p => p.section === section.index).sort((a, b) => a.baseX - b.baseX);
      const left = platforms[0].baseX;
      const signature = JSON.stringify(platforms.map(p => [p.baseX - left, p.baseY, p.w, p.motion?.axis || null, !!p.crumble]));
      shapes.set(section.type, signature);
    }
  }
  assert.equal(shapes.size, 36);
  assert.equal(new Set(shapes.values()).size, 36, "districts must change actual jumps, not only names or colors");
});

test("reward routes leave empty ledges, vary cache sizes and keep mandatory keys on the main path", () => {
  for (let night = 1; night <= 12; night++) {
    const level = R.buildLevel(night, 7), dirt = level.pickups.filter(p => p.kind === "dirt");
    assert.ok(dirt.some(p => p.value === 1));
    assert.ok(dirt.some(p => p.value >= 6));
    assert.ok(level.platforms.some(p => !p.ground && !dirt.some(d => d.deckId === p.id)), "some ledges should be traversal only");
    assert.ok(dirt.reduce((sum, p) => sum + p.value, 0) >= level.contracts.find(c => c.key === "dirt").target);
    assert.equal(level.pickups.filter(p => p.kind === "iv").length, 2);
    assert.ok(level.pickups.filter(p => p.kind === "syringe").length < level.sections.length);
    for (const key of level.pickups.filter(p => p.kind === "key")) {
      const deck = level.platforms[key.deckId], section = level.sections[deck.section];
      assert.ok(section.route.includes(deck.id), "a bonus climb must not hide a mandatory key");
    }
    for (const section of level.sections) {
      assert.ok(level.platforms.some(p => p.ground && section.start + 80 >= p.x && section.start + 80 <= p.x + p.w));
    }
  }
});

test("all six cache climbs work in both directions with starting abilities and preserve later-night exits", () => {
  const covered = new Set();
  for (const night of [1, 2, 3, 5, 6, 7, 10, 11]) {
    const w = R.createWorld({ nightNumber: night, seed: 7 }), result = play(w, false, true);
    assert.equal(result.status, "safe", JSON.stringify({ night, ...result }));
    for (const section of w.level.sections.filter(s => s.detour.length > s.route.length)) {
      covered.add(`${section.type}:${section.mirrored}`);
      const caches = w.level.pickups.filter(p => p.kind === "dirt" && w.level.platforms[p.deckId].bonus && w.level.platforms[p.deckId].section === section.index);
      assert.ok(caches.length);
      assert.ok(caches.every(p => !p.active), `missed ${section.type} cache on night ${night}`);
    }
    if ([2, 5, 7, 10].includes(night)) {
      const direct = R.createWorld({ nightNumber: night, seed: 7 });
      assert.equal(play(direct).status, "safe");
      assert.ok(w.stats.dirt > direct.stats.dirt, "the extra climb must earn extra dirt");
    }
  }
  assert.equal(covered.size, 12, "each of the six cache routes needs forward and mirrored coverage");
});

test("vertical hoists carry passengers and preserve the individual offsets of their rewards", () => {
  const w = R.createWorld({ nightNumber: 4 });
  const lift = w.level.platforms.find(p => p.motion?.axis === "y" && w.level.pickups.filter(d => d.platform === p.id).length > 1);
  assert.ok(lift);
  const attached = w.level.pickups.filter(p => p.platform === lift.id);
  const offsets = attached.map(p => [p.x - lift.x, p.y - lift.y]);
  assert.ok(new Set(offsets.map(p => p[0])).size > 1, "key and cache must not collapse to the same point");
  const startY = lift.y;
  w.player.x = lift.x + 12; w.player.y = lift.y - w.player.h;
  w.player.grounded = true; w.player.groundId = lift.id;
  for (let i = 0; i < 120; i++) {
    R.step(w);
    assert.equal(w.player.groundId, lift.id);
    assert.ok(Math.abs(w.player.y + w.player.h - lift.y) < 0.01);
    attached.forEach((p, j) => {
      assert.ok(Math.abs(p.x - lift.x - offsets[j][0]) < 0.01);
      assert.ok(Math.abs(p.y - lift.y - offsets[j][1]) < 0.01);
    });
  }
  assert.ok(Math.abs(lift.y - startY) > 30);
});

test("section messages and scene hints follow authored boundaries rather than a fixed distance", () => {
  const h = loadGame(), scene = h.wire(new h.GameScene());
  scene.init({ nightNumber: 2, seed: 7 }); scene.create();
  const w = scene.world, first = w.level.sections[0];
  assert.ok(first.end > 1000);
  w.level.humans.forEach(p => { p.state = "vampire"; });
  w.player.x = first.end - 20;
  R.step(w); scene.renderWorld();
  assert.equal(w.lastSection, 0); assert.equal(scene.hint.text, first.hint);
  for (const section of w.level.sections.slice(1)) {
    assert.equal(R.sectionAt(w.level, section.start - 0.01).index, section.index - 1);
    assert.equal(R.sectionAt(w.level, section.start).index, section.index);
    w.player.x = section.start + 30;
    R.step(w); scene.renderWorld();
    assert.equal(w.lastSection, section.index);
    assert.equal(w.events.filter(e => e.kind === "section").at(-1).text, section.hint);
    assert.equal(scene.hint.text, section.hint);
  }
  assert.equal(R.sectionAt(w.level, w.level.crypt.x).index, w.level.sections.length - 1);
});
