/* Procedural district scores and event voices. No downloads or background timers. */
(function (root) {
  "use strict";
  const THEMES = {
    quarter: { root: 50, wave: "triangle", motif: [0, 7, 3, 10], beat: 0.22, echo: 0.09, space: 5 },
    roofs: { root: 57, wave: "sine", motif: [12, 7, 14, 3], beat: 0.3, echo: 0.13, space: 5.6 },
    gardens: { root: 52, wave: "triangle", motif: [0, 3, 7, 3], beat: 0.18, echo: 0.08, space: 4.8 },
    canals: { root: 55, wave: "sine", motif: [12, 0, 7, 15], beat: 0.34, echo: 0.22, space: 5.2 },
    market: { root: 60, wave: "triangle", motif: [0, 3, 10, 7], beat: 0.14, echo: 0.06, space: 4.4 },
    cathedral: { root: 50, wave: "sine", motif: [0, 12, 7, 3], beat: 0.4, echo: 0.3, space: 6, bell: true },
    catacombs: { root: 38, wave: "sine", motif: [0, 7, 3, -5], beat: 0.42, echo: 0.34, space: 5.8 },
    sewers: { root: 43, wave: "triangle", motif: [12, 0, 15, 7], beat: 0.28, echo: 0.27, space: 4.7 },
  };
  const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);
  const aliases = { dash: "jump", blood: "syringe", glamour: "stun", hit: "hurt" };
  function pattern(kind, themeKey = "quarter", variant = 0) {
    const theme = THEMES[themeKey] || THEMES.quarter;
    kind = aliases[kind] || kind;
    const offset = [0, 3, 7][variant % 3], base = theme.root;
    const note = (pitch, delay = 0, duration = 0.15, volume = 0.035, wave = theme.wave, glide = 0) => ({ frequency: hz(base + pitch), to: hz(base + pitch + glide), delay, duration, volume, wave, echo: theme.echo });
    switch (kind) {
      case "ambient": {
        const notes = theme.motif.map((pitch, i) => note(pitch, i * theme.beat, theme.bell ? 0.9 : 0.34, 0.009));
        if (theme.bell) notes.push(note(19, 0, 0.7, 0.004, "sine"));
        return notes;
      }
      case "jump": return [note(-5 + offset, 0, 0.11, 0.018, "sine", 9)];
      case "dirt": return [note(12 + offset, 0, 0.07, 0.024), note(19 + offset, 0.06, 0.09, 0.018)];
      case "syringe": return [note(3, 0, 0.12), note(7, 0.08, 0.18, 0.028)];
      case "iv": return [0, 7, 12, 19].map((p, i) => note(p, i * 0.07, 0.2, 0.028));
      case "key": return [12, 19, 24].map((p, i) => note(p, i * 0.1, 0.28, 0.03, "sine"));
      case "stun": return [note(3 + offset, 0, 0.3, 0.024, "sine", 12), note(10 + offset, 0.09, 0.25, 0.016)];
      case "focus": return [note(-5, 0, 0.35, 0.017, "sine", 5)];
      case "focus-lost": return [note(0, 0, 0.16, 0.02, "triangle", -5)];
      case "bite": return [note(-12, 0, 0.12, 0.04, "triangle", -7), note(7, 0.14, 0.22, 0.025)];
      case "veil": return [0, 3, 7, 12].map((p, i) => note(p, i * 0.09, 0.4, 0.025, "sine"));
      case "veil-blocked": return [note(24, 0, 0.24, 0.04, "sine", -12), note(7, 0.1, 0.3, 0.02)];
      case "hurt": return [note(-7, 0, 0.16, 0.04, "triangle", -12), note(-12, 0.06, 0.16, 0.025, "triangle")];
      case "gate-sealed": return [note(-12, 0, 0.25, 0.04, "triangle"), note(-5, 0.08, 0.18, 0.023)];
      case "dawn-warning": return [0, 0, -1].map((p, i) => note(p, i * 0.27, 0.25, 0.038, "triangle"));
      case "heartbeat": return [note(-12, 0, 0.1, 0.035, "sine"), note(-12, 0.16, 0.08, 0.022, "sine")];
      case "safe": return [0, 3, 7, 12].map((p, i) => note(p, i * 0.14, 0.45, 0.03));
      case "dead": return [7, 3, 0, -12].map((p, i) => note(p, i * 0.18, 0.38, 0.03, "triangle"));
      default: return [];
    }
  }
  function createSound({ enabled = () => false, contextFactory = () => new (root.AudioContext || root.webkitAudioContext)() } = {}) {
    let ctx, themeKey = "quarter", nextAmbient = 0, lastPulse = -1;
    const voices = new Set(), variants = new Map(), recent = new Map();
    function unlock() {
      if (!enabled()) return false;
      try {
        ctx ??= contextFactory();
        if (ctx.state === "suspended") ctx.resume().catch(() => {});
        return true;
      } catch { return false; }
    }
    function voice(note, delay, volume) {
      if (voices.size >= 32) return;
      const oscillator = ctx.createOscillator(), gain = ctx.createGain(), start = ctx.currentTime + note.delay + delay;
      oscillator.type = note.wave;
      oscillator.frequency.setValueAtTime(note.frequency, start);
      oscillator.frequency.exponentialRampToValueAtTime(note.to, start + note.duration);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(volume, start + 0.009);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + note.duration);
      oscillator.connect(gain); gain.connect(ctx.destination);
      const entry = { oscillator, gain };
      voices.add(entry);
      oscillator.onended = () => { voices.delete(entry); oscillator.disconnect(); gain.disconnect(); };
      oscillator.start(start); oscillator.stop(start + note.duration + 0.02);
    }
    function play(kind) {
      if (!unlock()) return;
      if (ctx.currentTime - (recent.get(kind) ?? -1) < 0.05) return;
      recent.set(kind, ctx.currentTime);
      const variant = variants.get(kind) || 0;
      variants.set(kind, variant + 1);
      try {
        for (const note of pattern(kind, themeKey, variant)) {
          voice(note, 0, note.volume);
          if (note.echo && kind !== "heartbeat") voice(note, note.echo, note.volume * 0.23);
        }
      } catch { /* Audio support never blocks gameplay. */ }
    }
    function stop() {
      for (const entry of voices) {
        try { entry.oscillator.stop(); entry.oscillator.disconnect(); entry.gain.disconnect(); } catch { /* Already ended. */ }
      }
      voices.clear(); recent.clear();
    }
    return {
      play, unlock, stop,
      setTheme(key) { stop(); themeKey = THEMES[key] ? key : "quarter"; nextAmbient = 0; lastPulse = -1; variants.clear(); },
      tick(elapsed, timeLeft) {
        if (!enabled()) return;
        if (timeLeft <= 10) {
          const second = Math.ceil(timeLeft);
          if (second !== lastPulse && second > 0) { lastPulse = second; play("heartbeat"); }
        } else if (elapsed >= nextAmbient) {
          play("ambient"); nextAmbient = elapsed + THEMES[themeKey].space * (timeLeft <= 30 ? 0.65 : 1);
        }
      },
    };
  }
  const api = { THEMES, pattern, createSound };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.VampAudio = api;
})(typeof window !== "undefined" ? window : this);
