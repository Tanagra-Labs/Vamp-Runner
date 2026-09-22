// Scripted keyboard input through the real simulation; no teleports or immunity.
const R = require('../rules');

function play(w, debug = false, detours = false) {
  const route = [];
  for (const section of w.level.sections) {
    for (const id of detours ? section.detour : section.route) route.push({ platform: w.level.platforms[id], section: section.index });
    route.push({ x: section.end - 30, y: R.FLOOR, w: 45, section: section.index });
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
      let deltaY = targetY - (p.y + p.h), root = 0, flight = 0;
      for (let attempt = 0; attempt < 4; attempt++) {
        root = R.JUMP_SPEED ** 2 + 2 * R.GRAVITY * deltaY;
        flight = root >= 0 ? (R.JUMP_SPEED + Math.sqrt(root)) / R.GRAVITY : 0;
        if (deck?.motion?.axis === 'y') {
          const m=deck.motion;
          deltaY=deck.baseY+Math.sin((w.elapsed+flight)*Math.PI*2/m.period+m.phase)*m.range-(p.y+p.h);
        }
      }
      const speed = (R.PLAYER_SPEED + w.profile.upgrades.stride * 18) * (w.iv > 0 ? 1.18 : 1);
      const desired = Math.sign(targetX - p.x) * speed;
      const accelerateFor = Math.min(flight, Math.abs(desired - p.vx) / 1800);
      const accelerated = p.vx + Math.sign(desired - p.vx) * 1800 * accelerateFor;
      // Returning from a cache can leave us moving backwards. Build up speed
      // on the lower ledge before committing to the next gap.
      const landingCenter = p.x + (p.vx + accelerated) * accelerateFor / 2 + desired * (flight - accelerateFor);
      let futureX = targetX;
      if (deck?.motion?.axis === 'x') {
        const m=deck.motion;
        futureX=deck.baseX+Math.sin((w.elapsed+flight)*Math.PI*2/m.period+m.phase)*m.range+deck.w/2;
      }
      const ground = !deck && w.level.platforms.find(p=>p.ground && goal.x >= p.x && goal.x <= p.x+p.w);
      // Air control brakes above the target, so a close, lower landing need not
      // match the distance of a full-speed jump (the old equal stairs hid this).
      const reachable = root >= 0 && (ground ? landingCenter > ground.x + 5 && landingCenter < ground.x + ground.w - 5 : Math.sign(targetX - p.x) * (landingCenter - futureX) >= -targetWidth / 2 + 10);
      const gapBetween = w.level.gaps.some(g=>g.x+g.width>Math.min(p.x,targetX) && g.x<Math.max(p.x,targetX));
      if (reachable && (deltaY < -2 || gapBetween || current?.crumble)) jump = true;
      else if ((gapBetween || deltaY < -2) && current && p.x >= current.x + current.w - 8 && targetX > p.x) move = 0;
      if (deltaY < -2 && root >= 0 && Math.abs(targetX - p.x) < targetWidth / 2 - 12) { jump = true; move = 0; }
      if (current?.bonus && targetY > current.y + 20) {
        goal.dropDirection ??= targetX >= p.x ? 1 : -1;
        move = goal.dropDirection; jump = false;
      }
    }
    const nextHazard = w.level.hazards.find(h=>h.x-p.x>0 && h.x-p.x<66 && p.y+p.h>h.y-h.h/2);
    if (nextHazard && p.grounded) {
      if (nextHazard.pulse) {
        const timeToCross=(nextHazard.x-p.x+nextHazard.w/2+p.w/2)/R.PLAYER_SPEED+0.2;
        const safeTimeLeft=nextHazard.period*0.5-(w.elapsed+nextHazard.phase)%nextHazard.period;
        if (safeTimeLeft < timeToCross) { move=0; jump=false; }
      } else jump=true;
    }
    if (p.grounded && w.projectiles.some(s=>Math.abs(s.x-p.x)<65 && s.vx*(p.x-s.x)>0 && p.y<s.y+15 && p.y+p.h>s.y)) jump=true;
    R.step(w, { move, jump, stun: true, bite: true });
    maxHeight=Math.min(maxHeight,p.y+p.h);
    if(w.stats.lost>lastLost){
      if(debug)console.log('lost',w.elapsed,p.x,index,w.reason);
      lastLost=w.stats.lost;
      if (p.x === w.checkpoint && p.y + p.h === R.FLOOR && p.vx === 0) {
        const section=R.sectionAt(w.level,p.x).index;
        index=route.findIndex(goal=>goal.section===section);
      }
    }
  }
  return { status:w.status, index, goals:route.length, x:w.player.x, height:w.player.y+w.player.h, keys:w.keys, lives:w.lives, elapsed:+w.elapsed.toFixed(2), maxHeight, score:w.score, reason:w.reason };
}
if(require.main===module) for(let n=1;n<=12;n++) console.log(n,play(R.createWorld({nightNumber:n})));
module.exports={play};
