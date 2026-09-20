const test = require("node:test");
const assert = require("node:assert/strict");
const R = require("../rules");

function tick(w, seconds, input = {}) {
  for (let i = 0; i < Math.round(seconds / R.STEP); i++) R.step(w, input);
}

for (const night of [1, 2, 3, 9, 25]) {
  test(`night ${night}: the real simulation reaches the crypt with three coffins`, () => {
    const w = R.createWorld({ nightNumber: night });
    for (let i = 0; i < 120 * 40 && w.status === "playing"; i++) {
      const p = w.player;
      const jump = p.grounded && (w.level.gaps.some((g) => g.x - p.x < 55 && g.x - p.x > -5) || w.level.hazards.some((h) => h.x - p.x < 62 && h.x - p.x > -5));
      R.step(w, { move: 1, jump });
    }
    assert.equal(w.status, "safe");
    assert.equal(w.lives, 3);
    assert.ok(w.timeLeft > 0);
    const score = w.score;
    R.finishNight(w); tick(w, 2);
    assert.equal(w.score, score, "survival reward must only be granted once");
  });
}

test("rooftop route can be climbed and gives extra dirt plus an IV power-up", () => {
  const w = R.createWorld(); let jumps = 0;
  for (let i = 0; i < 600; i++) {
    const p = w.player;
    const jump = p.grounded && ((jumps === 0 && p.x > 292) || (jumps === 1 && p.x > 390));
    if (jump) jumps++;
    R.step(w, { move: p.x < 620 ? 1 : 0, jump });
  }
  assert.equal(w.player.y + w.player.h, 439);
  assert.ok(w.profile.dirt >= 13);
  assert.ok(w.iv > 0);
  assert.equal(w.lives, 3);
});

test("three garlic hits remove one coffin; one cross removes one; last coffin ends the run", () => {
  const w = R.createWorld();
  R.hurt(w, "garlic"); R.hurt(w, "garlic");
  assert.equal(w.garlicHits, 1, "contact recovery prevents repeated frame damage");
  w.invulnerable = 0; R.hurt(w, "garlic");
  assert.equal(w.lives, 3); assert.equal(w.garlicHits, 2);
  w.invulnerable = 0; R.hurt(w, "garlic");
  assert.equal(w.lives, 2); assert.equal(w.garlicHits, 0);
  w.invulnerable = 0; R.hurt(w, "cross");
  assert.equal(w.lives, 1);
  w.invulnerable = 0; R.hurt(w, "cross");
  assert.equal(w.status, "dead"); assert.match(w.reason, /sun rises/);
  assert.equal(w.score, 0); assert.equal(R.hurt(w, "cross"), false);
});

test("syringes heal garlic damage once; IV protection expires and respects upgrades", () => {
  const w = R.createWorld({ profile: { upgrades: { iv: 2 } } });
  w.garlicHits = 2;
  const syringe = w.level.pickups.find((p) => p.kind === "syringe");
  R.collect(w, syringe); R.collect(w, syringe);
  assert.equal(w.garlicHits, 1); assert.equal(w.stats.blood, 1); assert.equal(w.score, 100);
  R.collect(w, w.level.pickups.find((p) => p.kind === "iv"));
  assert.equal(w.iv, 10); assert.equal(R.hurt(w, "cross"), false);
  tick(w, 10.1);
  assert.equal(R.hurt(w, "cross"), true); assert.equal(w.lives, 2);
});

test("stun then bite requires two actions at the correct distances and turns a human once", () => {
  const w = R.createWorld(), h = w.level.humans[0];
  w.player.x = h.x - 70;
  assert.equal(R.bite(w), false);
  assert.equal(R.stun(w), true); assert.equal(h.state, "stunned");
  assert.equal(R.bite(w), false, "must approach the stunned human");
  w.player.x = h.x - 30;
  assert.equal(R.bite(w), true); assert.equal(h.state, "vampire");
  assert.equal(R.bite(w), false); assert.equal(w.stats.turned, 1); assert.equal(w.score, 250);
});

