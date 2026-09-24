const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../rules');
const H = require('../hunt');
const { hunt } = require('./hunt-driver');
const { loadGame } = require('./scene-harness');
const tick = (w, seconds, input = {}) => { for (let i = 0; i < Math.ceil(seconds / R.STEP); i++) R.step(w, input); };
const world = (profile) => R.createWorld({ mode: 'bellkeeper', profile });

test('the Bellkeeper can be beaten by stealth, coven-building, or the blood-powered high route', () => {
  const outcomes = [];
  for (const options of [{}, { coven: true }, { high: true }]) {
    const w = world(), result = hunt(w, options);
    assert.equal(result.status, 'safe', JSON.stringify(result));
    assert.equal(w.keys, 1);
    assert.ok(w.timeLeft > 0);
    assert.ok(w.hunt.sealAt > 0);
    assert.equal(w.profile.bestNight, 0, 'standalone hunts do not unlock campaign nights');
    assert.deepEqual(w.profile.medals, Array(12).fill(0));
    outcomes.push(w);
  }
  assert.equal(outcomes[0].stats.turned, 0);
  assert.equal(outcomes[0].hunt.totalDashes, 0, 'the lower roofs never require blood');
  assert.equal(outcomes[1].hunt.allies, 2);
  assert.ok(outcomes[1].hunt.lampsOut && outcomes[1].hunt.bellCut);
  assert.ok(outcomes[2].hunt.totalDashes >= 2);
  assert.ok(outcomes[2].stats.dirt > outcomes[0].stats.dirt, 'the high route has a real reward');
  assert.equal(H.result(outcomes[0]), 'A GHOST IN THE CITY');
  assert.equal(H.result(outcomes[1]), 'COVEN MASTER');
});

test('existing maximum upgrades still leave the authored hunt completable', () => {
  const w = world({ upgrades: { stride: 3, stun: 3, iv: 3 } });
  const result = hunt(w);
  assert.equal(result.status, 'safe', JSON.stringify(result));
});

test('stopping inside a shadow breaks sight and lowers suspicion; moving exposes the vampire', () => {
  const w = world(), guard = w.level.humans[1];
  Object.assign(w.player, { x: 550, y: R.FLOOR - 42 });
  Object.assign(guard, { x: 650, min: 650, max: 650, direction: -1 });
  w.hunt.heat = 75;
  tick(w, 1);
  assert.ok(w.hunt.hidden);
  assert.equal(H.sees(w, guard), false);
  assert.ok(w.hunt.heat < 55);
  R.step(w, { move: 1 }); R.step(w, { move: 1 }); R.step(w, { move: 1 });
  assert.equal(w.hunt.hidden, false);
  guard.direction = -1;
  assert.equal(H.sees(w, guard), true);
});

test('witnessed feeding wakes the watch; taking the roofs avoids their sight', () => {
  const w = world(), victim = w.level.humans[0], witness = w.level.humans[1];
  Object.assign(w.player, { x: victim.x - 20, y: R.FLOOR - 42, facing: 1 });
  Object.assign(witness, { x: victim.x + 90, min: victim.x + 90, max: victim.x + 90, direction: -1, cooldown: 20 });
  victim.state = 'stunned'; victim.stunned = 1;
  w.hunt.heat = 55;
  assert.ok(R.bite(w));
  R.step(w);
  assert.ok(w.hunt.alarm);
  assert.ok(w.hunt.witnesses > 0);
  assert.ok(w.events.some(e => e.kind === 'alarm'));
  w.player.y = R.FLOOR - 200;
  assert.equal(H.sees(w, witness), false);
});

