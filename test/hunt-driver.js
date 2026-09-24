// Authored input routes through the real simulation. No teleports or immunity.
const R = require('../rules');
const { play } = require('./campaign-driver');
function hunt(w, { coven = false, high = false, debug = false } = {}) {
  const route = [];
  w.level.sections.forEach((section, i) => {
    let ids = coven && i === 0 ? [] : section.route;
    if (high && i === 2) ids = [...w.level.highRoute, ...section.route.slice(5)];
    for (const id of ids) route.push({ platform: w.level.platforms[id], section: i });
    if (section.exitGround !== false) route.push({ x: section.end + 35, y: R.FLOOR, w: 45, section: i });
  });
  route.push({ x: w.level.crypt.x + 5, y: R.FLOOR, w: 40 });
  const sealDeck = w.level.platforms.find(p => p.x === 2290);
  return play(w, debug, false, {
    route, ignoreHumans: !coven,
    waitAtGoal: (world, goal) => goal.platform === sealDeck && !world.keys,
    input: (world, input, goal) => {
      const p = world.player, h = world.hunt;
      if (goal.platform === sealDeck && p.groundId === sealDeck.id && !world.keys) {
        const beam = h.beam;
        const target = beam && Math.abs(beam.x - 2380) < 85 ? (beam.x >= 2380 ? 2310 : 2445) : 2380;
        const move = Math.abs(p.x - target) > 5 ? Math.sign(target - p.x) : 0;
        return { move, stun: !move && target === 2380 };
      }
      if (high && goal.platform?.bonus) {
        const target = goal.platform, current = world.level.platforms[p.groundId];
        const dx = target.x + target.w / 2 - p.x;
        if (p.grounded && current && target.id !== current.id && current.x + current.w - p.x < 28) return { move: 1, jump: true };
        if (!p.grounded && p.vy > -110 && p.vy < 100 && dx > 140 && h.blood && !h.cooldown) return { ...input, dash: true };
      }
      return input;
    },
  });
}
module.exports = { hunt };
if (require.main === module) for (const options of [{}, { coven: true }, { high: true }]) {
  const w = R.createWorld({ mode: 'bellkeeper' });
  console.log(options, hunt(w, { ...options, debug: true }), { allies: w.hunt.allies, blood: w.hunt.blood, dashes: w.hunt.totalDashes, alarm: w.hunt.alarm });
}
