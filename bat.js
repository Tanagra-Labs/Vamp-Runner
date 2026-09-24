/* The short sky crossing between nights, with a shared sunrise deadline. */
(function (root) {
  "use strict";
  const R = typeof module !== "undefined" && module.exports ? require("./rules") : root.VampRules;
  const RESIDENTS = [
    { name: "The light sleeper", concern: "My children are asleep. Not a sound.", promise: "quiet", choices: [["quiet", "I will be silent until I leave."],["company", "I can keep you company."],["guard", "I can watch over the street."]] },
    { name: "The herbalist", concern: "No one under this roof may be harmed.", promise: "peace", choices: [["guard", "I will chase away intruders."],["peace", "No harm will come from me."],["quiet", "You will hardly hear my wings."]] },
    { name: "The archivist", concern: "Those old books are irreplaceable.", promise: "books", choices: [["warmth", "I only need a warm corner."],["books", "Your books will stay untouched."],["company", "Let me tell you a story."]] },
    { name: "The lonely musician", concern: "Another night with nobody to hear me play.", promise: "listen", choices: [["quiet", "I will not make a sound."],["leave", "I can leave straight away."],["listen", "Let me stay and listen."]] },
    { name: "The wary caretaker", concern: "A visit, perhaps. You cannot live here.", promise: "leave", choices: [["leave", "Only a brief visit. I promise."],["guard", "I would make a fine guardian."],["warmth", "This seems a lovely place to nest."]] },
  ];
  function createFlight(data = {}) {
    const night = data.nightNumber || 2, level = R.buildLevel(night, data.seed ?? 1);
    const seed = (data.seed ?? 1) >>> 0, variant = (seed + night) % 3;
    const resident = RESIDENTS[(night - 2 + seed % RESIDENTS.length + RESIDENTS.length) % RESIDENTS.length];
    const choices = resident.choices.slice();
    for (let i = 0; i < variant; i++) choices.push(choices.shift());
    const width = 2180 + variant * 140;
    return {
      night, seed, level, profile: R.cleanProgress(data.profile), score: data.score || 0, lives: data.lives ?? 3,
      timeLeft: level.duration, elapsed: 0, status: "flying", reason: "", events: [],
      bat: { x: 65, y: 425, vy: 0 }, width,
      obstacles: [590, 1090, 1590].map((x, i) => ({ x, w: 70, center: 370 + ((i + variant) % 3) * 60, gap: night >= 7 ? 175 : 200 })),
      window: { x: width - 90, y: 350 + variant * 50 }, resident: { ...resident, choices },
      focus: 0, invitationLeft: 0, refusals: 0, invulnerable: 0,
    };
  }
  function calm(w) { return w.elapsed % 4.2 < 3; }
  function advance(w, seconds) {
    if (["dead", "invited"].includes(w.status) || !Number.isFinite(seconds) || seconds <= 0) return;
    const before = w.timeLeft;
    w.timeLeft = Math.max(0, w.timeLeft - seconds);
    for (const threshold of [60, 30, 10]) if (before > threshold && w.timeLeft <= threshold && w.timeLeft > 0) w.events.push({ kind: "dawn-warning", text: `${threshold} seconds until sunrise. Hurry!` });
    if (!w.timeLeft) { w.status = "dead"; w.reason = "Sunrise caught you outside."; w.events.push({ kind: "dead", text: w.reason }); }
  }
  function hit(w, obstacle) {
    if (w.invulnerable > 0 || w.status !== "flying") return;
    w.lives--; w.events.push({ kind: "hurt", text: "A coffin lost. Find the gap between the roofs." });
    if (w.lives <= 0) { w.status = "dead"; w.reason = "Your last coffin was lost over the rooftops."; return; }
    w.bat.x = obstacle ? obstacle.x - 170 : Math.max(65, w.bat.x - 120);
    w.bat.y = obstacle?.center ?? 425; w.bat.vy = 0; w.invulnerable = 1;
  }
  function step(w, input = {}, dt = R.STEP) {
    if (["dead", "invited"].includes(w.status)) return;
    dt = Math.max(0, Math.min(dt, 1 / 30)); w.elapsed += dt; advance(w, dt);
    if (w.status === "dead") return;
    if (w.status === "flying") {
      w.invulnerable = Math.max(0, w.invulnerable - dt);
      const b = w.bat;
      b.vy = Math.max(-170, Math.min(170, b.vy + (input.flap ? -800 : 650) * dt));
      b.y += (b.vy + Math.sin(w.elapsed * 1.3 + w.seed % 10) * 12) * dt;
      b.x = Math.min(w.window.x - 32, b.x + (165 + w.night % 3 * 8) * dt);
      const obstacle = w.obstacles.find(o => b.x + 15 > o.x && b.x - 15 < o.x + o.w && Math.abs(b.y - o.center) + 10 > o.gap / 2);
      if (obstacle || b.y < 235 || b.y > 622) hit(w, obstacle);
      if (w.status !== "dead" && b.x >= w.window.x - 32 && Math.abs(b.y - w.window.y) < 45) {
        w.status = "window"; b.y = w.window.y; b.vy = 0;
        w.events.push({ kind: "key", text: "You need an invitation to enter.\nWhen they're calm, hold Glamour (E)." });
      }
    } else {
      if (w.invitationLeft > 0) {
        w.invitationLeft = Math.max(0, w.invitationLeft - dt);
        if (!w.invitationLeft) { w.focus = 0; w.events.push({ kind: "focus-lost", text: "Their attention slipped. Glamour them again." }); }
      } else {
        w.focus = input.glamour && calm(w) ? Math.min(1.1, w.focus + dt) : 0;
        if (w.focus >= 1.1) { w.invitationLeft = 4; w.events.push({ kind: "stun", text: "You have their attention. Choose your promise." }); }
      }
    }
  }
  function choose(w, index) {
    if (w.status !== "window" || w.invitationLeft <= 0 || !w.resident.choices[index]) return false;
    if (w.resident.choices[index][0] === w.resident.promise) {
      w.status = "invited"; w.profile.dirt += 5; w.score += 200;
      w.events.push({ kind: "safe", text: "Come in, little one. · +5 dirt · +200 points" });
      return true;
    }
    w.refusals++; w.focus = 0; w.invitationLeft = 0; advance(w, 2);
    w.events.push({ kind: "focus-lost", text: "That isn't what I asked. · 2 seconds lost" });
    if (w.refusals >= 3 && w.status !== "dead") {
      w.lives--; w.refusals = 0;
      w.events.push({ kind: "hurt", text: "The shutters slam. One coffin lost; try the window again." });
      if (w.lives <= 0) { w.status = "dead"; w.reason = "No invitation. No coffins left."; }
    }
    return false;
  }
  const api = { RESIDENTS, createFlight, calm, advance, step, choose };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.VampBat = api;
})(typeof window !== "undefined" ? window : this);
