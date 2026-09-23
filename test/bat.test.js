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

test('bat flight controls remain visible above the panel and explain automatic forward flight', () => {
  const h=loadGame(),scene=h.wire(new h.BatScene()); scene.init({nightNumber:2}); scene.create();
  for(const object of [scene.flap.bg,scene.flap.caption]) {
    assert.equal(object.visible,true);
    assert.equal(h.coveringPanels(scene,object).length,0,'the Flap control must not be painted over');
  }
  assert.match(scene.note.text,/automatically/i);
  assert.match(scene.flightHelp.text,/hold.*space.*rise/i);
  assert.match(scene.flightHelp.text,/release.*descend/i);
  assert.equal(h.tap(scene,195,715,2),scene.flap.bg);
  for(let i=0;i<12;i++)scene.update(0,1000*R.STEP);
  assert.ok(scene.flight.bat.x>65,'forward flight is automatic');
  assert.ok(scene.flight.bat.vy<0,'holding Flap rises');
  scene.input.emit('pointerup',{id:2});
  for(let i=0;i<40;i++)scene.update(0,1000*R.STEP);
  assert.ok(scene.flight.bat.vy>0,'releasing Flap descends');
  scene.events.emit('shutdown');
});

test('all resident choices are readable and touch or keyboard can earn an invitation after glamour', () => {
  for(const inputMode of ['touch','keyboard']) for(let seed=0;seed<5;seed++) {
    const h=loadGame(),scene=h.wire(new h.BatScene()); scene.init({nightNumber:2,seed}); scene.create();
    const f=scene.flight; f.status='window'; f.bat.x=f.window.x-32; f.bat.y=f.window.y;
    scene.renderFlight();
    assert.ok(scene.cameras.main.scrollX>1000);
    assert.equal(scene.flap.bg.visible,false); assert.equal(scene.flap.bg.interactive,false);
    assert.equal(scene.flightHelp.visible,false);
    for(const choice of scene.choices) {
      assert.equal(choice.bg.visible,true); assert.equal(choice.caption.visible,true);
      assert.equal(choice.bg.interactive,false,'read the promises before glamour; no early selection');
      for(const object of [choice.bg,choice.caption]) {
        assert.equal(object.scrollFactorX,0);
        assert.equal(h.coveringPanels(scene,object).length,0,'a promise must not be painted over');
      }
    }
    const correct=f.resident.choices.findIndex(c=>c[0]===f.resident.promise);
    assert.equal(h.tap(scene,195,scene.choices[correct].bg.y),null);
    assert.equal(h.coveringPanels(scene,scene.glamour.caption).length,0);
    if(inputMode==='touch')assert.equal(h.tap(scene,195,615,2),scene.glamour.bg);
    else scene.keys.E.isDown=true;
    for(let i=0;i<Math.ceil(1.2/R.STEP);i++)scene.update(0,1000*R.STEP);
    assert.ok(f.invitationLeft>0); assert.match(scene.note.text,/1.*2.*3/);
    assert.ok(scene.choices.every(choice=>choice.bg.interactive));
    scene.input.emit('pointerup',{id:2}); scene.keys.E.isDown=false;
    if(inputMode==='touch')assert.equal(h.tap(scene,195,scene.choices[correct].bg.y,3),scene.choices[correct].bg);
    else scene.input.keyboard.emit('keydown',{code:`Digit${correct+1}`});
    assert.equal(f.status,'invited'); scene.update(0,16);
    assert.equal(f.profile.dirt,5); assert.equal(f.score,200);
    scene.time.callbacks[0]();
    assert.equal(scene.transitions[0].name,'Game');
    assert.equal(scene.transitions[0].data.timeLeft,f.timeLeft);
    scene.events.emit('shutdown');
  }
});
