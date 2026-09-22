const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('../bat');
const R = require('../rules');
const { fly } = require('./bat-driver');
const { loadGame } = require('./scene-harness');
const tick = (w,seconds,input={}) => { for(let i=0;i<Math.ceil(seconds/R.STEP);i++) B.step(w,input); };

test('bat routes, invitations and the shared deadline work across early, underground and Blood Moon nights', () => {
  const residents=new Set();
  for(const night of [2,3,4,5,6,7,9,10,12,13]) for(const seed of [1,7,2026]) {
    const w=B.createFlight({nightNumber:night,seed}),result=fly(w);
    assert.equal(result.status,'invited',JSON.stringify({night,seed,...result}));
    assert.equal(w.lives,3); assert.ok(w.elapsed>10&&w.elapsed<25);
    assert.ok(Math.abs(w.timeLeft+w.elapsed-w.level.duration)<0.001);
    const ground=R.createWorld({nightNumber:night,seed,timeLeft:w.timeLeft,profile:w.profile,score:w.score,lives:w.lives});
    assert.equal(ground.timeLeft,w.timeLeft); assert.equal(ground.profile.dirt,5);
    residents.add(w.resident.name);
  }
  assert.equal(residents.size,5);
});

test('a window needs calm, sustained glamour and the correct promise, with no repeated reward', () => {
  const w=B.createFlight({nightNumber:2,seed:7}); w.status='window';
  const correct=w.resident.choices.findIndex(c=>c[0]===w.resident.promise),wrong=(correct+1)%3;
  assert.equal(B.choose(w,correct),false);
  w.elapsed=3.1; tick(w,0.3,{glamour:true}); assert.equal(w.focus,0);
  w.elapsed=0; tick(w,0.5,{glamour:true}); B.step(w); assert.equal(w.focus,0,'release breaks concentration');
  tick(w,1.12,{glamour:true}); assert.ok(w.invitationLeft>0);
  const before=w.timeLeft; B.choose(w,wrong);
  assert.equal(w.status,'window'); assert.equal(w.timeLeft,before-2); assert.equal(w.profile.dirt,0);
  w.elapsed=0; tick(w,1.12,{glamour:true}); assert.equal(B.choose(w,correct),true);
  assert.equal(w.profile.dirt,5); assert.equal(w.score,200);
  assert.equal(B.choose(w,correct),false); assert.equal(w.profile.dirt,5);
});

test('flight collisions, three refusals and sunrise spend real resources or end the run', () => {
  const w=B.createFlight(),o=w.obstacles[0];
  w.bat.x=o.x; w.bat.y=245; B.step(w);
  assert.equal(w.lives,2); assert.ok(w.bat.x<o.x); assert.equal(w.invulnerable,1);
  w.status='window'; const wrong=w.resident.choices.findIndex(c=>c[0]!==w.resident.promise);
  for(let i=0;i<3;i++) { w.invitationLeft=3; B.choose(w,wrong); }
  assert.equal(w.lives,1);
  w.invitationLeft=3; tick(w,4.1); assert.equal(w.invitationLeft,0);
  w.timeLeft=0.001; B.step(w); assert.equal(w.status,'dead');
  assert.equal(B.choose(w,0),false);
});

test('bat scenes pause the clock, release held touch input and remove listeners on exit', () => {
  const h=loadGame(),scene=h.wire(new h.BatScene()); scene.init({nightNumber:2}); scene.create();
  h.tap(scene,195,715,2); scene.update(0,16); assert.ok(scene.flight.bat.vy<0);
  h.windowEvents.emit('blur'); assert.equal(scene.held.size,0);
  const time=scene.flight.timeLeft; scene.update(10000,10000); assert.equal(scene.flight.timeLeft,time);
  scene.resumeGame(); scene.update(10020,16); assert.ok(scene.flight.timeLeft<time);
  scene.events.emit('shutdown'); assert.equal(h.windowEvents.listenerCount('blur'),0); assert.equal(h.documentEvents.listenerCount('visibilitychange'),0);
});
