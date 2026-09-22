const test = require("node:test");
const assert = require("node:assert/strict");
const R = require("../rules");
const { play } = require("./campaign-driver");
const { loadGame } = require("./scene-harness");
const tick = (w, seconds, input = {}) => { for (let i = 0; i < Math.ceil(seconds / R.STEP); i++) R.step(w, input); };

test("campaign chapters are distinct, seeded routes reproduce, and Blood Moon escalates", () => {
  const layouts = Array.from({ length: 12 }, (_, i) => R.buildLevel(i + 1, 42));
  assert.equal(new Set(layouts.map(l=>l.name)).size, 12);
  assert.equal(new Set(layouts.map(l=>l.theme.name)).size, 6);
  assert.equal(new Set(layouts.map(l=>l.sections.map(s=>s.type).join(','))).size, 12);
  assert.deepEqual(R.buildLevel(8, 42), R.buildLevel(8, 42));
  assert.notDeepEqual(R.buildLevel(8, 42).sections, R.buildLevel(8, 7).sections);
  const moon = R.buildLevel(13, 42);
  assert.equal(moon.cycle, 1); assert.ok(moon.duration < layouts[0].duration);
  assert.ok(moon.humans.length > layouts[0].humans.length);
  assert.equal(play(R.createWorld({nightNumber:13, seed:42})).status, "safe");
});

test("the crypt stays locked until the real key pickups have been collected", () => {
  const w = R.createWorld({nightNumber:4});
  w.player.x = w.level.crypt.x;
  tick(w, 0.05);
  assert.equal(w.status, "playing");
  assert.ok(w.events.some(e=>e.kind === 'locked'));
  const keys = w.level.pickups.filter(p=>p.kind === 'key');
  R.collect(w, keys[0]); tick(w, 0.02); assert.equal(w.status, "playing");
  R.collect(w, keys[1]); tick(w, 0.02); assert.equal(w.status, "safe");
  const score = w.score; R.collect(w, keys[1]); assert.equal(w.score, score);
});

test("moving ferry carries a standing player and an attached crypt key", () => {
  const w = R.createWorld({nightNumber:10});
  const ferry = w.level.platforms.find(p=>p.motion);
  R.step(w);
  w.player.x = ferry.x + 15; w.player.y = ferry.y - w.player.h;
  w.player.grounded = true; w.player.groundId = ferry.id;
  const before = w.player.x;
  tick(w, 0.8);
  assert.ok(Math.abs(w.player.x - before) > 10);
  assert.ok(Math.abs(w.player.x - ferry.x - 15) < 0.01);
  assert.equal(w.player.groundId, ferry.id);
  const ferryKeyWorld = Array.from({length:12}, (_, i)=>R.createWorld({nightNumber:i+1})).find(x=>x.level.pickups.some(p=>p.kind==='key' && p.platform!==undefined));
  assert.ok(ferryKeyWorld, 'at least one chapter requires boarding a ferry for its key');
  tick(ferryKeyWorld, 0.5);
  const key = ferryKeyWorld.level.pickups.find(p=>p.kind==='key' && p.platform!==undefined), deck = ferryKeyWorld.level.platforms[key.platform];
  assert.equal(key.x, deck.x + deck.w / 2); assert.equal(key.y, deck.y - 27);
});

test("crumbling ledges warn before collapsing and return for a second attempt", () => {
  const w = R.createWorld({nightNumber:3}), deck = w.level.platforms.filter(p=>p.crumble)[1];
  w.player.x = deck.x + deck.w / 2; w.player.y = deck.y - w.player.h;
  w.player.grounded = true; w.player.groundId = deck.id;
  tick(w, 0.5); assert.equal(deck.active, true); assert.ok(deck.crumbleTime > 0);
  tick(w, 0.5); assert.equal(deck.active, false); assert.equal(w.player.grounded, false);
  tick(w, 2.8); assert.equal(deck.active, true); assert.equal(w.lives, 2);
});

