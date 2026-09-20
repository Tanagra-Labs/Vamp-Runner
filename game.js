// Vamp Runner — a mobile vampire platformer. Phaser 3.60, no build step.
/* global Phaser, VampRules */
const {
  FLOOR, MAX_LIVES, STEP, UPGRADES, createWorld, step,
  cleanProgress, purchase, targetHuman, cleanScores,
} = VampRules;
const GAME_W = 390,
  GAME_H = 844;
const C = {
  ink: 0x0b1018,
  panel: 0x121c29,
  line: 0x334353,
  cream: 0xeee5d3,
  red: 0xd44d66,
  mint: 0x90d9bf,
  gold: 0xe3bb73,
  muted: 0x94a4b5,
};
const FONT = "Georgia, serif",
  MONO = "Courier New, monospace";

const Save = {
  read(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? fallback;
    } catch {
      return fallback;
    }
  },
  write(key, value) {
    if (key === "vampRunnerProgress") this.sessionProgress = cleanProgress(value);
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },
  scores() {
    return cleanScores(this.read("vampRunnerScores", []));
  },
  progress() {
    return cleanProgress(this.sessionProgress ?? this.read("vampRunnerProgress", {}));
  },
  settings() {
    const saved = this.read("vampRunnerSettings", {});
    return {
      sound: saved?.sound === true,
      reducedMotion:
        typeof saved?.reducedMotion === "boolean"
          ? saved.reducedMotion
          : !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
    };
  },
};
let preferences = Save.settings();
const Sfx = {
  ctx: null,
  play(kind) {
    if (!preferences.sound) return;
    try {
      this.ctx ??= new (window.AudioContext || window.webkitAudioContext)();
      if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
      const notes = {
        dash: [240, 90],
        blood: [420, 680],
        glamour: [300, 600],
        hit: [140, 65],
        safe: [440, 660, 880],
      }[kind] || [440];
      notes.forEach((frequency, i) => {
        const oscillator = this.ctx.createOscillator(),
          gain = this.ctx.createGain();
        const t = this.ctx.currentTime + i * 0.06;
        oscillator.type = kind === "hit" ? "triangle" : "sine";
        oscillator.frequency.setValueAtTime(frequency, t);
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.045, t + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
        oscillator.connect(gain);
        gain.connect(this.ctx.destination);
        oscillator.start(t);
        oscillator.stop(t + 0.18);
      });
    } catch {
      /* Audio support never blocks a run. */
    }
  },
};

function label(scene, x, y, text, size = 14, color = "#eee5d3", mono = false) {
  return scene.add.text(x, y, text, {
    fontFamily: mono ? MONO : FONT,
    fontSize: size + "px",
    color,
  });
}
function button(scene, x, y, width, text, callback, primary = false) {
  const bg = scene.add
    .rectangle(x, y, width, 48, primary ? C.red : C.panel)
    .setStrokeStyle(1, primary ? C.red : C.line)
    .setScrollFactor(0)
    .setInteractive({ useHandCursor: true });
  const caption = label(
    scene,
    x,
    y,
    text,
    13,
    primary ? "#ffffff" : "#eee5d3",
    true,
  ).setOrigin(0.5).setScrollFactor(0);
  bg.on("pointerover", () => bg.setFillStyle(primary ? 0xe15d75 : 0x263344));
  bg.on("pointerout", () => bg.setFillStyle(primary ? C.red : C.panel));
  bg.on("pointerdown", (pointer, lx, ly, event) => {
    event?.stopPropagation();
    callback();
  });
  return { bg, caption };
}
function onKey(scene, event, callback) {
  scene.input.keyboard.on(event, callback);
  scene.events.once("shutdown", () => scene.input.keyboard.off(event, callback));
}
function vignette(scene) {
  const g = scene.add.graphics();
  g.fillStyle(C.ink);
  g.fillRect(0, 0, GAME_W, GAME_H);
  for (let i = 5; i > 0; i--) {
    g.fillStyle(0x243149, 0.07);
    g.fillCircle(285, 180, 50 + i * 22);
  }
  g.fillStyle(0xc9cebd);
  g.fillCircle(285, 175, 37);
  g.fillStyle(0x131c29);
  g.fillCircle(299, 165, 32);
  for (let i = 0; i < 45; i++) {
    g.fillStyle(C.cream, ((i % 3) + 1) / 7);
    g.fillRect((i * 83 + 11) % GAME_W, (i * 47 + 17) % 330, 1, 1);
  }
  for (let i = 0; i < 12; i++) {
    const x = i * 36 - 10,
      h = 40 + ((i * 37) % 90);
    g.fillStyle(0x101822);
    g.fillRect(x, 367 - h, 32, h);
    g.fillTriangle(x - 2, 367 - h, x + 16, 347 - h, x + 34, 367 - h);
    g.fillStyle(C.gold, 0.25);
    g.fillRect(x + 14, 381 - h, 4, 10);
  }
  g.lineStyle(1, C.line, 0.5);
  g.lineBetween(24, 367, 366, 367);
}