test('each recruit physically travels to sabotage a different part of the hunt', () => {
  for (const [id, field] of [[0, 'lampsOut'], [1, 'bridgeOpen'], [2, 'bellCut'], [4, 'wardBroken']]) {
    const w = world(), person = w.level.humans[id];
    Object.assign(w.player, { x: person.x - 22, y: R.FLOOR - 42, grounded: true, facing: 1 });
    person.cooldown = 10;
    w.hunt.nextBeam = 10; // Begin in the priest's recovery window.
    tick(w, person.behavior === 'priest' ? 1.3 : person.behavior === 'hunter' ? 1.05 : 0.8, { stun: true });
    assert.equal(person.state, 'stunned');
    assert.ok(R.bite(w));
    assert.equal(w.hunt[field], false, 'sabotage is not an instant counter increment');
    const startX = person.x;
    tick(w, 1);
    assert.notEqual(person.x, startX);
    tick(w, 2.3);
    assert.equal(w.hunt[field], true);
    assert.equal(w.hunt.allies, 1);
    assert.ok(w.hunt.blood <= 3);
    if (id === 1) assert.ok(w.level.platforms[w.level.bridge].active);
    if (id === 4) assert.equal(H.result(w), 'THE USURPER');
  }
});

test('swarm spends finite blood, works in the air, recovers control and cannot ignore a cross', () => {
  const w = world();
  R.step(w, { jump: true, move: 1 });
  tick(w, 0.15, { move: 1 });
  const x = w.player.x;
  R.step(w, { dash: true, move: 1 });
  assert.equal(w.hunt.blood, 1);
  assert.ok(w.hunt.dash > 0);
  assert.equal(R.hurt(w, 'garlic'), false);
  assert.equal(R.hurt(w, 'cross'), true);
  tick(w, 0.3, { move: 1 });
  assert.ok(w.player.x - x > 150);
  assert.ok(w.player.vx <= 220, 'the burst must not leave uncontrollable momentum');
  tick(w, 0.5); R.step(w, { dash: true });
  assert.equal(w.hunt.blood, 0);
  tick(w, 0.8); R.step(w, { dash: true });
  assert.equal(w.hunt.totalDashes, 2);
  assert.equal(w.hunt.dash, 0);
});

test('the seal requires sustained glamour, moving interrupts it, and stealing changes the encounter once', () => {
  const w = world(), seal = w.level.pickups[0], altar = w.level.platforms.find(p => p.x === 2290);
  Object.assign(w.player, { x: 2380, y: altar.y - 42, grounded: true, groundId: altar.id });
  w.hunt.nextBeam = 100;
  assert.equal(R.collect(w, seal), false, 'touching the seal is not enough');
  tick(w, 0.9, { stun: true });
  R.step(w, { move: -1, stun: true });
  assert.equal(w.hunt.sealFocus, 0);
  assert.equal(w.keys, 0);
  tick(w, 1.7, { stun: true });
  assert.equal(w.keys, 1);
  assert.equal(w.hunt.phase, 'escape');
  assert.equal(w.hunt.blood, 3);
  assert.equal(w.events.filter(e => e.kind === 'seal-stolen').length, 1);
  assert.equal(R.collect(w, seal), false);
});

test('the Bellkeeper marks the ground before his cross strikes; a dodged mark stays at its original position', () => {
  const w = world();
  Object.assign(w.player, { x: 2030, y: R.FLOOR - 42 });
  tick(w, 0.9);
  assert.ok(w.hunt.beam);
  assert.equal(w.lives, 3, 'warning is harmless');
  const mark = w.hunt.beam.x;
  tick(w, 0.65, { move: 1 });
  assert.equal(w.hunt.beam.x, mark, 'the strike cannot track a dodge');
  assert.equal(w.lives, 3);
  const stationary = world();
  Object.assign(stationary.player, { x: 2030, y: R.FLOOR - 42 });
  tick(stationary, 1.3);
  assert.equal(stationary.lives, 2, 'ignoring the mark costs a coffin');
});

test('the ward catches a player who waits, and a cut bell buys measurable escape time', () => {
  const snapshots = [];
  for (const cut of [false, true]) {
    const w = world();
    w.hunt.sealReady = true; R.collect(w, w.level.pickups[0]);
    w.hunt.bellCut = cut;
    Object.assign(w.player, { x: 2520, y: R.FLOOR - 42 });
    tick(w, 6);
    snapshots.push(w.hunt.pursuitX);
    tick(w, 12);
    assert.equal(w.status, 'dead');
    assert.match(w.reason, /ward caught/);
  }
  assert.ok(snapshots[1] < snapshots[0]);
});

