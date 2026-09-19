const test = require("node:test");
const assert = require("node:assert/strict");
const { loadGame } = require("./scene-harness");
const R = require("../rules");
function run(night = 1) {
  const harness = loadGame();
  const scene = harness.wire(new harness.GameScene());
  scene.init({ nightNumber: night });
  scene.create();
  return { scene, harness };
}

for (let night = 1; night <= 3; night++)
  test(`night ${night} builds without overlapping NPC spawns or wall spawns`, () => {
    const { scene } = run(night),
      occupied = new Set();
    for (const npc of scene.npcs) {
      const row = Math.floor(npc.sprite.y / 40),
        col = Math.floor(npc.sprite.x / 40),
        key = row + "," + col;
      assert.notEqual(scene.levelData[row][col], 1);
      assert.ok(!occupied.has(key));
      occupied.add(key);
    }
    assert.equal(scene.npcs.length, 18);
    assert.equal(scene.physics.overlaps.length, 3);
    assert.equal(scene.timerBar.width, 342);
    assert.equal(scene.physics.paused, false);
  });

test("keyboard movement supports diagonals and ZQSD, and stopping clears velocity", () => {
  const { scene } = run();
  scene.keys.Z.isDown = true;
  scene.keys.D.isDown = true;
  scene.update(100, 16);
  assert.ok(
    Math.abs(
      Math.hypot(...Object.values(scene.player.body.velocity)) - R.PLAYER_SPEED,
    ) < 0.0001,
  );
  assert.ok(scene.player.body.velocity.y < 0);
  scene.keys.Z.isDown = false;
  scene.keys.D.isDown = false;
  scene.keys.Q.isDown = true;
  scene.update(116, 16);
  assert.equal(scene.player.body.velocity.x, -R.PLAYER_SPEED);
  scene.input.keyboard.resetKeys();
  scene.update(132, 16);
  assert.equal(scene.player.body.velocity.x, 0);
});

test("dash blocks hunter damage, has a cooldown, and does not leave permanent immunity", () => {
  const { scene } = run(),
    priest = scene.npcs.find((n) => n.type === "priest");
  scene.startDash();
  const cooldown = scene.dashCooldown;
  scene.startDash();
  assert.equal(scene.dashCooldown, cooldown);
  scene.touchNPC(priest);
  assert.equal(scene.lives, 3);
  for (let i = 0; i < 5; i++) scene.update(i * 50, 50);
  scene.touchNPC(priest);
  assert.equal(scene.lives, 2);
  scene.touchNPC(priest);
  assert.equal(scene.lives, 2);
});

test("stunned priests cannot hurt the player and allies cannot cause garlic damage", () => {
  const { scene } = run(),
    priest = scene.npcs.find((n) => n.type === "priest"),
    garlic = scene.npcs.find((n) => n.type === "garlic");
  priest.stunTimer = 1000;
  scene.touchNPC(priest);
  assert.equal(scene.lives, 3);
  garlic.glamoured = true;
  scene.touchNPC(garlic);
  assert.equal(scene.garlicHits, 0);
});

test("three separate garlic hits cost one coffin; blood heals and recharges dash once", () => {
  const { scene } = run(),
    garlic = scene.npcs.find((n) => n.type === "garlic");
  for (let i = 0; i < 3; i++) {
    scene.invulnerableFor = 0;
    scene.touchNPC(garlic);
  }
  assert.equal(scene.lives, 2);
  assert.equal(scene.garlicHits, 0);
  scene.garlicHits = 2;
  scene.dashCooldown = 3;
  const blood = scene.syringes.getChildren()[0];
  scene.collectSyringe(scene.player, blood);
  scene.collectSyringe(scene.player, blood);
  assert.equal(scene.syringesCollected, 1);
  assert.equal(scene.garlicHits, 1);
  assert.equal(scene.dashCooldown, 1.8);
});

test("glamour requires player proximity and sight, then turns one civilian into a helper", () => {
  const { scene } = run(),
    npc = scene.npcs.find((n) => n.type === "plain");
  scene.player.setPosition(180, 140);
  npc.sprite.setPosition(180, 220);
  scene.glamourNPC(npc);
  assert.equal(npc.glamoured, false);
  npc.sprite.setPosition(700, 700);
  scene.glamourNPC(npc);
  assert.equal(npc.glamoured, false);
  npc.sprite.setPosition(220, 140);
  scene.glamourNPC(npc);
  scene.glamourNPC(npc);
  assert.equal(npc.glamoured, true);
  assert.equal(scene.glamouredEver, 1);
});