class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }
  create() {
    document.getElementById("loading")?.remove();
    this.makeTextures();
    this.scene.start("Menu");
  }
  makeTextures() {
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    const texture = (name, draw, w = 40, h = 40) => {
      g.clear();
      draw();
      g.generateTexture(name, w, h);
    };
    texture("floor", () => {
      g.fillStyle(0x1b2933);
      g.fillRect(0, 0, 40, 40);
      [
        [1, 1, 18, 10],
        [21, 1, 18, 10],
        [1, 13, 9, 12],
        [12, 13, 27, 12],
        [1, 27, 22, 12],
        [25, 27, 14, 12],
      ].forEach(([x, y, w, h], i) => {
        g.fillStyle(i % 2 ? 0x202f38 : 0x22313a);
        g.fillRoundedRect(x, y, w, h, 2);
        g.lineStyle(1, 0x34404a, 0.45);
        g.lineBetween(x + 2, y + 1, x + w - 2, y + 1);
      });
    });
    texture("wall", () => {
      g.fillStyle(0x080e15);
      g.fillRect(0, 0, 40, 40);
      g.fillStyle(0x324250);
      g.fillRect(0, 0, 40, 33);
      g.fillStyle(0x283743);
      g.fillRect(2, 3, 36, 27);
      g.lineStyle(1, 0x546272, 0.6);
      g.lineBetween(0, 1, 40, 1);
      g.lineStyle(1, 0x1a2531);
      g.lineBetween(0, 14, 40, 14);
      g.lineBetween(20, 0, 20, 14);
      g.lineBetween(10, 14, 10, 30);
      g.fillStyle(0x151e2b);
      g.fillRoundedRect(23, 7, 10, 18, 5);
      g.fillStyle(C.gold, 0.8);
      g.fillRect(26, 10, 4, 10);
      g.fillStyle(0x283743);
      g.fillRect(25, 15, 6, 2);
      g.fillStyle(0x050a10, 0.7);
      g.fillRect(0, 33, 40, 7);
    });
    texture("syringe", () => {
      g.fillStyle(C.red, 0.09);
      g.fillCircle(20, 20, 19);
      g.lineStyle(1, C.red, 0.25);
      g.strokeCircle(20, 20, 15);
      g.fillStyle(0xe5dccc);
      g.fillRect(14, 9, 12, 3);
      g.fillRect(18, 6, 4, 5);
      g.fillStyle(0x718594);
      g.fillRect(16, 13, 8, 15);
      g.fillStyle(0xf08c99);
      g.fillRect(18, 15, 4, 9);
      g.fillStyle(0xe5dccc);
      g.fillRect(19, 28, 2, 6);
    });
    texture("dirt", () => {
      g.fillStyle(C.gold, 0.13); g.fillCircle(20, 20, 18);
      g.fillStyle(0x91755c); g.fillTriangle(4, 29, 19, 14, 36, 29);
      g.fillStyle(0xd6b782); g.fillTriangle(10, 27, 19, 17, 27, 27);
      g.fillStyle(0x6b605c); g.fillRoundedRect(16, 7, 9, 12, 4);
      g.fillStyle(C.cream); g.fillRect(30, 9, 2, 6); g.fillRect(28, 11, 6, 2);
    });
    texture("iv", () => {
      g.fillStyle(C.red, 0.16); g.fillCircle(20, 20, 19);
      g.lineStyle(2, 0xc8d9df); g.strokeRoundedRect(10, 5, 20, 25, 4);
      g.fillStyle(C.red); g.fillRoundedRect(13, 14, 14, 13, 2);
      g.lineStyle(2, 0xc8d9df); g.lineBetween(20, 30, 20, 36); g.lineBetween(20, 36, 28, 36);
      g.fillStyle(C.cream); g.fillRect(18, 2, 4, 4); g.fillRect(18, 17, 4, 8); g.fillRect(16, 19, 8, 4);
    });
    texture("garlic", () => {
      g.fillStyle(0xe7dbc1); g.fillEllipse(20, 25, 25, 23);
      g.fillStyle(0xc5b99e); g.fillEllipse(12, 26, 8, 16); g.fillEllipse(28, 26, 8, 16);
      g.fillStyle(0xf6ecd4); g.fillEllipse(20, 25, 8, 20);
      g.fillStyle(0x91a578); g.fillTriangle(16, 16, 19, 3, 23, 16);
    });
    texture("cross", () => {
      g.fillStyle(C.gold, 0.12); g.fillCircle(20, 20, 19);
      g.fillStyle(0xb28d5f); g.fillRect(14, 2, 12, 36); g.fillRect(4, 11, 32, 11);
      g.fillStyle(0xf6d899); g.fillRect(17, 4, 6, 32); g.fillRect(6, 14, 28, 5);
    });
    texture("shelter", () => {
      g.fillStyle(C.mint, 0.12);
      g.fillCircle(20, 20, 20);
      g.fillStyle(0x071510);
      g.fillPoints(
        [
          { x: 12, y: 3 },
          { x: 28, y: 3 },
          { x: 34, y: 13 },
          { x: 29, y: 37 },
          { x: 11, y: 37 },
          { x: 6, y: 13 },
        ],
        true,
      );
      g.lineStyle(2, C.mint);
      g.strokePoints(
        [
          { x: 12, y: 3 },
          { x: 28, y: 3 },
          { x: 34, y: 13 },
          { x: 29, y: 37 },
          { x: 11, y: 37 },
          { x: 6, y: 13 },
        ],
        true,
      );
      g.lineStyle(1, 0x477567);
      g.strokeRect(14, 10, 12, 20);
      g.fillStyle(C.gold);
      g.fillCircle(23, 21, 1.5);
    });
    const person = (name, robe, emblem, step = false) =>
      texture(
        name,
        () => {
          g.fillStyle(0x000000, 0.25);
          g.fillEllipse(16, 29, 27, 6);
          g.fillStyle(0x101322);
          g.fillRect(step ? 9 : 10, 25, 5, 6);
          g.fillRect(step ? 20 : 18, 25, 5, 6);
          g.fillStyle(robe);
          g.fillTriangle(16, 10, 3, 28, 29, 28);
          g.fillRect(10, 14, 12, 12);
          g.fillStyle(0xf0d8c5);
          g.fillCircle(16, 9, 6);
          g.fillStyle(0x171521);
          g.fillRect(10, 3, 12, 4);
          g.fillRect(10, 6, 2, 4);
          g.fillStyle(0x11121b);
          g.fillRect(13, 9, 2, 2);
          g.fillRect(18, 9, 2, 2);
          if (emblem === "vampire") {
            g.fillStyle(0xf27688);
            g.fillTriangle(4, 16, 12, 18, 9, 24);
            g.fillTriangle(28, 16, 20, 18, 23, 24);
            g.fillStyle(0xffffff);
            g.fillRect(13, 13, 1, 2);
            g.fillRect(18, 13, 1, 2);
          } else if (emblem === "cross") {
            g.fillStyle(C.gold);
            g.fillRect(25, 12, 3, 16);
            g.fillRect(21, 16, 11, 3);
            g.fillStyle(0xffffff);
            g.fillRect(14, 16, 4, 2);
          } else if (emblem === "garlic") {
            g.fillStyle(0xe6dfba);
            g.fillCircle(26, 22, 5);
            g.fillStyle(0x90b776);
            g.fillRect(25, 15, 2, 4);
          } else if (emblem === "ally") {
            g.lineStyle(1, C.mint, 0.8);
            g.strokeCircle(16, 15, 15);
            g.fillStyle(C.mint);
            g.fillRect(13, 9, 2, 2);
            g.fillRect(18, 9, 2, 2);
          }
        },
        32,
        34,
      );
    person("player", 0x93344e, "vampire");
    person("player_step", 0x93344e, "vampire", true);
    person("npc_priest", 0x171722, "cross");
    person("npc_garlic", 0x716344, "garlic");
    person("npc_plain", 0x496780, "plain");
    person("npc_glamoured", 0x477d73, "ally");
    g.destroy();
  }
}