test('roof falls recover on a reached ledge, without restoring blood or undoing the chase', () => {
  const w = world(), roof = w.level.platforms.find(p => p.x === 3010);
  w.hunt.sealReady = true; R.collect(w, w.level.pickups[0]);
  Object.assign(w.player, { x: 3075, y: roof.y - 42, grounded: true, groundId: roof.id });
  R.step(w);
  const safe = { ...w.hunt.safeSpot };
  w.hunt.blood = 0;
  Object.assign(w.player, { x: 2950, y: 720, grounded: false });
  R.step(w);
  assert.equal(w.lives, 2);
  assert.equal(w.player.x, safe.x);
  assert.equal(w.player.y, safe.y);
  assert.equal(w.hunt.blood, 0);
  assert.equal(w.hunt.phase, 'escape');
});

test('featured hunt touch controls are visible, support move plus swarm, and pause freezes the chase', () => {
  const app = loadGame(), scene = app.wire(new app.GameScene());
  scene.init({ mode: 'bellkeeper' }); scene.create();
  for (const item of [scene.stunButton, scene.biteButton, scene.jumpButton, scene.swarmButton]) {
    assert.equal(app.coveringPanels(scene, item.bg).length, 0);
    assert.equal(app.coveringPanels(scene, item.caption).length, 0);
    assert.equal(item.bg.scrollFactorX, 0);
  }
  app.tap(scene, 124, 774, 1); app.tap(scene, 223, 798, 2);
  scene.update(0, 16);
  assert.equal(scene.world.hunt.blood, 1);
  assert.ok(scene.world.player.vx > 500);
  scene.world.hunt.sealReady = true;
  R.collect(scene.world, scene.world.level.pickups[0]);
  Object.assign(scene.world.player, { x: 2570, y: 503 });
  scene.renderWorld();
  app.tap(scene, 351, 174);
  const elapsed = scene.world.elapsed, blood = scene.world.hunt.blood;
  const front = scene.world.hunt.pursuitX, deadline = scene.world.timeLeft;
  scene.update(0, 5000);
  assert.equal(scene.world.elapsed, elapsed);
  assert.equal(scene.world.hunt.pursuitX, front);
  assert.equal(scene.world.timeLeft, deadline);
  assert.equal(scene.world.hunt.blood, blood);
  assert.equal(scene.held.size, 0);
  scene.resumeGame(); scene.input.keyboard.emit('keydown', { code: 'KeyV' });
  assert.equal(scene.pending.dash, true);
});

test('starting, winning, losing and retrying a featured hunt preserves a saved campaign', () => {
  const app = loadGame();
  const checkpoint = { version: 1, nightNumber: 8, seed: 45, lives: 2, score: 6543 };
  app.Save.write('vampRunnerCampaign', checkpoint);
  const saved = app.storage.get('vampRunnerCampaign');
  const menu = app.wire(new app.MenuScene()); menu.create();
  app.tap(menu, 195, 657);
  assert.equal(menu.transitions[0].data.mode, 'bellkeeper');
  for (const won of [false, true]) {
    const scene = app.wire(new app.GameScene()); scene.init({ mode: 'bellkeeper' }); scene.create();
    if (won) { scene.world.status = 'safe'; scene.completeNight(); } else scene.finishRun('The ward caught you.');
    assert.equal(scene.transitions[0].name, 'HuntEnd');
    assert.equal(app.storage.get('vampRunnerCampaign'), saved);
    const end = app.wire(new app.HuntEndScene()); end.init(scene.transitions[0].data); end.create();
    app.tap(end, 195, 693);
    assert.equal(end.transitions[0].data.mode, 'bellkeeper');
    assert.equal(app.storage.get('vampRunnerCampaign'), saved);
  }
});
