const test=require('node:test');
const assert=require('node:assert/strict');
const A=require('../audio');

test('district motifs and key gameplay sounds have distinct, bounded voices and pickup variations',()=>{
  const motifs=Object.keys(A.THEMES).map(key=>JSON.stringify(A.pattern('ambient',key)));
  assert.equal(new Set(motifs).size,8);
  const kinds=['jump','dirt','syringe','iv','key','focus','stun','bite','veil','veil-blocked','hurt','gate-sealed','dawn-warning','heartbeat','safe','dead','swarm','bell','alarm','consecrate','seal-stolen','coven-born','sabotage','pursuit','witness'];
  assert.equal(new Set(kinds.map(kind=>JSON.stringify(A.pattern(kind)))).size,kinds.length);
  assert.notDeepEqual(A.pattern('dirt','quarter',0),A.pattern('dirt','quarter',1));
  for(const key of Object.keys(A.THEMES)) for(const kind of kinds) for(const n of A.pattern(kind,key)) {
    assert.ok(n.frequency>20&&n.frequency<2500); assert.ok(n.volume>0&&n.volume<=0.05); assert.ok(n.duration>0&&n.duration<=1.2);
  }
});

test('sound is lazy and optional, scheduled on game time, and active voices stop without lingering timers',()=>{
  let enabled=false,creations=0; const oscillators=[];
  const parameter=()=>({setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}});
  const ctx={currentTime:1,state:'running',destination:{},
    createOscillator(){const o={frequency:parameter(),connect(){},disconnect(){this.disconnected=true;},start(t){this.startAt=t;},stop(t){this.stopAt=t;}};oscillators.push(o);return o;},
    createGain(){return {gain:parameter(),connect(){},disconnect(){}};}
  };
  const sound=A.createSound({enabled:()=>enabled,contextFactory:()=>{creations++;return ctx;}});
  sound.play('key'); sound.tick(0,100); assert.equal(creations,0);
  enabled=true; sound.setTheme('catacombs'); sound.tick(0,100);
  assert.equal(creations,1); const count=oscillators.length; assert.ok(count>0);
  sound.tick(0.2,99.8); assert.equal(oscillators.length,count);
  sound.stop(); assert.ok(oscillators.every(o=>o.disconnected&&o.stopAt===undefined));
  ctx.currentTime=10; sound.tick(9,9); const beats=oscillators.length;
  sound.tick(9.2,8.8); assert.equal(oscillators.length,beats,'one heartbeat pair per remaining second');
  enabled=false; sound.stop(); sound.play('key'); assert.equal(oscillators.length,beats);
  const unavailable=A.createSound({enabled:()=>true,contextFactory:()=>{throw Error('unsupported');}});
  assert.doesNotThrow(()=>unavailable.play('safe'));
});