class MenuScene extends Phaser.Scene {
  constructor() {
    super("Menu");
  }
  create() {
    vignette(this);
    label(this, 24, 32, "TANAGRA LABS  /  AFTER HOURS", 10, "#a7b7c3", true);
    label(this, 24, 103, "VAMP", 67);
    label(this, 24, 173, "RUNNER", 58);
    label(
      this,
      26,
      256,
      "The city is waking. You shouldn’t be.",
      16,
      "#afbec9",
    );
    label(this, 26, 313, "THREE COFFINS. ONE MORE NIGHT.", 10, "#dfb778", true);
    label(this, 24, 395, "Make it home before dawn.", 24);
    label(
      this,
      24,
      435,
      "Jump through the city. Stun, then bite.\nThree garlic hits or one cross: lose a coffin.",
      14,
      "#afbec9",
    ).setLineSpacing(6);
    const rows = [
      ["01", "RUN & JUMP", "← → / A D / Q D. Space to jump."],
      ["02", "STUN → BITE", "E to stun. Get close. F to turn them."],
      ["03", "BLOOD & GRAVE DIRT", "IV gives power. Dirt buys upgrades."],
    ];
    rows.forEach(([num, title, copy], i) => {
      const y = 500 + i * 54;
      label(this, 24, y, num, 11, "#bd7485", true);
      label(this, 57, y, title, 11, "#eee5d3", true);
      label(this, 57, y + 19, copy, 12, "#a5b5c4");
    });
    button(
      this,
      195,
      696,
      342,
      "ENTER THE NIGHT  →",
      () => this.startRun(),
      true,
    );
    const best = Save.scores()[0];
    label(
      this,
      195,
      734,
      best
        ? "PERSONAL BEST  " + best.score.toLocaleString()
        : "Your legend starts tonight.",
      11,
      "#9cabb8",
      true,
    ).setOrigin(0.5);
    this.soundButton = button(this, 105, 783, 158, "", () =>
      this.toggleSound(),
    );
    this.motionButton = button(this, 280, 783, 166, "", () =>
      this.toggleMotion(),
    );
    this.refreshSettings();
    this.starting = false;
    onKey(this, "keydown-ENTER", () => this.startRun());
    onKey(this, "keydown-SPACE", () => this.startRun());
    announce(
      "Vamp Runner. Reach the crypt before sunrise. Press Enter to start.",
    );
  }
  refreshSettings() {
    this.soundButton.caption.setText(
      "SOUND " + (preferences.sound ? "ON" : "OFF"),
    );
    this.motionButton.caption.setText(
      "MOTION " + (preferences.reducedMotion ? "REDUCED" : "FULL"),
    );
  }
  toggleSound() {
    preferences.sound = !preferences.sound;
    Save.write("vampRunnerSettings", preferences);
    this.refreshSettings();
    Sfx.play("blood");
  }
  toggleMotion() {
    preferences.reducedMotion = !preferences.reducedMotion;
    Save.write("vampRunnerSettings", preferences);
    this.refreshSettings();
  }
  startRun() {
    if (this.starting) return;
    this.starting = true;
    Sfx.play("glamour");
    this.scene.start("Game", { profile: Save.progress() });
  }
}

