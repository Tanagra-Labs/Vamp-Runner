const B = require('../bat');
function fly(w, onStep = input => B.step(w, input)) {
  for (let i = 0; i < 120 * w.level.duration && !['dead', 'invited'].includes(w.status); i++) {
    const next = w.obstacles.find(o => o.x + o.w + 35 > w.bat.x);
    const target = next ? next.center : w.window.y;
    const flap = w.bat.y + w.bat.vy * 0.23 > target;
    onStep({ flap, glamour: B.calm(w) });
    if (w.invitationLeft > 0) B.choose(w, w.resident.choices.findIndex(c => c[0] === w.resident.promise));
  }
  return { status: w.status, lives: w.lives, elapsed: w.elapsed, timeLeft: w.timeLeft };
}
module.exports = { fly };
