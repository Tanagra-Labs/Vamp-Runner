const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../rules');
const { loadGame } = require('./scene-harness');
const tick = (w, seconds, input = {}) => { for (let i=0;i<Math.ceil(seconds/R.STEP);i++) R.step(w,input); };
function face(w,h) {
  Object.assign(w.player,{x:h.x-25,y:R.FLOOR-w.player.h,vx:0,vy:0,grounded:true,facing:1});
  w.stunCooldown=0;
}

test('glamour requires uninterrupted focus; movement, release, jumping, damage and looking away cancel it', () => {
  for (const cause of ['move','release','jump','hurt','turn','range']) {
    const w=R.createWorld(),h=w.level.humans[0]; face(w,h);
    tick(w,0.3,{stun:true}); assert.ok(w.focus); assert.equal(h.state,'human');
    if(cause==='hurt') R.hurt(w,'garlic');
    if(cause==='turn') w.player.facing=-1;
    if(cause==='range') h.x=w.player.x+100;
    R.step(w,{stun:cause!=='release',move:cause==='move'?1:0,jump:cause==='jump'});
    assert.equal(w.focus,null,cause); assert.equal(w.profile.dirt,0,cause); assert.equal(h.state,'human',cause);
  }
});

test('glamour pays once per human, bites heal and three conversions earn one non-stacking veil', () => {
  const w=R.createWorld(),h=w.level.humans[0]; face(w,h);
  tick(w,0.8,{stun:true}); assert.equal(w.profile.dirt,2);
  tick(w,1.5); face(w,h); tick(w,0.8,{stun:true});
  assert.equal(w.profile.dirt,2,'waiting for glamour to expire cannot farm dirt');
  w.garlicHits=2; assert.equal(R.bite(w),true); assert.equal(w.garlicHits,1);
  assert.equal(w.profile.dirt,6); assert.equal(R.bite(w),false);
  for(const other of w.level.humans.slice(1,3)) { face(w,other); tick(w,0.8,{stun:true}); assert.equal(R.bite(w),true); }
  assert.equal(w.stats.turned,3); assert.equal(w.stats.glamoured,3); assert.equal(w.profile.dirt,18);
  assert.equal(w.stats.dirt,0,'glamour currency does not replace exploring for the dirt challenge');
  assert.equal(w.veil,true); assert.equal(w.feeds,0);
  assert.equal(R.hurt(w,'cross'),false); assert.equal(w.veil,false); assert.equal(w.lives,3);
  w.invulnerable=0; R.hurt(w,'cross'); assert.equal(w.lives,2);
  w.veil=true; w.invulnerable=0; R.hurt(w,'fall'); assert.equal(w.lives,1,'a veil cannot rescue a fall');
});

test('a hunter can interrupt unfinished glamour with its throw', () => {
  const w=R.createWorld({nightNumber:5}),h=w.level.humans.find(h=>h.behavior==='hunter');
  face(w,h); h.windup=0.4; h.aim=-1;
  tick(w,0.6,{stun:true});
  assert.equal(h.state,'human'); assert.equal(w.focus,null); assert.equal(w.profile.dirt,0);
  assert.equal(w.garlicHits,1);
});

test('sunrise warnings fire at thresholds once, including underground, and protection cannot stop dawn', () => {
  const w=R.createWorld({nightNumber:9});
  R.advanceClock(w,w.timeLeft-61); R.advanceClock(w,2); R.advanceClock(w,30); R.advanceClock(w,20);
  assert.deepEqual(w.events.filter(e=>e.kind==='dawn-warning').map(e=>e.seconds),[60,30,10]);
  assert.equal(R.dawnState(w).final,true);
  w.veil=true; w.iv=100;
  R.advanceClock(w,100); R.advanceClock(w,100);
  assert.equal(w.status,'dead'); assert.match(w.reason,/dawn curse/);
  assert.equal(w.events.filter(e=>e.kind==='dead').length,1);
});

test('slow frames consume real active time while pauses freeze the sunrise deadline', () => {
  const h=loadGame(),scene=h.wire(new h.GameScene()); scene.init(); scene.create();
  const before=scene.world.timeLeft; scene.update(5000,5000);
  assert.ok(Math.abs(scene.world.timeLeft-(before-5))<R.STEP);
  scene.pauseGame(); const paused=scene.world.timeLeft; scene.update(15000,10000);
  assert.equal(scene.world.timeLeft,paused);
});

test('catacombs and sewers are distinct underground routes and garlic vents follow warned pulses', () => {
  const a=R.buildLevel(9,7),b=R.buildLevel(10,7);
  assert.equal(a.theme.underground,true); assert.equal(b.theme.underground,true);
  assert.equal(new Set([...a.sections,...b.sections].map(s=>s.type)).size,16);
  assert.ok(a.platforms.some(p=>p.skin==='bone')); assert.ok(b.platforms.some(p=>p.skin==='pipe'));
  assert.ok(R.buildLevel(3).humans.some(h=>h.behavior==='priest'));
  const w=R.createWorld({nightNumber:10}),vent=w.level.hazards.find(h=>h.visual==='vent');
  vent.phase=0; w.player.x=vent.x; R.step(w); assert.equal(w.garlicHits,0);
  w.elapsed=vent.period*0.8; R.step(w); assert.equal(w.garlicHits,1);
});