test("stun expires, cannot reach across rooftops, and humans have distinct movement", () => {
  const w = R.createWorld(), h = w.level.humans[0];
  w.player.x = h.x; w.player.y = 430;
  assert.equal(R.stun(w), false);
  w.player.y = R.FLOOR - w.player.h;
  R.stun(w); tick(w, 3.6);
  assert.equal(h.state, "human");
  const fleeing = w.level.humans.find((h) => h.behavior === "flee");
  const x = fleeing.x; w.player.x = x - 80;
  R.step(w); assert.ok(fleeing.x > x);
});

test("a fall costs one coffin even during protection, then respawns on solid ground", () => {
  const w = R.createWorld(); w.iv = 6; w.invulnerable = 1;
  w.player.x = 905; w.player.y = 730; w.player.grounded = false;
  R.step(w);
  assert.equal(w.lives, 2); assert.equal(w.player.x, 80); assert.equal(w.player.y + w.player.h, R.FLOOR);
  tick(w, 1); assert.equal(w.lives, 2);
});

test("jump buffering and coyote time forgive near-edge inputs without midair double jumps", () => {
  const w = R.createWorld();
  R.step(w, { jump: true });
  assert.ok(w.player.vy < 0);
  tick(w, 0.2);
  const vy = w.player.vy; R.step(w, { jump: true });
  assert.ok(w.player.vy > vy, "jump cannot reset velocity in midair");
  const edge = R.createWorld(); edge.player.x = 886; edge.player.grounded = false; edge.coyote = 0.05;
  R.step(edge, { jump: true }); assert.ok(edge.player.vy < 0);
  const buffer = R.createWorld(); buffer.player.y = R.FLOOR - buffer.player.h - 3; buffer.player.grounded = false; buffer.player.vy = 180; buffer.coyote = 0;
  R.step(buffer, { jump: true }); tick(buffer, 0.04); assert.ok(buffer.player.vy < 0);
});

test("grave dirt and upgrades survive a new night without sharing mutable level objects", () => {
  const a = R.createWorld(); const pickup = a.level.pickups.find((p) => p.kind === "dirt");
  R.collect(a, pickup); R.collect(a, pickup);
  assert.equal(a.profile.dirt, pickup.value);
  a.profile.dirt = 100;
  assert.equal(R.purchase(a.profile, "stride"), true); assert.equal(a.profile.dirt, 80);
  const b = R.createWorld({ nightNumber: 2, lives: 2, score: 900, profile: a.profile });
  assert.equal(b.profile.dirt, 80); assert.equal(b.profile.upgrades.stride, 1);
  assert.equal(b.lives, 2); assert.equal(b.score, 900);
  assert.equal(b.garlicHits, 0); assert.equal(b.iv, 0); assert.equal(b.status, "playing");
  assert.ok(b.level.pickups.every((p) => p.active));
  b.profile.dirt--; assert.equal(a.profile.dirt, 80);
});

test("upgrade purchases enforce cost and cap, and corrupt stored data cannot grant invalid levels", () => {
  const p = R.cleanProgress({ dirt: -5, upgrades: { stride: 999, stun: "2", iv: null } });
  assert.deepEqual(p, { dirt: 0, upgrades: { stride: 3, stun: 0, iv: 0 } });
  assert.equal(R.purchase(p, "stride"), false); assert.equal(R.purchase(p, "stun"), false);
  assert.equal(R.purchase(p, "__proto__"), false);
  p.dirt = 16; assert.equal(R.purchase(p, "stun"), true); assert.equal(p.dirt, 0);
});

test("dawn ends a run once without a survival bonus", () => {
  const w = R.createWorld(); w.timeLeft = R.STEP / 2;
  R.step(w); assert.equal(w.status, "dead"); assert.equal(w.score, 0);
  assert.equal(R.finishNight(w), false); tick(w, 10); assert.equal(w.events.length, 1);
});

test("existing leaderboard entries remain valid and malformed scores are discarded", () => {
  assert.deepEqual(R.cleanScores([{ name: "val    ", score: 800.9 }, { name: "X", score: -1 }, null]), [{ name: "VAL", score: 800 }]);
});
