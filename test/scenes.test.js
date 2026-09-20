const test = require("node:test");
const assert = require("node:assert/strict");
const { loadGame } = require("./scene-harness");
const R = require("../rules");
function run(data = {}) {
  const h = loadGame(), scene = h.wire(new h.GameScene());
  scene.init(data); scene.create(); return { h, scene };
}

test("menu, textures and gameplay construct through the scene adapter", () => {
  const h = loadGame();
  const boot = h.wire(new h.BootScene()); boot.create();
  const menu = h.wire(new h.MenuScene()); menu.create();
  const { scene } = run(); scene.update(16, 16);
  assert.equal(scene.world.status, "playing");
});

test("Next Night works by tapping after scrolling, carries progress and allows repeated nights", () => {
  const { h, scene } = run();
  const crypt = new h.CryptScene();
  for (let n = 1; n <= 5; n++) {
    scene.world.player.x = scene.world.level.crypt.x;
    scene.update(100, 16);
    assert.equal(scene.transitions.length, 1);
    assert.equal(scene.transitions[0].name, "Crypt");
    assert.ok(scene.cameras.main.scrollX > 2000);
    const data = scene.transitions[0].data;
    scene.events.emit("shutdown");
    assert.equal(h.windowEvents.listenerCount("blur"), 0);
    h.wire(crypt); crypt.init(data); crypt.create();
    assert.equal(crypt.cameras.main.scrollX, 0);
    assert.equal(h.tap(crypt, 195, 724), crypt.next.bg);
    h.tap(crypt, 195, 724); crypt.input.keyboard.emit("keydown-ENTER");
    assert.equal(crypt.transitions.length, 1, "double taps and Enter cannot skip a night");
    const next = crypt.transitions[0].data;
    assert.equal(next.nightNumber, n + 1);
    assert.equal(next.score, data.score);
    assert.equal(next.lives, 3);
    crypt.events.emit("shutdown");
    // Phaser reuses the same scene object, not a new constructor each night.
    h.wire(scene); scene.init(next); scene.create();
    assert.equal(scene.world.night, n + 1);
    assert.equal(scene.transitioning, false);
    assert.equal(scene.paused, false);
    assert.equal(scene.world.timeLeft, R.nightSettings(n + 1).duration);
    scene.keys.D.isDown = true; scene.update(120, 33);
    assert.ok(scene.world.player.x > 80, "next night accepts movement");
  }
});

test("fixed controls hit their visible positions with camera offsets and support simultaneous fingers", () => {
  const { h, scene } = run();
  scene.world.player.x = 1600; scene.renderWorld();
  h.tap(scene, 124, 774, 1); h.tap(scene, 276, 798, 2);
  scene.update(100, 16);
  assert.ok(scene.world.player.vx > 0); assert.ok(scene.world.player.vy < 0);
  scene.input.emit("pointerupoutside", { id: 2 });
  assert.equal(scene.held.get(1), 1);
  scene.input.emit("pointerupoutside", { id: 1 }); assert.equal(scene.held.size, 0);
  h.tap(scene, 351, 174); assert.equal(scene.paused, true);
  h.tap(scene, 195, 564); assert.equal(scene.paused, false);
});

test("pause freezes the actual simulation, clears held inputs and cleans up blur listeners", () => {
  const { h, scene } = run();
  scene.keys.D.isDown = true; scene.pending.jump = true;
  h.windowEvents.emit("blur");
  const before = JSON.stringify(scene.world);
  scene.update(10000, 10000); assert.equal(JSON.stringify(scene.world), before);
  assert.equal(scene.keys.D.isDown, false); assert.deepEqual(Object.keys(scene.pending), []);
  scene.resumeGame(); scene.update(10050, 16); assert.ok(scene.world.timeLeft < scene.world.level.duration);
  scene.events.emit("shutdown");
  assert.equal(h.windowEvents.listenerCount("blur"), 0);
  assert.equal(h.documentEvents.listenerCount("visibilitychange"), 0);
  assert.equal(scene.input.keyboard.listenerCount("keydown"), 0);
});