class GameScene extends Phaser.Scene {
  constructor() { super("Game"); }
  init(data = {}) { this.runData = data; }
  create() {
    // Phaser reuses scene instances. Reset every piece of transient state.
    this.world = createWorld({ ...this.runData, profile: this.runData.profile ?? Save.progress() });
    this.paused = false;
    this.transitioning = false;
    this.pending = {};
    this.held = new Map();
    this.accumulator = 0;
    this.messageUntil = 0;
    this.pauseObjects = [];
    this.time.paused = false;
    this.tweens.resumeAll();
    this.cameras.main.setBounds(0, 0, this.world.level.width, GAME_H);
    this.cameras.main.setScroll(0, 0);
    this.drawCity();
    this.drawLevel();
    this.player = this.add.image(80, FLOOR, "player").setOrigin(0.5, 1).setDisplaySize(44, 47).setDepth(10);
    this.targetGraphic = this.add.graphics().setDepth(11);
    this.buildHUD();
    this.buildControls();
    this.onBlur = () => this.pauseGame();
    this.onVisibility = () => { if (document.hidden) this.pauseGame(); };
    window.addEventListener("blur", this.onBlur);
    document.addEventListener("visibilitychange", this.onVisibility);
    this.events.once("shutdown", () => {
      window.removeEventListener("blur", this.onBlur);
      document.removeEventListener("visibilitychange", this.onVisibility);
      this.resetInput();
    });
    this.renderWorld();
    announce(`Night ${this.world.night}. Jump through the city to the crypt before sunrise. Stun humans, then bite.`);
  }
  fixed(object, depth = 50) { return object.setScrollFactor(0).setDepth(depth); }
  drawCity() {
    const sky = this.fixed(this.add.graphics(), -10);
    sky.fillGradientStyle(0x101322, 0x101322, 0x493441, 0x493441, 1);
    sky.fillRect(0, 0, GAME_W, GAME_H);
    for (let i = 0; i < 40; i++) {
      sky.fillStyle(C.cream, 0.25 + (i % 4) * 0.1);
      sky.fillRect((i * 83 + 17) % GAME_W, 170 + (i * 39) % 270, 1, 1);
    }
    sky.fillStyle(0xd9d4bf); sky.fillCircle(284, 250, 33);
    sky.fillStyle(0x1b1b2b); sky.fillCircle(296, 240, 30);
    this.dawn = this.fixed(this.add.rectangle(195, 422, 390, 844, 0xf5a568, 0), -8);
    for (let layer = 0; layer < 2; layer++) {
      const g = this.add.graphics().setScrollFactor(layer ? 0.45 : 0.2).setDepth(-6 + layer);
      for (let i = 0; i < 35; i++) {
        const x = i * 86, h = 80 + ((i * 37 + layer * 47) % 170), y = FLOOR - h;
        g.fillStyle(layer ? 0x1b2630 : 0x252b3b);
        g.fillRect(x, y, 80, h + 10);
        g.fillTriangle(x - 5, y, x + 40, y - 28, x + 85, y);
        g.fillStyle(C.gold, layer ? 0.25 : 0.1);
        for (let row = 0; row < Math.floor(h / 35); row++) {
          g.fillRect(x + 19, y + 18 + row * 35, 8, 13);
          g.fillRect(x + 53, y + 18 + row * 35, 8, 13);
        }
      }
    }
  }
  drawLevel() {
    const level = this.world.level, g = this.add.graphics().setDepth(1);
    for (const p of level.platforms) {
      g.fillStyle(p.ground ? 0x263340 : 0x18232e);
      g.fillRect(p.x, p.y, p.w, p.ground ? 120 : FLOOR - p.y);
      g.fillStyle(p.ground ? 0x78918f : 0x9b8691);
      g.fillRect(p.x, p.y, p.w, 4);
      g.lineStyle(1, 0x43525b, 0.45);
      for (let x = p.x + 12; x < p.x + p.w - 10; x += 32) {
        if (p.ground) g.lineBetween(x, p.y + 8, x + 8, p.y + 8);
        else {
          g.fillStyle(C.gold, 0.18);
          g.fillRoundedRect(x, p.y + 24, 13, 24, 6);
        }
      }
    }
    for (const gap of level.gaps) {
      g.fillStyle(C.red, 0.4); g.fillRect(gap.x - 8, FLOOR, 8, 5); g.fillRect(gap.x + gap.width, FLOOR, 8, 5);
      label(this, gap.x + gap.width / 2, FLOOR + 37, "↓", 17, "#c9758a").setOrigin(0.5);
    }
    const crypt = level.crypt;
    g.fillStyle(0x35464b); g.fillRect(crypt.x - 60, FLOOR - 108, 120, 108);
    g.fillStyle(0x61746d); g.fillTriangle(crypt.x - 72, FLOOR - 108, crypt.x, FLOOR - 153, crypt.x + 72, FLOOR - 108);
    g.fillStyle(0x091c19); g.fillRoundedRect(crypt.x - 34, FLOOR - 92, 68, 92, 30);
    this.add.image(crypt.x, FLOOR - 40, "shelter").setDisplaySize(55, 72).setDepth(2);
    label(this, crypt.x, FLOOR - 174, "YOUR CRYPT", 13, "#90d9bf", true).setOrigin(0.5);
    this.pickups = level.pickups.map((p) => this.add.image(p.x, p.y, p.kind).setDepth(5).setDisplaySize(p.kind === "dirt" ? 27 : 34, p.kind === "dirt" ? 27 : 34));
    level.hazards.forEach((h) => this.add.image(h.x, h.y, h.kind).setDepth(6).setDisplaySize(36, 40));
    this.humans = level.humans.map((h) => this.add.image(h.x, h.y + h.h, "npc_plain").setOrigin(0.5, 1).setDisplaySize(38, 42).setDepth(7));
    label(this, 420, 393, "ROOFTOP ALLEY", 12, "#dbb77e", true).setOrigin(0.5);
    label(this, 420, 413, "More dirt. Less time.", 13, "#bec5cd").setOrigin(0.5);
  }
  buildHUD() {
    this.fixed(this.add.rectangle(195, 72, 390, 144, C.ink, 0.97));
    this.fixed(label(this, 20, 19, `NIGHT ${String(this.world.night).padStart(2, "0")}`, 13, "#dfb778", true));
    this.clock = this.fixed(label(this, 370, 18, "", 18, "#eee5d3", true).setOrigin(1, 0));
    this.fixed(this.add.rectangle(20, 54, 350, 4, C.line).setOrigin(0, 0.5));
    this.sunBar = this.fixed(this.add.rectangle(20, 54, 350, 4, C.gold).setOrigin(0, 0.5));
    this.fixed(label(this, 20, 68, "COFFINS", 10, "#a9bac8", true));
    this.coffins = [0, 1, 2].map((i) => this.fixed(this.add.image(30 + i * 29, 101, "shelter").setDisplaySize(23, 28)));
    this.fixed(label(this, 129, 68, "GARLIC HITS", 10, "#a9bac8", true));
    this.garlic = [0, 1, 2].map((i) => this.fixed(this.add.circle(141 + i * 23, 100, 6, C.line)));
    this.wallet = this.fixed(label(this, 370, 69, "", 13, "#dfb778", true).setOrigin(1, 0));
    this.scoreText = this.fixed(label(this, 370, 96, "", 13, "#eee5d3", true).setOrigin(1, 0));
    this.routeText = this.fixed(label(this, 20, 126, "", 11, "#a9bac8", true));
    this.message = this.fixed(label(this, 195, 219, "", 15, "#eee5d3").setOrigin(0.5).setWordWrapWidth(350).setAlign("center"));
    const pause = this.fixed(this.add.rectangle(351, 174, 48, 48, C.ink, 0.9).setStrokeStyle(1, C.line).setInteractive());
    this.fixed(label(this, 351, 174, "Ⅱ", 21).setOrigin(0.5));
    pause.on("pointerdown", (_p, _x, _y, event) => { event?.stopPropagation(); this.pauseGame(); });
    this.fixed(this.add.rectangle(195, 758, 390, 172, C.ink, 0.98));
    this.hint = this.fixed(label(this, 195, 687, "", 12, "#c4b28d", true).setOrigin(0.5));
  }
  buildControls() {
    this.keys = this.input.keyboard.addKeys("LEFT,RIGHT,A,D,Q");
    onKey(this, "keydown", (e) => {
      if (e.repeat) return;
      if (["Escape", "KeyP"].includes(e.code)) { this.paused ? this.resumeGame() : this.pauseGame(); return; }
      if (this.paused || this.transitioning) return;
      if (["Space", "ArrowUp", "KeyW", "KeyZ"].includes(e.code)) { e.preventDefault?.(); this.pending.jump = true; }
      if (["KeyE", "KeyJ"].includes(e.code)) this.pending.stun = true;
      if (["KeyF", "KeyK"].includes(e.code)) this.pending.bite = true;
    });
    this.input.keyboard.addCapture?.(["SPACE", "UP", "LEFT", "RIGHT"]);
    this.moveButtons = [];
    for (const [x, direction, title] of [[49, -1, "←"], [124, 1, "→"]]) {
      const bg = this.fixed(this.add.rectangle(x, 774, 66, 90, C.panel).setStrokeStyle(1, C.line).setInteractive());
      this.fixed(label(this, x, 770, title, 31).setOrigin(0.5));
      this.moveButtons.push({ bg, direction });
      bg.on("pointerdown", (pointer, _x, _y, event) => {
        event?.stopPropagation();
        if (!this.paused && !this.transitioning) this.held.set(pointer.id, direction);
      });
      bg.on("pointerout", (pointer) => this.held.delete(pointer.id));
    }
    const release = (pointer) => this.held.delete(pointer.id);
    this.input.on("pointerup", release);
    this.input.on("pointerupoutside", release);
    this.input.on("gameout", () => this.held.clear());
    this.stunButton = button(this, 223, 737, 92, "STUN · E", () => { if (!this.paused) this.pending.stun = true; });
    this.biteButton = button(this, 329, 737, 92, "BITE · F", () => { if (!this.paused) this.pending.bite = true; });
    this.jumpButton = button(this, 276, 798, 198, "JUMP ↑", () => { if (!this.paused) this.pending.jump = true; }, true);
    for (const item of [this.stunButton, this.biteButton, this.jumpButton]) { this.fixed(item.bg); this.fixed(item.caption); }
    this.events.once("shutdown", () => this.input.removeAllListeners());
  }
  resetInput() { this.held?.clear(); this.pending = {}; this.input.keyboard.resetKeys(); }
  pauseGame() {
    if (this.paused || this.transitioning || this.world.status !== "playing") return;
    this.paused = true;
    this.resetInput();
    const add = (o) => { this.pauseObjects.push(this.fixed(o, 90)); return o; };
    const dim = add(this.add.rectangle(195, 422, 390, 844, C.ink, 0.97).setInteractive());
    dim.on("pointerdown", (_p, _x, _y, e) => e?.stopPropagation());
    add(label(this, 195, 228, "THE NIGHT CAN WAIT.", 27).setOrigin(0.5));
    add(label(this, 195, 285, "Move  ← → / A D / Q D\nJump  Space / ↑ / W / Z\nStun  E     ·     Bite  F\nPause  Escape / P", 16, "#acbdc9", true).setOrigin(0.5, 0).setLineSpacing(14));
    add(label(this, 195, 461, "IV blood protects you.\nGrave dirt buys permanent upgrades.", 15, "#dfb778").setOrigin(0.5).setAlign("center").setLineSpacing(8));
    const resume = button(this, 195, 564, 330, "RESUME THE NIGHT", () => this.resumeGame(), true);
    const end = button(this, 195, 628, 330, "END RUN", () => this.finishRun("You returned to the shadows."));
    [resume.bg, resume.caption, end.bg, end.caption].forEach(add);
    announce("Paused. Escape or Resume continues the night.");
  }
  resumeGame() {
    if (!this.paused || this.transitioning) return;
    this.pauseObjects.forEach((o) => o.destroy()); this.pauseObjects = [];
    this.resetInput(); this.accumulator = 0; this.paused = false;
    announce("Resumed.");
  }
  saveProgress() {
    this.progressSaved = Save.write("vampRunnerProgress", this.world.profile);
    if (!this.progressSaved) announce("Upgrades and grave dirt last for this session; browser storage is unavailable.");
  }
  runSnapshot() {
    const w = this.world;
    return { nightNumber: w.night, score: w.score, lives: w.lives, profile: w.profile, stats: w.stats, timeLeft: w.timeLeft, bonus: w.bonus };
  }
  completeNight() {
    if (this.transitioning || this.world.status !== "safe") return;
    this.transitioning = true; this.resetInput(); this.saveProgress();
    this.scene.start("Crypt", this.runSnapshot());
  }
  finishRun(reason = this.world.reason) {
    if (this.transitioning) return;
    this.transitioning = true; this.resetInput(); this.saveProgress();
    this.scene.start("Score", { score: this.world.score, nights: this.world.night - 1, reason, profile: this.world.profile });
  }
  showSunrise() {
    if (this.transitioning) return;
    this.transitioning = true; this.resetInput(); this.saveProgress();
    const glow = this.fixed(this.add.rectangle(195, 422, 390, 844, 0xf2b575, 0.65), 80);
    this.fixed(label(this, 195, 365, "SUNRISE", 45, "#271d25").setOrigin(0.5), 81);
    this.fixed(label(this, 195, 417, "The night is over.", 20, "#271d25").setOrigin(0.5), 81);
    if (!preferences.reducedMotion) this.tweens.add({ targets: glow, alpha: 0.94, duration: 900 });
    this.time.delayedCall(preferences.reducedMotion ? 450 : 1200, () => {
      this.scene.start("Score", { score: this.world.score, nights: this.world.night - 1, reason: this.world.reason, profile: this.world.profile });
    });
  }
  showEvents() {
    for (const event of this.world.events.splice(0)) {
      if (event.kind === "jump") { Sfx.play("dash"); continue; }
      if (event.text) { this.message.setText(event.text); this.messageUntil = this.world.elapsed + 2; }
      if (event.kind === "dirt") this.saveProgress();
      Sfx.play(event.kind === "hurt" || event.kind === "dead" ? "hit" : event.kind === "safe" ? "safe" : "blood");
      if (event.kind === "hurt" && !preferences.reducedMotion) this.cameras.main.shake(110, 0.004);
      if (["bite", "iv", "hurt"].includes(event.kind)) announce(event.text);
    }
  }
  renderWorld() {
    const w = this.world, p = w.player;
    this.player.setPosition(p.x, p.y + p.h).setFlipX(p.facing < 0);
    this.player.setTexture(Math.abs(p.vx) > 10 && p.grounded && Math.floor(w.elapsed * 9) % 2 ? "player_step" : "player");
    this.player.setAlpha(w.invulnerable > 0 ? (preferences.reducedMotion ? 0.6 : Math.floor(w.elapsed * 12) % 2 ? 0.35 : 1) : 1);
    if (w.iv > 0) this.player.setTint(0xf6bbcd); else this.player.clearTint();
    this.cameras.main.scrollX = Math.max(0, Math.min(w.level.width - GAME_W, p.x - 125));
    this.cameras.main.scrollY = 0;
    this.dawn.setAlpha(Math.max(0, 1 - w.timeLeft / 32) * 0.6);
    this.clock.setText(`${Math.ceil(w.timeLeft)}s TO DAWN`).setColor(w.timeLeft <= 15 ? "#ffb777" : "#eee5d3");
    this.sunBar.setScale(Math.max(0, w.timeLeft / w.level.duration), 1);
    this.coffins.forEach((o, i) => o.setAlpha(i < w.lives ? 1 : 0.18));
    this.garlic.forEach((o, i) => o.setFillStyle(i < w.garlicHits ? C.red : C.line));
    this.wallet.setText(`${w.profile.dirt} GRAVE DIRT`);
    this.scoreText.setText(`${w.score.toLocaleString()} PTS`);
    this.routeText.setText(w.iv > 0 ? `IV RUSH ${w.iv.toFixed(1)}s · PROTECTED` : `${w.level.name}   ·   CRYPT ${Math.max(0, Math.ceil((w.level.crypt.x - p.x) / 10))}m →`);
    this.message.setAlpha(w.elapsed < this.messageUntil ? 1 : 0);
    w.level.pickups.forEach((pickup, i) => {
      const sprite = this.pickups[i];
      sprite.setVisible(pickup.active);
      sprite.y = pickup.y + (preferences.reducedMotion ? 0 : Math.sin(w.elapsed * 3 + i) * 3);
    });
    this.targetGraphic.clear();
    w.level.humans.forEach((h, i) => {
      const sprite = this.humans[i];
      sprite.setPosition(h.x, h.y + h.h).setFlipX(h.direction < 0).setTexture(h.state === "vampire" ? "npc_glamoured" : "npc_plain");
      if (h.state === "stunned") {
        this.targetGraphic.lineStyle(2, C.gold, 0.8); this.targetGraphic.strokeEllipse(h.x, h.y - 9, 28, 9);
      }
    });
    const nearby = targetHuman(w), biteTarget = targetHuman(w, 52, true);
    this.hint.setText(biteTarget ? "STUNNED · BITE NOW +250" : nearby?.state === "stunned" ? "GET CLOSER TO BITE" : nearby ? "STUN THE HUMAN → THEN BITE" : p.x < 300 ? "JUMP UP TO ROOFTOPS FOR MORE DIRT" : "REACH YOUR CRYPT BEFORE SUNRISE →");
    this.stunButton.bg.setAlpha(nearby && nearby.state !== "stunned" && w.stunCooldown === 0 ? 1 : 0.5);
    this.biteButton.bg.setAlpha(biteTarget ? 1 : 0.5);
    this.moveButtons.forEach(({ bg, direction }) => bg.setFillStyle([...this.held.values()].includes(direction) ? 0x384756 : C.panel));
  }
  update(_time, delta) {
    if (this.paused || this.transitioning) return;
    const key = (name) => this.keys[name]?.isDown;
    const move = Math.max(-1, Math.min(1, (key("RIGHT") || key("D") ? 1 : 0) - (key("LEFT") || key("A") || key("Q") ? 1 : 0) + [...this.held.values()].reduce((a, b) => a + b, 0)));
    this.accumulator += Math.min(delta / 1000, 0.05);
    while (this.accumulator >= STEP) {
      step(this.world, { move, ...this.pending }, STEP);
      this.pending = {}; this.accumulator -= STEP;
    }
    this.showEvents(); this.renderWorld();
    if (this.world.status === "safe") this.completeNight();
    else if (this.world.status === "dead") this.showSunrise();
  }
}

