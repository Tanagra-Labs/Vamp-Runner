const test = require("node:test");
const assert = require("node:assert/strict");
const R = require("../rules");
const { loadGame } = require("./scene-harness");
const tick = (w, seconds, input = {}) => { for (let i = 0; i < Math.ceil(seconds / R.STEP); i++) R.step(w, input); };

test("early nights allow backtracking, while night seven and Blood Moon introduce gates", () => {
  for (let n = 1; n < 7; n++) assert.equal(R.buildLevel(n).gates.length, 0);
  for (const n of [7, 12, 13, 25]) assert.ok(R.buildLevel(n).gates.length > 0);
  const w = R.createWorld({ nightNumber: 6 });
  w.player.x = 980;
  tick(w, 0.5, { move: 1 }); assert.ok(w.player.x > 1000);
  tick(w, 1, { move: -1 }); assert.ok(w.player.x < 980);
  assert.equal(w.returnLimit, 0);
});

test("gates seal after the entire player crosses, allow local retreat and keep fall recovery ahead", () => {
  const w = R.createWorld({ nightNumber: 7 }), gate = w.level.gates[0], p = w.player;
  p.x = gate.x + R.GATE_HALF_WIDTH;
  R.step(w); assert.equal(R.gateState(w, gate), "open", "do not close on the player's body");
  tick(w, 0.16, { move: 1 });
  assert.equal(R.gateState(w, gate), "sealed");
  assert.ok(p.x < gate.checkpoint, "the gate closes before reaching the next flag");
  assert.equal(w.checkpoint, gate.checkpoint);
  p.y = 730; R.step(w);
  assert.equal(w.lives, 2); assert.equal(p.x, gate.checkpoint);
  assert.ok(p.x > w.returnLimit);
  tick(w, 0.3, { move: 1 }); const advanced = p.x;
  tick(w, 0.3, { move: -1 }); assert.ok(p.x < advanced, "small adjustments remain possible");
  R.step(w, { jump: true, move: -1 }); tick(w, 0.9, { move: -1 });
  assert.equal(p.x, w.returnLimit + p.w / 2, "jumping cannot cross a sealed gate");
  assert.equal(p.vx, 0); assert.equal(w.checkpoint, gate.checkpoint);
  assert.equal(w.events.filter(e => e.kind === "gate-sealed").length, 1);
});

test("a missing required key blocks the exit but permits returning to collect it", () => {
  const w = R.createWorld({ nightNumber: 7 }), gate = w.level.gates.find(g => g.keyIds.length);
  w.player.x = gate.x - 30;
  tick(w, 0.4, { move: 1 });
  assert.equal(R.gateState(w, gate), "locked");
  assert.equal(w.player.x, gate.x - R.GATE_HALF_WIDTH - w.player.w / 2);
  assert.ok(w.events.some(e => e.kind === "gate-locked"));
  const blockedAt = w.player.x;
  tick(w, 0.2, { move: -1 }); assert.ok(w.player.x < blockedAt);
  for (const id of gate.keyIds) {
    const key = w.level.pickups[id];
    assert.ok(key.x > w.returnLimit, "the missed key stays accessible");
    R.collect(w, key);
  }
  assert.equal(R.gateState(w, gate), "open");
  tick(w, 0.65, { move: 1 }); assert.equal(R.gateState(w, gate), "sealed");
  assert.ok(w.level.pickups.filter(p => p.kind === "key" && p.active).every(p => p.x > w.returnLimit));
});

test("later-night scenes label points of no return and reset gate state on next night", () => {
  const h = loadGame(), scene = h.wire(new h.GameScene());
  scene.init({ nightNumber: 7 }); scene.create();
  assert.match(scene.message.text, /gates seal behind you/i);
  assert.match(scene.routeText.text, /ONE WAY/);
  const gate = scene.world.level.gates[0];
  scene.world.player.x = gate.x - 180; scene.renderWorld();
  assert.match(scene.hint.text, /NO RETURN/);
  assert.equal(scene.gateLabels[0].text, "NO RETURN →");
  scene.world.player.x = gate.x + R.GATE_HALF_WIDTH + scene.world.player.w / 2;
  R.step(scene.world); scene.renderWorld();
  assert.equal(scene.gateLabels[0].text, "SEALED");
  scene.events.emit("shutdown");
  h.wire(scene); scene.init({ nightNumber: 8 }); scene.create();
  assert.equal(scene.world.returnLimit, 0);
  assert.equal(scene.gateLabels[0].text, "NO RETURN →");
});