test("hunters visibly wind up, throw damage-dealing garlic, and can be interrupted by stunning", () => {
  const w = R.createWorld({nightNumber:5}), hunter = w.level.humans.find(h=>h.behavior === 'hunter');
  w.player.x = hunter.x - 180; hunter.cooldown = 0;
  R.step(w); assert.ok(hunter.windup > 0); assert.equal(w.projectiles.length, 0);
  tick(w, 0.5); assert.equal(w.projectiles.length, 0);
  tick(w, 0.4); assert.ok(w.projectiles.length > 0);
  const shot = w.projectiles[0];
  w.player.x = shot.x; w.player.y = shot.y - 5; R.step(w);
  assert.equal(w.garlicHits, 1);
  hunter.windup = 0.4; w.player.x = hunter.x - 25; w.player.y = hunter.y;
  assert.equal(R.stun(w), true); assert.equal(hunter.windup, 0);
  assert.equal(R.bite(w), true); assert.equal(hunter.state, 'vampire');
  const before = w.projectiles.length; tick(w, 0.5); assert.ok(w.projectiles.length <= before);
});

test("cross hazards and priests only deal coffin damage during their warned active phase", () => {
  const w = R.createWorld({nightNumber:6});
  const cross = w.level.hazards.find(h=>h.pulse);
  cross.phase = 0; w.player.x = cross.x;
  w.elapsed = 0; R.step(w); assert.equal(w.lives, 3);
  w.elapsed = cross.period * 0.6; R.step(w); assert.equal(w.lives, 3);
  w.elapsed = cross.period * 0.8; R.step(w); assert.equal(w.lives, 2);
  const priest = w.level.humans.find(h=>h.behavior === 'priest');
  priest.phase = 0; w.player.x = priest.x; w.player.y = priest.y;
  w.elapsed = 3.8 * 0.8; w.invulnerable = 0;
  R.stun(w); R.step(w); assert.equal(w.lives, 2, "stunned priests are harmless");
  R.bite(w); assert.equal(priest.state, 'vampire');
});

test("a complete campaign preserves the run and supports restoring coffins without paid upgrades", () => {
  let data = {seed:2026}, total = 0;
  for (let nightNumber = 1; nightNumber <= 12; nightNumber++) {
    const w = R.createWorld({...data, nightNumber});
    assert.equal(play(w).status, 'safe');
    assert.ok(w.score > total); total = w.score;
    assert.equal(w.profile.bestNight, nightNumber);
    while(w.lives < 3 && w.profile.dirt >= R.COFFIN_COST) { w.lives++; w.profile.dirt -= R.COFFIN_COST; }
    data = {seed:2026, score:w.score, lives:w.lives, profile:w.profile};
  }
  assert.ok(data.profile.medals.every(mask=>mask > 0));
  assert.equal(data.profile.upgrades.stride, 0);
});

test("save and quit survives a fresh runtime, preserves the route seed, and death clears the checkpoint", () => {
  const h = loadGame(), crypt = h.wire(new h.CryptScene());
  crypt.init({nightNumber:4, seed:7788, score:9000, lives:2, profile:{dirt:100}, timeLeft:20}); crypt.create();
  h.tap(crypt, 102, 788); assert.equal(crypt.transitions[0].name, 'Menu');
  const fresh = loadGame(); for(const [key,value] of h.storage) fresh.storage.set(key,value);
  const menu = fresh.wire(new fresh.MenuScene()); menu.create(); menu.startRun();
  const checkpoint = menu.transitions[0].data;
  assert.equal(checkpoint.nightNumber, 5); assert.equal(checkpoint.seed, 7788);
  assert.equal(checkpoint.lives, 2); assert.equal(checkpoint.score, 9000);
  const game = fresh.wire(new fresh.GameScene()); game.init(checkpoint); game.create();
  game.world.timeLeft = 0.001; game.update(1, 16);
  assert.equal(fresh.Save.run(), null);
  assert.equal(JSON.parse(fresh.storage.get('vampRunnerCampaign')), null);
});

test("old progress migrates and malformed campaign checkpoints cannot resume invalid runs", () => {
  const p=R.cleanProgress({dirt:123,upgrades:{stride:2,stun:1,iv:0}});
  assert.equal(p.dirt,123); assert.equal(p.upgrades.stride,2); assert.equal(p.medals.length,12);
  assert.equal(R.cleanRun({version:1,nightNumber:9,lives:0}),null);
  assert.equal(R.cleanRun({version:1,nightNumber:'9',lives:3}),null);
  assert.equal(R.cleanRun({version:99,nightNumber:9,lives:3}),null);
});