test("touch releases outside the game and a second pointer cannot hijack movement", () => {
  const { scene } = run();
  scene.input.emit("pointerdown", { id: 1, x: 80, y: 780 });
  scene.input.emit("pointermove", { id: 1, x: 100, y: 760 });
  assert.ok(scene.joystick.dx > 0);
  scene.input.emit("pointerdown", { id: 2, x: 50, y: 750 });
  assert.equal(scene.joystick.pointerId, 1);
  scene.input.emit("pointerupoutside", { id: 2 });
  assert.equal(scene.joystick.active, true);
  scene.input.emit("pointerupoutside", { id: 1 });
  assert.equal(scene.joystick.active, false);
  assert.equal(scene.joystick.dx, 0);
});

test("pause freezes dawn, physics and cooldowns; resume clears held input; blur listeners clean up", () => {
  const { scene, harness } = run();
  scene.keys.W.isDown = true;
  scene.startDash();
  scene.input.keyboard.emit("keydown", { code: "Escape", repeat: false });
  const time = scene.timeLeft,
    cooldown = scene.dashCooldown;
  scene.update(10000, 10000);
  assert.equal(scene.timeLeft, time);
  assert.equal(scene.dashCooldown, cooldown);
  assert.equal(scene.physics.paused, true);
  assert.equal(scene.time.paused, true);
  assert.equal(scene.keys.W.isDown, false);
  scene.input.keyboard.emit("keydown", { code: "Escape", repeat: false });
  assert.equal(scene.physics.paused, false);
  assert.equal(scene.time.paused, false);
  harness.windowEvents.emit("blur");
  assert.equal(scene.paused, true);
  scene.events.emit("shutdown");
  assert.equal(harness.windowEvents.listenerCount("blur"), 0);
  assert.equal(harness.documentEvents.listenerCount("visibilitychange"), 0);
});

test("night completion freezes every actor, grants one bonus, and next night preserves the run", () => {
  const { scene } = run(3);
  scene.lives = 2;
  scene.timeLeft = 30;
  scene.npcs[0].sprite.setVelocity(55, 10);
  scene.triggerNightComplete();
  const total = scene.accumulatedScore;
  scene.triggerNightComplete();
  assert.equal(scene.accumulatedScore, total);
  assert.equal(scene.lives, 3);
  assert.equal(scene.npcs[0].sprite.body.velocity.x, 0);
  assert.equal(scene.physics.paused, true);
  scene.collectSyringe(scene.player, scene.syringes.getChildren()[0]);
  assert.equal(scene.syringesCollected, 0);
  scene.nextNight();
  assert.equal(scene.transitions[0].data.nightNumber, 4);
  assert.equal(scene.transitions[0].data.accumulatedScore, total);
});

test("sunrise loss is a single transition with zero survival bonus and zero completed nights", () => {
  const { scene } = run();
  scene.timeLeft = 0.01;
  scene.update(100, 50);
  scene.triggerLose("again");
  scene.update(150, 50);
  assert.equal(scene.transitions.length, 1);
  assert.equal(scene.transitions[0].name, "Score");
  assert.equal(scene.transitions[0].data.score, 0);
  assert.equal(scene.transitions[0].data.nights, 0);
});

test("score submission is idempotent and preserves existing scores", () => {
  const h = loadGame();
  h.storage.set(
    "vampRunnerScores",
    JSON.stringify([{ name: "VAL    ", score: 800 }]),
  );
  const scene = h.wire(new h.ScoreScene());
  scene.init({ score: 2000, nights: 2 });
  scene.create();
  scene.pressKey("V");
  scene.submitScore();
  scene.submitScore();
  const scores = JSON.parse(h.storage.get("vampRunnerScores"));
  assert.equal(scores.length, 2);
  assert.equal(scores[0].score, 2000);
  assert.equal(scores[1].name, "VAL");
});

test("blocked score storage reports failure without blocking replay", () => {
  const h = loadGame();
  h.context.localStorage.setItem = () => {
    throw Error("storage blocked");
  };
  const scene = h.wire(new h.ScoreScene());
  scene.init({ score: 100 });
  scene.create();
  scene.submitScore();
  assert.equal(scene.submitted, false);
  assert.equal(scene.save.caption.text, "SAVE UNAVAILABLE");
  scene.input.keyboard.emit("keydown", { key: "Enter" });
  assert.equal(scene.transitions[0].name, "Game");
});