// Menus own an unscrolled camera. No gameplay container can offset their hit areas.
class CryptScene extends Phaser.Scene {
  constructor() { super("Crypt"); }
  init(data = {}) {
    this.run = { ...data, profile: cleanProgress(data.profile) };
    this.transitioning = false;
    this.storageOK = true;
  }
  create() {
    this.cameras.main.setScroll(0, 0);
    vignette(this);
    label(this, 24, 31, "SAFE UNTIL THE NEXT SUNSET", 11, "#90d9bf", true);
    label(this, 24, 90, `NIGHT ${String(this.run.nightNumber).padStart(2, "0")} SURVIVED.`, 28);
    label(this, 24, 137, "Rest. Grow stronger. Run again.", 17, "#acbdc9");
    label(this, 24, 190, this.run.score.toLocaleString(), 39);
    label(this, 25, 236, "RUN SCORE", 11, "#acbdc9", true);
    this.balance = label(this, 365, 196, "", 27, "#dfb778").setOrigin(1, 0);
    label(this, 365, 235, "GRAVE DIRT", 11, "#acbdc9", true).setOrigin(1, 0);
    label(this, 24, 281, `${this.run.stats?.turned || 0} humans turned   ·   ${Math.ceil(this.run.timeLeft)}s spared`, 13, "#acbdc9");
    label(this, 24, 324, "PERMANENT UPGRADES", 11, "#dfb778", true);
    this.shop = UPGRADES.map((upgrade, i) => {
      const y = 365 + i * 85;
      const name = label(this, 24, y, "", 19);
      label(this, 24, y + 29, upgrade.detail, 12, "#a9bac8").setWordWrapWidth(205);
      const buy = button(this, 302, y + 19, 127, "", () => this.buy(upgrade.key));
      return { upgrade, name, buy };
    });
    this.restore = button(this, 195, 640, 342, "", () => this.restoreCoffin());
    this.saveNote = label(this, 195, 678, "", 11, "#a9bac8").setOrigin(0.5);
    this.next = button(this, 195, 724, 342, "NEXT NIGHT →", () => this.nextNight(), true);
    button(this, 195, 788, 342, "END RUN & RECORD SCORE", () => this.endRun());
    onKey(this, "keydown-ENTER", () => this.nextNight());
    this.persist();
    this.refreshShop();
    announce(`Night ${this.run.nightNumber} survived. Buy upgrades or press Enter for the next night.`);
  }
  persist() { this.storageOK = Save.write("vampRunnerProgress", this.run.profile); }
  buy(key) {
    if (this.transitioning || !purchase(this.run.profile, key)) return;
    this.persist(); this.refreshShop(); Sfx.play("blood");
  }
  restoreCoffin() {
    if (this.transitioning || this.run.lives >= MAX_LIVES || this.run.profile.dirt < 18) return;
    this.run.profile.dirt -= 18; this.run.lives++;
    this.persist(); this.refreshShop(); Sfx.play("safe");
  }
  refreshShop() {
    this.balance.setText(String(this.run.profile.dirt));
    this.shop.forEach(({ upgrade, name, buy }) => {
      const level = this.run.profile.upgrades[upgrade.key], cost = upgrade.cost * (level + 1);
      name.setText(`${upgrade.name} ${level}/3`);
      buy.caption.setText(level >= 3 ? "MAXED" : `${cost} DIRT`);
      buy.bg.setAlpha(level >= 3 || this.run.profile.dirt < cost ? 0.4 : 1);
    });
    this.restore.caption.setText(this.run.lives >= MAX_LIVES ? "3 / 3 COFFINS · RESTED" : `COFFINS ${this.run.lives}/3 · RESTORE FOR 18 DIRT`);
    this.restore.bg.setAlpha(this.run.lives >= MAX_LIVES || this.run.profile.dirt < 18 ? 0.4 : 1);
    this.saveNote.setText(this.storageOK ? "Grave dirt and upgrades stay with you." : "Browser saving unavailable · kept for this session.");
  }
  nextNight() {
    if (this.transitioning) return;
    this.transitioning = true;
    this.scene.start("Game", { nightNumber: this.run.nightNumber + 1, score: this.run.score, lives: this.run.lives, profile: this.run.profile });
  }
  endRun() {
    if (this.transitioning) return;
    this.transitioning = true;
    this.scene.start("Score", { score: this.run.score, nights: this.run.nightNumber, reason: "You made it home before dawn.", profile: this.run.profile });
  }
}

