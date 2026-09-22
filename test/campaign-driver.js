// Scripted keyboard input through the real simulation; no teleports or immunity.
const R = require('../rules');

function play(w, debug = false) {
  const route = [];
  for (const section of w.level.sections) {
    const decks = w.level.platforms.filter(p => !p.ground && p.baseX >= section.start && p.baseX < section.end);
    const needsRoofs = section.keyId !== undefined || ['roofs', 'ruins', 'canal', 'chapel'].includes(section.type);
    if (needsRoofs || section.type === 'bridge') for (const deck of decks) route.push({ platform: deck });
    route.push({ x: section.end - 30, y: R.FLOOR, w: 45 });
  }
  route.push({ x: w.level.crypt.x + 5, y: R.FLOOR, w: 40 });
  let index = 0, lastLost = 0, maxHeight = R.FLOOR;
  for (let i = 0; i < 120 * w.level.duration && w.status === 'playing'; i++) {
    const p = w.player, goal = route[Math.min(index, route.length - 1)], deck = goal.platform;
    const targetX = deck ? deck.x + deck.w / 2 : goal.x;
    const targetY = deck ? deck.y : goal.y;
    const targetWidth = deck ? deck.w : goal.w;
    let move = Math.abs(targetX - p.x) > 10 ? Math.sign(targetX - p.x) : 0, jump = false;
    const sameDeck = deck ? p.groundId === deck.id : p.y + p.h === R.FLOOR;
    if (p.grounded && sameDeck && Math.abs(p.x - targetX) < 20) { index++; if(debug)console.log('goal',index,p.x,p.y+p.h,w.elapsed); }
    const current = w.level.platforms.find(x=>x.id === p.groundId);
    if (p.grounded && !sameDeck) {
      const deltaY = targetY - (p.y + p.h);
      const root = R.JUMP_SPEED ** 2 + 2 * R.GRAVITY * deltaY;
      const flight = root >= 0 ? (R.JUMP_SPEED + Math.sqrt(root)) / R.GRAVITY : 0;
      const speed = (R.PLAYER_SPEED + w.profile.upgrades.stride * 18) * (w.iv > 0 ? 1.18 : 1);
      let landingCenter = p.x + Math.sign(targetX - p.x) * speed * flight;
      let futureX = targetX;
      if (deck?.motion) {
        const m=deck.motion;
        futureX=deck.baseX+Math.sin((w.elapsed+flight)*Math.PI*2/m.period+m.phase)*m.range+deck.w/2;
      }
      const ground = !deck && w.level.platforms.find(p=>p.ground && goal.x >= p.x && goal.x <= p.x+p.w);
      const reachable = root >= 0 && (ground ? landingCenter > ground.x + 5 && landingCenter < ground.x + ground.w - 5 : Math.abs(landingCenter - futureX) < targetWidth / 2 - 2);
      const gapBetween = w.level.gaps.some(g=>g.x+g.width>p.x && g.x<targetX);
      if (reachable && (deltaY < -2 || gapBetween || current?.crumble)) jump = true;
      else if ((gapBetween || deltaY < -2) && current && p.x >= current.x + current.w - 8 && targetX > p.x) move = 0;
      if (deltaY < -2 && root >= 0 && Math.abs(targetX - p.x) < targetWidth / 2 - 12) { jump = true; move = 0; }
    }
    const nextHazard = w.level.hazards.find(h=>h.x-p.x>0 && h.x-p.x<66 && p.y+p.h>h.y-h.h/2);
    if (nextHazard && p.grounded) {
      if (nextHazard.pulse && R.pulseState(w.elapsed, nextHazard.period, nextHazard.phase)!=='safe') move=0;
      else if (!nextHazard.pulse) jump=true;
    }
    if (p.grounded && w.projectiles.some(s=>Math.abs(s.x-p.x)<65 && s.vx*(p.x-s.x)>0 && p.y<s.y+15 && p.y+p.h>s.y)) jump=true;
    R.step(w, { move, jump, stun: true, bite: true });
    maxHeight=Math.min(maxHeight,p.y+p.h);
    if(w.stats.lost>lastLost){ if(debug)console.log('lost',w.elapsed,p.x,index,w.reason); lastLost=w.stats.lost; }
  }
  return { status:w.status, index, goals:route.length, x:w.player.x, height:w.player.y+w.player.h, keys:w.keys, lives:w.lives, elapsed:+w.elapsed.toFixed(2), maxHeight, score:w.score, reason:w.reason };
}
if(require.main===module) for(let n=1;n<=12;n++) console.log(n,play(R.createWorld({nightNumber:n})));
module.exports={play};