test("touch stun and bite turn a human, and collections persist in browser progress", () => {
  const { h, scene } = run();
  scene.world.player.x = scene.world.level.humans[0].x - 25;
  h.tap(scene, 223, 737); scene.update(16, 16);
  assert.equal(scene.world.level.humans[0].state, "stunned");
  h.tap(scene, 329, 737); scene.update(32, 16);
  assert.equal(scene.world.stats.turned, 1);
  R.collect(scene.world, scene.world.level.pickups[0]); scene.update(48, 16);
  const saved = JSON.parse(h.storage.get("vampRunnerProgress"));
  assert.equal(saved.dirt, scene.world.profile.dirt);
});

test("crypt purchases and coffin restoration are carried into the next night", () => {
  const h = loadGame(), crypt = h.wire(new h.CryptScene());
  crypt.init({ nightNumber: 1, score: 1300, lives: 2, profile: { dirt: 100 }, timeLeft: 30 }); crypt.create();
  h.tap(crypt, 302, 384); h.tap(crypt, 195, 640);
  assert.equal(crypt.run.profile.upgrades.stride, 1);
  assert.equal(crypt.run.profile.dirt, 62); assert.equal(crypt.run.lives, 3);
  h.tap(crypt, 195, 640); assert.equal(crypt.run.profile.dirt, 62);
  h.tap(crypt, 195, 724);
  assert.equal(crypt.transitions[0].data.profile.upgrades.stride, 1);
  assert.equal(JSON.parse(h.storage.get("vampRunnerProgress")).dirt, 62);
});

test("sunrise transition runs once and does not leave an invisible input-blocking overlay", () => {
  const { scene } = run(); scene.world.timeLeft = 0.001;
  scene.update(1, 16); scene.update(2, 16); scene.showSunrise();
  assert.equal(scene.time.callbacks.length, 1);
  scene.time.callbacks[0]();
  assert.equal(scene.transitions.length, 1); assert.equal(scene.transitions[0].name, "Score");
  assert.equal(scene.transitions[0].data.nights, 0); assert.equal(scene.transitions[0].data.score, 0);
});

test("score submission remains idempotent and preserves existing names", () => {
  const h = loadGame();
  h.storage.set("vampRunnerScores", JSON.stringify([{ name: "VAL    ", score: 800 }]));
  const scene = h.wire(new h.ScoreScene()); scene.init({ score: 2000, nights: 2 }); scene.create();
  scene.pressKey("V"); scene.submitScore(); scene.submitScore();
  const scores = JSON.parse(h.storage.get("vampRunnerScores"));
  assert.equal(scores.length, 2); assert.equal(scores[0].score, 2000); assert.equal(scores[1].name, "VAL");
});

test("blocked storage keeps the game playable and carries upgrades through replay", () => {
  const h = loadGame(); h.context.localStorage.setItem = () => { throw Error("blocked"); };
  const crypt = h.wire(new h.CryptScene());
  crypt.init({ nightNumber: 1, score: 500, lives: 3, profile: { dirt: 20 }, timeLeft: 20 }); crypt.create();
  crypt.buy("stride"); assert.equal(crypt.storageOK, false); crypt.endRun();
  const scene = h.wire(new h.ScoreScene()); scene.init(crypt.transitions[0].data); scene.create();
  scene.submitScore(); assert.equal(scene.submitted, false); assert.equal(scene.save.caption.text, "SAVE UNAVAILABLE");
  scene.input.keyboard.emit("keydown", { key: "Enter" });
  assert.equal(scene.transitions[0].data.profile.upgrades.stride, 1);
  const menu = h.wire(new h.MenuScene()); menu.create(); menu.startRun();
  assert.equal(menu.transitions[0].data.profile.upgrades.stride, 1);
});