class ScoreScene extends Phaser.Scene {
  constructor() {
    super("Score");
  }
  init(data = {}) {
    this.finalScore = data.score || 0;
    this.nights = data.nights || 0;
    this.reason = data.reason || "";
    this.submitted = false;
    this.playerName = "";
    this.profile = data.profile ?? Save.progress();
  }
  create() {
    vignette(this);
    label(this, 195, 57, "THE NIGHT REMEMBERS", 10, "#c08d9b", true).setOrigin(
      0.5,
    );
    label(
      this,
      195,
      103,
      this.nights ? "A GOOD NIGHT TO LIVE." : "BACK TO THE SHADOWS.",
      24,
    ).setOrigin(0.5);
    label(this, 195, 145, this.reason, 14, "#a9bac8")
      .setOrigin(0.5)
      .setWordWrapWidth(342)
      .setAlign("center");
    label(this, 195, 203, this.finalScore.toLocaleString(), 53).setOrigin(0.5);
    label(
      this,
      195,
      250,
      this.nights + " NIGHT" + (this.nights === 1 ? "" : "S") + " SURVIVED",
      11,
      "#dfb778",
      true,
    ).setOrigin(0.5);
    label(this, 195, 288, "LEAVE YOUR NAME", 10, "#a9bac8", true).setOrigin(
      0.5,
    );
    this.nameDisplay = label(
      this,
      195,
      318,
      "_ _ _ _ _ _ _",
      24,
      "#dfb778",
      true,
    ).setOrigin(0.5);
    const keyRows = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];
    keyRows.forEach((row, ri) => {
      const width = row.length * 34,
        start = (GAME_W - width) / 2;
      row.split("").forEach((char, i) => {
        const x = start + i * 34 + 17,
          y = 370 + ri * 38;
        const key = this.add
          .rectangle(x, y, 31, 33, C.panel)
          .setStrokeStyle(1, C.line)
          .setInteractive({ useHandCursor: true });
        label(this, x, y, char, 14, "#cad4de", true).setOrigin(0.5);
        key.on("pointerdown", () => this.pressKey(char));
      });
    });
    this.back = button(this, 97, 494, 146, "← DELETE", () => this.pressBack());
    this.save = button(
      this,
      275,
      494,
      166,
      "SAVE SCORE",
      () => this.submitScore(),
      true,
    );
    this.buildLeaderboard();
    button(
      this,
      195,
      728,
      342,
      "RUN AGAIN  →",
      () => this.scene.start("Game", { profile: this.profile }),
      true,
    );
    button(this, 195, 790, 342, "BACK TO THE CITY", () =>
      this.scene.start("Menu"),
    );
    onKey(this, "keydown", (e) => {
      if (e.repeat) return;
      if (e.key === "Enter") {
        this.scene.start("Game", { profile: this.profile });
        return;
      }
      if (e.key === "Escape") {
        this.scene.start("Menu");
        return;
      }
      if (e.key === "Backspace") {
        e.preventDefault();
        this.pressBack();
        return;
      }
      if (/^[a-z]$/i.test(e.key)) this.pressKey(e.key.toUpperCase());
    });
    announce(
      "Run finished. " +
        this.finalScore +
        " points, " +
        this.nights +
        " nights survived. Enter to run again.",
    );
  }
  updateName() {
    this.nameDisplay.setText(
      this.playerName.padEnd(7, "_").split("").join(" "),
    );
  }
  pressKey(letter) {
    if (this.submitted || this.playerName.length >= 7) return;
    this.playerName += letter;
    this.updateName();
  }
  pressBack() {
    if (this.submitted) return;
    this.playerName = this.playerName.slice(0, -1);
    this.updateName();
  }
  submitScore() {
    if (this.submitted) return;
    const scores = cleanScores([
      ...Save.scores(),
      { name: this.playerName || "ANON", score: this.finalScore },
    ]);
    if (!Save.write("vampRunnerScores", scores)) {
      this.save.caption.setText("SAVE UNAVAILABLE");
      announce("This browser cannot save scores. You can still run again.");
      return;
    }
    this.submitted = true;
    this.save.caption.setText("SCORE SAVED");
    this.save.bg.disableInteractive();
    this.buildLeaderboard();
    announce("Score saved on this device.");
  }
  buildLeaderboard() {
    this.lbContainer?.destroy();
    this.lbContainer = this.add.container(0, 0);
    this.lbContainer.add(
      label(
        this,
        195,
        545,
        "PERSONAL BESTS · THIS DEVICE",
        10,
        "#a9bac8",
        true,
      ).setOrigin(0.5),
    );
    const scores = Save.scores();
    if (!scores.length)
      this.lbContainer.add(
        label(
          this,
          195,
          586,
          "No legends yet. Save the first one.",
          13,
          "#a9bac8",
        ).setOrigin(0.5),
      );
    scores.slice(0, 4).forEach((score, i) => {
      this.lbContainer.add(
        label(
          this,
          40,
          573 + i * 26,
          String(i + 1).padStart(2, "0") + "  " + score.name,
          13,
          i === 0 ? "#dfb778" : "#a9bac8",
          true,
        ),
      );
      this.lbContainer.add(
        label(
          this,
          350,
          573 + i * 26,
          score.score.toLocaleString(),
          13,
          "#eee5d3",
          true,
        ).setOrigin(1, 0),
      );
    });
  }
}
function announce(message) {
  const live = document.getElementById("game-status");
  if (live) live.textContent = message;
}

const config = {
  type: Phaser.AUTO,
  width: GAME_W,
  height: GAME_H,
  backgroundColor: "#0b1018",
  parent: "game",
  input: { activePointers: 3, keyboard: true },
  render: { antialias: true, roundPixels: true },
  scene: [BootScene, MenuScene, GameScene, CryptScene, ScoreScene],
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
};
if (typeof module !== "undefined" && module.exports)
  module.exports = {
    BootScene,
    MenuScene,
    GameScene,
    CryptScene,
    ScoreScene,
    Save,
    config,
  };
else new Phaser.Game(config);
