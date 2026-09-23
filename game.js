// Vamp Runner — a mobile vampire platformer. Phaser 3.60, no build step.
/* global Phaser, VampRules, VampAudio, VampBat, VampHunt */
const {
  FLOOR, MAX_LIVES, STEP, UPGRADES, COFFIN_COST, GATE_HALF_WIDTH, CAMPAIGN, createWorld, step,
  cleanProgress, cleanRun, purchase, targetHuman, canGlamour, interruptGlamour, advanceClock, dawnState, cleanScores, contractResults, pulseState, gateState, nightSettings, sectionAt,
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
    if (key === "vampRunnerCampaign") this.sessionRun = cleanRun(value);
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
  run() {
    return cleanRun(this.sessionRun === undefined ? this.read("vampRunnerCampaign", null) : this.sessionRun);
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
const Sfx = VampAudio.createSound({ enabled: () => preferences.sound });

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
    texture("key", () => {
      g.fillStyle(0x90d6f5, 0.16); g.fillCircle(20, 20, 19);
      g.lineStyle(3, 0x90d6f5); g.strokeCircle(15, 13, 6);
      g.lineBetween(19, 17, 30, 29); g.lineBetween(26, 24, 30, 20); g.lineBetween(29, 28, 33, 24);
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
    Sfx.setTheme("quarter");
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
    const progress = Save.progress();
    const medals = progress.medals.reduce((sum, mask) => sum + [1, 2, 4].filter((bit) => mask & bit).length, 0);
    label(this, 26, 313, `12 NIGHTS · 8 DISTRICTS · ${medals}/36 MARKS`, 10, "#dfb778", true);
    label(this, 24, 395, "Tonight, steal from a saint.", 23);
    label(
      this,
      24,
      435,
      "The Bellkeeper guards a stolen seal.\nTurn his people. Break his watch. Get out.",
      14,
      "#afbec9",
    ).setLineSpacing(6);
    const rows = [
      ["01", "KEEP TO THE SHADOWS", "Move ← →. Space to jump above the watch."],
      ["02", "MAKE THEM YOURS", "Hold E to glamour. Close in; F to bite."],
      ["03", "BECOME THE SWARM", "V bursts forward. Biting restores blood."],
    ];
    rows.forEach(([num, title, copy], i) => {
      const y = 490 + i * 47;
      label(this, 24, y, num, 11, "#bd7485", true);
      label(this, 57, y, title, 11, "#eee5d3", true);
      label(this, 57, y + 19, copy, 12, "#a5b5c4");
    });
    this.checkpoint = Save.run();
    button(this, 195, 657, 342, "HUNT THE BELLKEEPER →", () => this.startHunt(), true);
    button(
      this,
      this.checkpoint ? 107 : 195,
      719,
      this.checkpoint ? 166 : 342,
      this.checkpoint ? `CONTINUE · ${this.checkpoint.nightNumber}` : "START THE CAMPAIGN →",
      () => this.startRun(),
      false,
    );
    if (this.checkpoint) button(this, 283, 719, 166, "NEW CAMPAIGN", () => this.startRun(false));
    label(this, 195, 765, "A city that remembers what you do.", 12, "#a9bac8").setOrigin(0.5);
    this.soundButton = button(this, 105, 805, 158, "", () =>
      this.toggleSound(),
    );
    this.motionButton = button(this, 280, 805, 166, "", () =>
      this.toggleMotion(),
    );
    this.refreshSettings();
    this.starting = false;
    onKey(this, "keydown-ENTER", () => this.startHunt());
    onKey(this, "keydown-SPACE", () => this.startHunt());
    announce(
      "Vamp Runner. Press Enter to hunt the Bellkeeper. The twelve-night campaign is also available below.",
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
    if (preferences.sound) Sfx.play("key"); else Sfx.stop();
  }
  toggleMotion() {
    preferences.reducedMotion = !preferences.reducedMotion;
    Save.write("vampRunnerSettings", preferences);
    this.refreshSettings();
  }
  startRun(resume = true) {
    if (this.starting) return;
    this.starting = true;
    Sfx.play("glamour");
    const checkpoint = resume ? this.checkpoint : null;
    if (!checkpoint) Save.write("vampRunnerCampaign", null);
    this.scene.start(checkpoint ? "Bat" : "Game", { seed: Math.floor(Math.random() * 0xffffffff), ...checkpoint, profile: Save.progress() });
  }
  startHunt() {
    if (this.starting) return;
    this.starting = true; Sfx.play("bell");
    this.scene.start("Game", { mode: "bellkeeper", profile: Save.progress(), seed: 1 });
  }
}

class GameScene extends Phaser.Scene {
  constructor() { super("Game"); }
  init(data = {}) { this.runData = data; }
  create() {
    // Phaser reuses scene instances. Reset every piece of transient state.
    this.world = createWorld({ ...this.runData, profile: this.runData.profile ?? Save.progress() });
    Sfx.setTheme(this.world.level.themeKey);
    this.paused = false;
    this.transitioning = false;
    this.pending = {};
    this.held = new Map();
    this.glamourHeld = new Set();
    this.accumulator = 0;
    this.messageUntil = this.world.level.oneWay ? 5 : 3;
    this.pauseObjects = [];
    this.warningUntil = 0;
    this.time.paused = false;
    this.tweens.resumeAll();
    this.cameras.main.setBounds(0, 0, this.world.level.width, GAME_H);
    this.cameras.main.setScroll(0, 0);
    this.drawCity();
    this.drawLevel();
    if (this.world.hunt) this.drawHunt();
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
      Sfx.stop();
    });
    this.renderWorld();
    this.message.setText(`${this.world.level.name}\n${Math.ceil(this.world.timeLeft)}s until sunrise · ${this.world.level.requiredKeys} crypt keys${this.world.level.theme.underground ? "\nOnly your sealed crypt stops the dawn curse." : this.world.level.oneWay ? "\nOne way: gates seal behind you." : ""}`);
    if (this.world.hunt) { this.message.setText("THE BELLKEEPER\nSteal his seal. Bring it home before dawn."); this.messageUntil = 4; }
    announce(`Night ${this.world.night}: ${this.world.level.name}. Find ${this.world.level.requiredKeys} crypt keys before sunrise.${this.world.level.oneWay ? " Gates seal behind you when you enter the next section." : ""}`);
  }
  fixed(object, depth = 50) { return object.setScrollFactor(0).setDepth(depth); }
  drawCity() {
    const sky = this.fixed(this.add.graphics(), -10);
    const theme = this.world.level.theme;
    sky.fillGradientStyle(0x101322, 0x101322, theme.sky, theme.sky, 1);
    sky.fillRect(0, 0, GAME_W, GAME_H);
    if (theme.underground) { this.drawUnderground(theme); return; }
    for (let i = 0; i < 40; i++) {
      sky.fillStyle(C.cream, 0.25 + (i % 4) * 0.1);
      sky.fillRect((i * 83 + 17) % GAME_W, 170 + (i * 39) % 270, 1, 1);
    }
    sky.fillStyle(0xd9d4bf); sky.fillCircle(284, 250, 33);
    sky.fillStyle(0x1b1b2b); sky.fillCircle(296, 240, 30);
    this.dawn = this.fixed(this.add.rectangle(195, 422, 390, 844, 0xf5a568, 0), -8);
    for (let layer = 0; layer < 2; layer++) {
      const g = this.add.graphics().setScrollFactor(layer ? 0.45 : 0.2).setDepth(-6 + layer);
      for (let i = 0; i < Math.ceil(this.world.level.width * 0.5 / 86) + 6; i++) {
        const x = i * 86, h = 80 + ((i * 37 + layer * 47) % 170), y = FLOOR - h;
        g.fillStyle(layer ? theme.stone : 0x252b3b);
        if (theme.motif === "trees") {
          g.fillRect(x + 34, y, 9, h);
          g.lineStyle(7, theme.stone); g.lineBetween(x + 38, y + 60, x + 9, y + 24); g.lineBetween(x + 38, y + 83, x + 72, y + 35);
          g.fillCircle(x + 25, y + 14, 30); g.fillCircle(x + 57, y + 30, 24);
          continue;
        }
        g.fillRect(x, y, 80, h + 10);
        g.fillTriangle(x - 5, y, x + 40, y - 28, x + 85, y);
        if (theme.motif === "spires") g.fillTriangle(x + 24, y, x + 40, y - 75, x + 56, y);
        if (theme.motif === "awnings") {
          for (let stripe = 0; stripe < 5; stripe++) {
            g.fillStyle(stripe % 2 ? 0x9b5569 : 0x968270, 0.7); g.fillRect(x + stripe * 16, y + h - 40, 16, 13);
          }
        }
        g.fillStyle(C.gold, layer ? 0.25 : 0.1);
        for (let row = 0; row < Math.floor(h / 35); row++) {
          g.fillRect(x + 19, y + 18 + row * 35, 8, 13);
          g.fillRect(x + 53, y + 18 + row * 35, 8, 13);
        }
      }
    }
  }
  drawUnderground(theme) {
    const back = this.add.graphics().setScrollFactor(0.3).setDepth(-6);
    for (let x = -60; x < this.world.level.width * 0.4 + 500; x += 170) {
      back.fillStyle(theme.stone); back.fillRoundedRect(x, 205, 144, 440, 65);
      back.fillStyle(theme.sky); back.fillRoundedRect(x + 15, 226, 114, 418, 53);
      back.lineStyle(2, theme.trim, 0.2);
      for (let y = 310; y < FLOOR; y += 42) back.lineBetween(x, y, x + 14, y);
      if (theme.motif === "crypts") {
        for (let y = 335; y < 570; y += 66) {
          back.fillStyle(0x665f53); back.fillRoundedRect(x + 45, y, 48, 29, 10);
          back.fillStyle(0xb9ab8a); back.fillCircle(x + 69, y + 11, 7);
          back.fillStyle(0x15151c); back.fillCircle(x + 66, y + 10, 2); back.fillCircle(x + 72, y + 10, 2);
        }
      } else {
        back.fillStyle(0x537371); back.fillRect(x + 32, 265, 80, 11);
        back.fillRect(x + 102, 265, 10, 325);
        back.lineStyle(3, 0x99a47c, 0.55); back.strokeCircle(x + 107, 400, 17);
      }
      back.fillStyle(0xe3bb73, 0.09); back.fillCircle(x + 18, 300, 38);
      back.fillStyle(0xf0c57c, 0.85); back.fillRect(x + 14, 291, 8, 16);
    }
    const ceiling = this.fixed(this.add.graphics(), -5);
    ceiling.fillStyle(0x0b1119); ceiling.fillRect(0, 144, GAME_W, 48);
    for (let x = 0; x < GAME_W; x += 39) ceiling.fillTriangle(x, 187, x + 16, 211 + x % 17, x + 37, 187);
    this.dawn = this.fixed(this.add.graphics(), -4);
    this.dawn.fillStyle(0xeab774, 0.4);
    this.dawn.fillTriangle(95, 197, 120, FLOOR, 171, FLOOR);
    this.dawn.fillTriangle(310, 197, 252, FLOOR, 294, FLOOR);
  }
  drawHunt() {
    const w = this.world, g = this.add.graphics().setDepth(0);
    // The tower is a world landmark, so it grows into view as you approach.
    for (const x of [2020, 2240]) {
      g.fillStyle(0x242332); g.fillRect(x, 245, 100, FLOOR - 245);
      g.fillTriangle(x - 8, 245, x + 50, 164, x + 108, 245);
      g.lineStyle(2, 0x766278, 0.6); g.lineBetween(x + 12, 270, x + 12, FLOOR);
      g.fillStyle(0x0c101b); g.fillRoundedRect(x + 26, 279, 48, 110, 24);
    }
    g.fillStyle(0x373041); g.fillRect(2100, 285, 170, 340);
    g.fillTriangle(2080, 285, 2185, 222, 2290, 285);
    g.lineStyle(5, 0x766278); g.strokeCircle(2185, 365, 58);
    g.fillStyle(0x563746); g.fillCircle(2185, 365, 53);
    for (let j = 0; j < 12; j++) {
      const a = j * Math.PI / 6;
      g.lineStyle(2, 0xcc946f, 0.65);
      g.lineBetween(2185, 365, 2185 + Math.cos(a) * 48, 365 + Math.sin(a) * 48);
    }
    g.fillStyle(0xe3bb73, 0.75); g.fillCircle(2185, 365, 12);
    g.fillStyle(0x101522); g.fillRoundedRect(2157, 455, 56, 170, 28);
    g.fillStyle(0x9e8067); g.fillRoundedRect(2170, 269, 30, 35, 12);
    g.fillRect(2164, 301, 42, 5); g.fillCircle(2185, 310, 5);
    g.lineStyle(2, 0xa68c77, 0.7); g.lineBetween(2185, 311, 2185, 485);
    label(this, 2185, 210, "THE BELLKEEPER", 15, "#e3bb73", true).setOrigin(0.5).setDepth(4);
    for (const s of w.level.shadows) {
      g.fillStyle(0x060b17, 0.94); g.fillRoundedRect(s.x, FLOOR - 117, s.w, 116, 34);
      g.lineStyle(2, 0x706a9e, 0.65); g.lineBetween(s.x, FLOOR - 2, s.x + s.w, FLOOR - 2);
      label(this, s.x + s.w / 2, FLOOR - 98, "SHADOW", 10, "#b5afd7", true).setOrigin(0.5).setDepth(4);
    }
    for (const x of w.level.lanterns) {
      g.lineStyle(3, 0x8b7561); g.lineBetween(x, 418, x, FLOOR);
      g.lineBetween(x, 418, x + 30, 418);
      g.fillStyle(0x8b7561); g.fillRoundedRect(x + 18, 418, 24, 30, 4);
    }
    label(this, 2620, 320, "HIGH ROOFS · JUMP + SWARM →", 11, "#c6b3e8", true).setOrigin(0.5).setDepth(4);
    label(this, 2640, 593, "LOW ROOFS →", 11, "#dfb778", true).setOrigin(0.5).setDepth(4);
    this.sealLabel = label(this, 2380, 415, "HOLD GLAMOUR\nTO BREAK THE SEAL", 11, "#dfb778", true).setOrigin(0.5).setAlign("center").setDepth(15);
    this.huntGraphic = this.add.graphics().setDepth(14);
    this.huntAir = this.fixed(this.add.graphics(), 42);
    this.huntHeat = this.fixed(this.add.graphics(), 52);
    this.huntNames = w.level.humans.map(h => label(this, h.x, h.y - 24, h.name, 11, "#d4c6b3").setOrigin(0.5).setDepth(15));
    this.huntBursts = [];
  }
  renderHunt() {
    const w = this.world, h = w.hunt, p = w.player, g = this.huntGraphic, air = this.huntAir;
    const clock = preferences.reducedMotion ? 0 : w.elapsed;
    g.clear(); air.clear(); this.huntHeat.clear();
    this.routeText.setText(h.phase === "escape" ? "THE WARD IS RISING · KEEP MOVING" : h.hidden ? "HIDDEN · THE WATCH LOSES YOUR TRAIL" : h.alarm ? "HUNTED · THE BELLS HAVE WOKEN THE WATCH" : h.heat > 25 ? "SUSPICIOUS · FIND SHADOW OR HIGH GROUND" : "UNSEEN · CHOOSE YOUR APPROACH");
    this.keyText.setText(VampHunt.objective(w));
    this.questText.setText(`BLOOD ${"◆".repeat(h.blood)}${"◇".repeat(3 - h.blood)} · ${h.allies} ALLIES`);
    this.covenText.setText(h.phase === "escape" ? `${Math.max(0, Math.ceil((p.x - h.pursuitX) / 10))}m AHEAD OF THE WARD${h.bellCut ? " · BELL SILENCED" : ""}` : h.hidden ? "Stay still. Let them look past you." : "Every human can change your escape.");
    this.huntHeat.fillStyle(C.line, 0.65); this.huntHeat.fillRect(20, 207, 282, 3);
    this.huntHeat.fillStyle(h.alarm ? C.red : C.gold); this.huntHeat.fillRect(20, 207, 282 * h.heat / 100, 3);
    this.swarmButton.bg.setAlpha(h.blood > 0 && h.cooldown <= 0 ? 1 : 0.4);
    this.swarmButton.caption.setText(h.blood ? "SWARM · V" : "NO BLOOD");
    if (h.hidden) this.player.setAlpha(0.46);
    this.player.setVisible(h.dash <= 0);
    this.sealLabel.setVisible(h.phase === "approach");
    const bat = (x, y, size, color) => {
      const wing = Math.sin(clock * 38 + x * 0.12) * size * 0.4;
      g.fillStyle(color); g.fillEllipse(x, y, size * 0.8, size * 0.6);
      g.fillTriangle(x, y, x - size * 2, y - size + wing, x - size * 1.2, y + size * 0.45);
      g.fillTriangle(x, y, x + size * 2, y - size + wing, x + size * 1.2, y + size * 0.45);
    };
    if (h.dash > 0) for (let i = 0; i < 9; i++) bat(p.x - p.facing * i * 10, p.y + 20 + Math.sin(i * 2.4) * 20, 4 + i % 3, i % 2 ? 0x111427 : 0xc38cad);
    w.level.humans.forEach((human, i) => {
      const ally = human.ally;
      this.humans[i].setVisible(!ally);
      this.huntNames[i].setVisible(!ally && Math.abs(p.x - human.x) < 250).setPosition(human.x, human.y - 24);
      if (ally) {
        this.priestLabels[i]?.setVisible(false);
        if (ally.progress < 1) { bat(human.x, human.y, 6, C.mint); bat(human.x - 15, human.y + 12, 4, C.mint); }
        return;
      }
      if (human.suspicion > 0 && human.state === "human") {
        g.lineStyle(2, C.gold, 0.7); g.strokeCircle(human.x, human.y - 42, 9);
        g.fillStyle(C.gold); g.fillRect(human.x - 2, human.y - 48, 4, 12 * human.suspicion);
      }
    });
    if (!h.lampsOut && h.phase !== "escape") w.level.lanterns.forEach((x, i) => {
      const target = VampHunt.lanternX(w, i);
      g.fillStyle(C.gold, 0.055); g.fillTriangle(x + 30, 444, target - 56, FLOOR, target + 56, FLOOR);
      g.fillStyle(C.gold, 0.12); g.fillEllipse(target, FLOOR - 4, 100, 15);
      g.fillStyle(0xffd68f, 0.9); g.fillRect(x + 24, 425, 12, 17);
    });
    const bridge = w.level.platforms[w.level.bridge];
    g.lineStyle(h.bridgeOpen ? 3 : 1, 0xba9ae7, h.bridgeOpen ? 1 : 0.2);
    g.lineBetween(bridge.x, bridge.y, bridge.x + bridge.w, bridge.y);
    if (h.bridgeOpen) {
      g.fillStyle(0x8c70b5, 0.5); g.fillRect(bridge.x, bridge.y, bridge.w, 12);
      for (let i = 0; i < 8; i++) bat(bridge.x + i * 25, bridge.y + 18, 3, 0xaa8fc8);
    }
    if (h.beam) {
      const active = h.beam.age > 1.2, x = h.beam.x;
      g.fillStyle(0xffe7a6, active ? 0.28 : 0.06); g.fillRect(x - 39, 293, 78, FLOOR - 293);
      g.lineStyle(active ? 5 : 2, C.gold, active ? 1 : 0.7);
      g.lineBetween(x, 330, x, FLOOR); g.lineBetween(x - 32, 398, x + 32, 398);
      g.strokeEllipse(x, FLOOR - 5, 85, 18);
      if (active) { g.fillStyle(0xfff4c6, 0.8); g.fillRect(x - 5, 320, 10, FLOOR - 320); }
    }
    if (h.phase === "escape") {
      const front = h.pursuitX, screen = front - this.cameras.main.scrollX;
      g.fillStyle(0xefa66b, 0.14); g.fillRect(Math.max(0, front - 390), 250, Math.min(front, 390), 380);
      g.lineStyle(5, 0xffda9b, 0.75); g.lineBetween(front, 255, front, FLOOR + 10);
      for (let i = 0; i < 18; i++) {
        const y = 280 + i * 20, offset = preferences.reducedMotion ? i % 4 * 4 : Math.sin(clock * 9 + i) * 14;
        g.fillStyle(i % 2 ? 0xf2b07c : 0xffe7b9, 0.4);
        g.fillTriangle(front - 22, y + 18, front + offset, y - 20, front + 14, y + 20);
      }
      air.fillStyle(0xb64a40, 0.12); air.fillRect(0, 212, 390, 424);
      if (screen < 0) {
        air.fillStyle(C.gold, 0.85); air.fillTriangle(7, 362, 19, 354, 19, 370);
        air.lineStyle(2, C.gold, 0.65); air.lineBetween(6, 340, 6, 385);
      }
    }
    // Wind-blown ash and low fog give motion a direction without hiding landings.
    for (let i = 0; i < 17; i++) {
      const x = ((i * 83 - clock * (h.phase === "escape" ? 55 : 12)) % 430 + 430) % 430;
      const y = 320 + (i * 53) % 285;
      air.fillStyle(h.phase === "escape" ? 0xf0b17e : 0xc3b7d7, h.phase === "escape" ? 0.45 : 0.17);
      air.fillCircle(x, y, i % 3 ? 1 : 2);
    }
    this.huntBursts = this.huntBursts.filter(b => w.elapsed - b.at < 0.7);
    for (const b of this.huntBursts) {
      const age = (w.elapsed - b.at) / 0.7;
      g.lineStyle(2, b.color, (1 - age) * 0.8); g.strokeCircle(b.x, b.y, preferences.reducedMotion ? 24 : 10 + age * 62);
    }
    const nearby = targetHuman(w);
    if (nearby?.state === "human" && !w.focus && nearby.behavior !== "priest") this.hint.setText(`${nearby.name}\nFace them. Hold GLAMOUR. Then close in.`);
    if (!nearby && !w.focus) this.hint.setText(h.phase === "escape" ? "Jump across. Swarm carries you farther." : h.hidden ? "Hidden. Watch the lamps and choose your moment." : h.blood ? "Jump · then SWARM for a longer crossing" : "A bite or blood syringe restores your swarm.");
    if (VampHunt.atSeal(w)) {
      this.hint.setText("Hold GLAMOUR to unbind the seal.");
      this.stunButton.bg.setAlpha(1);
    }
    if (h.phase === "approach") {
      g.lineStyle(2, C.gold, 0.75); g.strokeCircle(2380, 480, 25);
      g.fillStyle(C.gold); g.fillRect(2348, 439, 64 * Math.min(1, h.sealFocus / 1.5), 4);
    }
  }
  drawLevel() {
    const level = this.world.level, g = this.add.graphics().setDepth(1);
    for (const p of level.platforms) {
      if (p.motion || p.crumble || p.shadowBridge) continue;
      if (p.bonus) {
        // A cache balcony must leave the lower route visible beneath it.
        g.fillStyle(0x364553); g.fillRoundedRect(p.x, p.y, p.w, 14, 3);
        g.fillStyle(level.theme.trim); g.fillRect(p.x, p.y, p.w, 4);
        g.lineStyle(3, 0x927b5c);
        g.lineBetween(p.x + 8, p.y + 14, p.x + 25, p.y + 28);
        g.lineBetween(p.x + p.w - 8, p.y + 14, p.x + p.w - 25, p.y + 28);
        continue;
      }
      if (!p.ground && p.skin !== "brick") {
        if (p.skin === "branch") {
          g.fillStyle(0x65564a); g.fillRoundedRect(p.x, p.y, p.w, 13, 5);
          g.lineStyle(4, 0x65564a); g.lineBetween(p.x + p.w * 0.25, p.y + 12, p.x + p.w * 0.5, p.y + 55);
          g.fillStyle(0x91a879); g.fillRect(p.x, p.y, p.w, 3);
          for (let x = p.x + 12; x < p.x + p.w; x += 32) g.fillEllipse(x, p.y + 15, 18, 7);
        } else if (p.skin === "awning") {
          g.fillStyle(0x786150); g.fillRect(p.x + 9, p.y + 10, 5, FLOOR - p.y - 10); g.fillRect(p.x + p.w - 14, p.y + 10, 5, FLOOR - p.y - 10);
          for (let x = p.x, stripe = 0; x < p.x + p.w; x += 22, stripe++) {
            g.fillStyle(stripe % 2 ? 0xc7ac88 : 0xa24e67); g.fillRect(x, p.y, Math.min(22, p.x + p.w - x), 15);
          }
          g.fillStyle(0xe0c8a3); g.fillRect(p.x, p.y, p.w, 3);
        } else if (p.skin === "stone" || p.skin === "bone") {
          g.fillStyle(level.theme.stone); g.fillRect(p.x + p.w * 0.27, p.y + 13, p.w * 0.46, FLOOR - p.y - 13);
          g.fillStyle(0x56606b); g.fillRect(p.x, p.y, p.w, 16);
          g.fillStyle(level.theme.trim); g.fillRect(p.x, p.y, p.w, 4);
          if (p.skin === "bone") {
            g.fillStyle(0xc7b998, 0.75);
            for (let x = p.x + 12; x < p.x + p.w - 6; x += 25) { g.fillCircle(x, p.y + 9, 3); g.fillRect(x - 2, p.y + 10, 4, 4); }
          }
        } else if (p.skin === "pipe") {
          g.fillStyle(0x355d5e); g.fillRoundedRect(p.x, p.y, p.w, 18, 8);
          g.fillStyle(0x94b4a5); g.fillRect(p.x + 4, p.y, p.w - 8, 4);
          g.lineStyle(3, 0x748a7c); g.lineBetween(p.x + 12, p.y, p.x + 12, p.y + 18); g.lineBetween(p.x + p.w - 12, p.y, p.x + p.w - 12, p.y + 18);
        } else {
          g.fillStyle(p.skin === "pier" ? 0x527f86 : 0x847060); g.fillRect(p.x, p.y, p.w, 14);
          g.fillStyle(p.skin === "pier" ? 0xafd1cd : 0xd0b796); g.fillRect(p.x, p.y, p.w, 3);
          g.lineStyle(2, 0x756f62, 0.6);
          for (const x of [p.x + 10, p.x + p.w - 10]) g.lineBetween(x, p.y + 14, x, p.skin === "pier" ? FLOOR + 32 : p.y + 38);
          for (let x = p.x + 12; x < p.x + p.w - 5; x += 22) g.lineBetween(x, p.y + 4, x, p.y + 13);
        }
        continue;
      }
      g.fillStyle(p.ground ? level.theme.stone : 0x18232e);
      g.fillRect(p.x, p.y, p.w, p.ground ? 120 : FLOOR - p.y);
      g.fillStyle(level.theme.trim);
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
      g.fillStyle(0x060a12); g.fillRect(gap.x, FLOOR + 5, gap.width, 108);
      if (gap.water) {
        g.fillStyle(0x2a6579, 0.6); g.fillRect(gap.x, FLOOR + 18, gap.width, 100);
        g.lineStyle(1, 0x73b9c6, 0.6);
        for (let x = gap.x + 8; x < gap.x + gap.width - 18; x += 35) g.lineBetween(x, FLOOR + 26, x + 18, FLOOR + 26);
      }
      g.fillStyle(C.red, 0.85); g.fillTriangle(gap.x - 12, FLOOR - 8, gap.x + 5, FLOOR, gap.x - 12, FLOOR + 8); g.fillTriangle(gap.x + gap.width + 12, FLOOR - 8, gap.x + gap.width - 5, FLOOR, gap.x + gap.width + 12, FLOOR + 8);
      label(this, gap.x + gap.width / 2, FLOOR + 37, "↓", 17, "#c9758a").setOrigin(0.5);
    }
    const crypt = level.crypt;
    g.fillStyle(0x35464b); g.fillRect(crypt.x - 60, FLOOR - 108, 120, 108);
    g.fillStyle(0x61746d); g.fillTriangle(crypt.x - 72, FLOOR - 108, crypt.x, FLOOR - 153, crypt.x + 72, FLOOR - 108);
    g.fillStyle(0x091c19); g.fillRoundedRect(crypt.x - 34, FLOOR - 92, 68, 92, 30);
    this.cryptDoor = this.add.image(crypt.x, FLOOR - 40, "shelter").setDisplaySize(55, 72).setDepth(2);
    label(this, crypt.x, FLOOR - 174, "YOUR CRYPT", 13, "#90d9bf", true).setOrigin(0.5);
    this.pickups = level.pickups.map((p) => {
      const size = p.kind === "dirt" ? p.value >= 5 ? 34 : 22 : 34;
      return this.add.image(p.x, p.y, p.kind).setDepth(5).setDisplaySize(size, size);
    });
    this.pickupValues = level.pickups.map((p) => p.kind === "dirt" && p.value > 1 ? label(this, p.x, p.y - 26, `+${p.value}`, 11, "#f4d798", true).setOrigin(0.5).setDepth(6) : null);
    this.hazardSprites = level.hazards.map((h) => this.add.image(h.x, h.y, h.kind).setDepth(6).setDisplaySize(36, 40));
    this.humans = level.humans.map((h) => this.add.image(h.x, h.y + h.h, "npc_plain").setOrigin(0.5, 1).setDisplaySize(38, 42).setDepth(7));
    this.priestLabels = level.humans.map(h => h.behavior === "priest" ? label(this, h.x, h.y - 50, "", 10, "#dfb778", true).setOrigin(0.5).setDepth(12) : null);
    this.dynamicGraphic = this.add.graphics().setDepth(3);
    this.gateGraphic = this.add.graphics().setDepth(8);
    this.gateLabels = level.gates.map((gate) => label(this, gate.x, 316, "", 12, "#dfb778", true).setOrigin(0.5).setDepth(9));
    level.sections.forEach((section) => {
      label(this, section.start + 100, 277, section.name, 12, "#c6bbab", true);
      g.lineStyle(2, 0x8a9696, 0.7); g.lineBetween(section.start + 80, FLOOR - 48, section.start + 80, FLOOR);
      g.fillStyle(0x629c90, 0.8); g.fillTriangle(section.start + 82, FLOOR - 48, section.start + 105, FLOOR - 41, section.start + 82, FLOOR - 33);
    });
  }
  buildHUD() {
    this.fixed(this.add.rectangle(195, 72, 390, 144, C.ink, 0.97));
    this.fixed(label(this, 20, 19, this.world.hunt ? "THE BELLKEEPER" : `NIGHT ${String(this.world.night).padStart(2, "0")}${this.world.night <= 12 ? "/12" : " · BLOOD MOON"}`, 12, "#dfb778", true));
    this.clock = this.fixed(label(this, 370, 18, "", 15, "#eee5d3", true).setOrigin(1, 0));
    this.fixed(this.add.rectangle(20, 54, 350, 4, C.line).setOrigin(0, 0.5));
    this.sunBar = this.fixed(this.add.rectangle(20, 54, 350, 4, C.gold).setOrigin(0, 0.5));
    this.sunMarker = this.fixed(this.add.circle(20, 54, 6, C.gold));
    this.fixed(label(this, 20, 68, "COFFINS", 10, "#a9bac8", true));
    this.coffins = [0, 1, 2].map((i) => this.fixed(this.add.image(30 + i * 29, 101, "shelter").setDisplaySize(23, 28)));
    this.fixed(label(this, 129, 68, "GARLIC HITS", 10, "#a9bac8", true));
    this.garlic = [0, 1, 2].map((i) => this.fixed(this.add.circle(141 + i * 23, 100, 6, C.line)));
    this.wallet = this.fixed(label(this, 370, 69, "", 13, "#dfb778", true).setOrigin(1, 0));
    this.scoreText = this.fixed(label(this, 370, 96, "", 13, "#eee5d3", true).setOrigin(1, 0));
    this.routeText = this.fixed(label(this, 20, 126, "", 11, "#a9bac8", true));
    this.keyText = this.fixed(label(this, 20, 157, "", 13, "#90d6f5", true));
    this.questText = this.fixed(label(this, 20, 184, "", 11, "#c4b28d", true));
    this.covenText = this.fixed(label(this, 195, 656, "", 11, "#90d9bf", true).setOrigin(0.5));
    this.message = this.fixed(label(this, 195, 236, "", 15, "#eee5d3").setOrigin(0.5).setWordWrapWidth(350).setAlign("center"));
    const pause = this.fixed(this.add.rectangle(351, 174, 48, 48, C.ink, 0.9).setStrokeStyle(1, C.line).setInteractive());
    this.fixed(label(this, 351, 174, "Ⅱ", 21).setOrigin(0.5));
    pause.on("pointerdown", (_p, _x, _y, event) => { event?.stopPropagation(); this.pauseGame(); });
    this.fixed(this.add.rectangle(195, 758, 390, 172, C.ink, 0.98));
    this.hint = this.fixed(label(this, 195, 687, "", 12, "#c4b28d", true).setOrigin(0.5).setWordWrapWidth(358).setAlign("center"));
  }
  buildControls() {
    this.keys = this.input.keyboard.addKeys("LEFT,RIGHT,A,D,Q,E,J");
    onKey(this, "keydown", (e) => {
      if (e.repeat) return;
      if (["Escape", "KeyP"].includes(e.code)) { this.paused ? this.resumeGame() : this.pauseGame(); return; }
      if (this.paused || this.transitioning) return;
      if (["Space", "ArrowUp", "KeyW", "KeyZ"].includes(e.code)) { e.preventDefault?.(); this.pending.jump = true; }
      if (["KeyF", "KeyK"].includes(e.code)) this.pending.bite = true;
      if (["KeyV", "ShiftLeft", "ShiftRight"].includes(e.code) && this.world.hunt) this.pending.dash = true;
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
    const release = (pointer) => { this.held.delete(pointer.id); this.glamourHeld.delete(pointer.id); };
    this.input.on("pointerup", release);
    this.input.on("pointerupoutside", release);
    this.input.on("gameout", () => { this.held.clear(); this.glamourHeld.clear(); });
    this.stunButton = button(this, 223, 737, 92, "GLAMOUR", () => {});
    this.stunButton.bg.on("pointerdown", pointer => { if (!this.paused) { Sfx.unlock(); this.glamourHeld.add(pointer.id); } });
    this.stunButton.bg.on("pointerout", pointer => this.glamourHeld.delete(pointer.id));
    this.biteButton = button(this, 329, 737, 92, "BITE · F", () => { if (!this.paused) this.pending.bite = true; });
    this.jumpButton = button(this, this.world.hunt ? 329 : 276, 798, this.world.hunt ? 92 : 198, "JUMP ↑", () => { if (!this.paused && !this.transitioning) this.pending.jump = true; }, true);
    this.swarmButton = this.world.hunt ? button(this, 223, 798, 92, "SWARM · V", () => { if (!this.paused && !this.transitioning) this.pending.dash = true; }) : null;
    for (const item of [this.stunButton, this.biteButton, this.jumpButton, this.swarmButton].filter(Boolean)) { this.fixed(item.bg, 60); this.fixed(item.caption, 61); }
    this.events.once("shutdown", () => this.input.removeAllListeners());
  }
  resetInput() { this.held?.clear(); this.glamourHeld?.clear(); this.pending = {}; this.input.keyboard.resetKeys(); if (this.world) interruptGlamour(this.world); }
  pauseGame() {
    if (this.paused || this.transitioning || this.world.status !== "playing") return;
    this.paused = true;
    this.resetInput();
    Sfx.stop();
    const add = (o) => { this.pauseObjects.push(this.fixed(o, 90)); return o; };
    const dim = add(this.add.rectangle(195, 422, 390, 844, C.ink, 0.97).setInteractive());
    dim.on("pointerdown", (_p, _x, _y, e) => e?.stopPropagation());
    add(label(this, 195, 228, "THE NIGHT CAN WAIT.", 27).setOrigin(0.5));
    if (this.world.level.oneWay) add(label(this, 195, 416, "ONE WAY · GATES SEAL BEHIND YOU", 11, "#dfb778", true).setOrigin(0.5));
    add(label(this, 195, 285, `Move  ← → / A D / Q D\nJump  Space / ↑ / W / Z\nHold E: glamour · F: bite\n${this.world.hunt ? "V / Shift: swarm (costs 1 blood)" : "Stay still. Face the human."}`, 15, "#acbdc9", true).setOrigin(0.5, 0).setLineSpacing(14));
    const contracts = contractResults(this.world).map((c) => `${c.complete ? "✓" : "○"} ${c.title}: ${c.key === "untouched" ? c.value === 0 ? "on track" : "missed" : c.value + "/" + c.target} (+${c.reward} dirt)`);
    add(label(this, 195, 440, "OPTIONAL NIGHT CHALLENGES", 11, "#dfb778", true).setOrigin(0.5));
    add(label(this, 195, 477, contracts.join("\n"), 13, "#dfb778").setOrigin(0.5).setAlign("center").setLineSpacing(8));
    const resume = button(this, 195, 564, 330, "RESUME THE NIGHT", () => this.resumeGame(), true);
    const end = button(this, 195, 628, 330, "END RUN", () => this.finishRun("You returned to the shadows."));
    [resume.bg, resume.caption, end.bg, end.caption].forEach(add);
    const sound = button(this, 195, 700, 210, `SOUND ${preferences.sound ? "ON" : "OFF"}`, () => {
      preferences.sound = !preferences.sound; Save.write("vampRunnerSettings", preferences);
      sound.caption.setText(`SOUND ${preferences.sound ? "ON" : "OFF"}`);
      if (preferences.sound) Sfx.play("key"); else Sfx.stop();
    });
    [sound.bg, sound.caption].forEach(add);
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
    return { nightNumber: w.night, score: w.score, lives: w.lives, seed: w.seed, profile: w.profile, stats: w.stats, timeLeft: w.timeLeft, bonus: w.bonus, contracts: w.contracts, contractReward: w.contractReward };
  }
  completeNight() {
    if (this.transitioning || this.world.status !== "safe") return;
    this.transitioning = true; this.resetInput(); this.saveProgress();
    if (this.world.hunt) { this.scene.start("HuntEnd", { world: this.world, won: true }); return; }
    this.scene.start("Crypt", this.runSnapshot());
  }
  finishRun(reason = this.world.reason) {
    if (this.transitioning) return;
    this.transitioning = true; this.resetInput(); this.saveProgress();
    if (this.world.hunt) { this.scene.start("HuntEnd", { world: this.world, won: false, reason }); return; }
    Save.write("vampRunnerCampaign", null);
    this.scene.start("Score", { score: this.world.score, nights: this.world.night - 1, reason, profile: this.world.profile });
  }
  showSunrise() {
    if (this.transitioning) return;
    if (this.world.hunt) { this.finishRun(); return; }
    this.transitioning = true; this.resetInput(); this.saveProgress();
    Save.write("vampRunnerCampaign", null);
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
      if (this.world.hunt && ["bite", "stun", "swarm", "key"].includes(event.kind)) this.huntBursts.push({ x: event.x ?? this.world.player.x, y: event.y ?? this.world.player.y, at: this.world.elapsed, color: event.kind === "bite" ? C.red : C.mint });
      if (event.kind === "jump") { Sfx.play("jump"); continue; }
      if (event.kind === "dawn-warning") this.warningUntil = this.world.elapsed + 3;
      if (["seal-stolen", "sabotage", "coven-born", "alarm", "hunt-hint"].includes(event.kind)) {
        this.message.setText(event.text); this.messageUntil = this.world.elapsed + 4;
        this.warningUntil = this.world.elapsed + 2.5; announce(event.text);
      }
      if (event.text && (event.kind === "dawn-warning" || this.world.elapsed >= this.warningUntil)) { this.message.setText(event.text); this.messageUntil = this.world.elapsed + (event.kind === "dawn-warning" ? 3 : 2); }
      if (["dirt", "stun", "bite"].includes(event.kind)) this.saveProgress();
      if (!["section", "locked", "gate-locked", "safe"].includes(event.kind)) Sfx.play(event.kind);
      if (event.kind === "hurt" && !preferences.reducedMotion) this.cameras.main.shake(110, 0.004);
      if (event.kind === "seal-stolen" && !preferences.reducedMotion) this.cameras.main.shake(500, 0.009);
      if (["bite", "iv", "hurt", "key", "locked", "section", "gate-locked", "gate-sealed", "dawn-warning", "veil", "veil-blocked"].includes(event.kind)) announce(event.text);
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
    const dawn = dawnState(w), seconds = Math.ceil(w.timeLeft);
    this.dawn.setAlpha(dawn.glow * 0.7);
    this.clock.setText(`${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")} TO SUNRISE`).setColor(dawn.final ? "#ff8295" : dawn.urgent ? "#ffb777" : "#eee5d3");
    this.sunBar.setScale(Math.max(0, w.timeLeft / w.level.duration), 1);
    this.sunMarker.setPosition(20 + dawn.fraction * 350, 54);
    this.coffins.forEach((o, i) => o.setAlpha(i < w.lives ? 1 : 0.18));
    this.garlic.forEach((o, i) => o.setFillStyle(i < w.garlicHits ? C.red : C.line));
    this.wallet.setText(`${w.profile.dirt} GRAVE DIRT`);
    this.scoreText.setText(`${w.score.toLocaleString()} PTS`);
    this.routeText.setText(w.iv > 0 ? `IV RUSH ${w.iv.toFixed(1)}s · PROTECTED` : `${w.level.theme.name.toUpperCase()} · ${Math.round(p.x / w.level.width * 100)}%${w.level.oneWay ? " · ONE WAY" : ""}`);
    const nextKey = w.level.pickups.filter((item) => item.kind === "key" && item.active).sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))[0];
    this.keyText.setText(nextKey ? `KEYS ${w.keys}/${w.level.requiredKeys} · ${nextKey.x < p.x ? "←" : "→"} ${Math.ceil(Math.abs(nextKey.x - p.x) / 10)}m${nextKey.y < p.y - 30 ? " ↑" : ""}` : `CRYPT OPEN · → ${Math.max(0, Math.ceil((w.level.crypt.x - p.x) / 10))}m`);
    this.questText.setText(`TURN ${w.stats.turned}/${w.level.contracts[0].target} · DIRT ${w.stats.dirt}/${w.level.contracts[1].target}`);
    this.covenText.setText(`${w.stats.turned} TURNED · ${w.veil ? "SHADOW VEIL READY" : `${w.feeds}/3 BITES → SHADOW VEIL`}`);
    this.cryptDoor.setAlpha(nextKey ? 0.45 : 1);
    this.message.setAlpha(w.elapsed < this.messageUntil ? 1 : 0);
    w.level.pickups.forEach((pickup, i) => {
      const sprite = this.pickups[i];
      sprite.setVisible(pickup.active);
      sprite.setPosition(pickup.x, pickup.y + (preferences.reducedMotion ? 0 : Math.sin(w.elapsed * 3 + i) * 3));
      this.pickupValues[i]?.setVisible(pickup.active).setPosition(pickup.x, pickup.y - 26);
    });
    this.targetGraphic.clear();
    if (w.veil) { this.targetGraphic.lineStyle(2, C.mint, 0.7); this.targetGraphic.strokeEllipse(p.x, p.y + p.h / 2, 44, 60); }
    if (w.focus) {
      this.targetGraphic.fillStyle(C.ink, 0.9); this.targetGraphic.fillRect(p.x - 27, p.y - 18, 54, 6);
      this.targetGraphic.fillStyle(C.mint); this.targetGraphic.fillRect(p.x - 27, p.y - 18, 54 * w.focus.elapsed / w.focus.duration, 6);
    }
    this.renderEncounters();
    w.level.humans.forEach((h, i) => {
      const sprite = this.humans[i];
      sprite.setPosition(h.x, h.y + h.h).setFlipX(h.direction < 0).setTexture(h.state === "vampire" ? "npc_glamoured" : h.behavior === "priest" ? "npc_priest" : h.behavior === "hunter" ? "npc_garlic" : "npc_plain");
      if (h.state === "stunned") {
        this.targetGraphic.lineStyle(2, C.gold, 0.8); this.targetGraphic.strokeEllipse(h.x, h.y - 9, 28, 9);
      }
      if (h.state === "human" && h.windup > 0) {
        this.targetGraphic.lineStyle(2, C.gold); this.targetGraphic.strokeCircle(h.x, h.y - 12, 10);
        this.targetGraphic.fillStyle(C.gold); this.targetGraphic.fillRect(h.x - 1, h.y - 18, 2, 8);
      }
      if (h.state === "human" && h.behavior === "priest") {
        const phase = pulseState(w.elapsed, 3.8, h.phase);
        const crossX = h.x + h.direction * 23, crossY = h.y + (phase === "safe" ? 9 : -19);
        this.targetGraphic.fillStyle(phase === "active" ? 0xffe7a6 : C.gold);
        this.targetGraphic.fillRect(crossX - 3, crossY, 6, 30); this.targetGraphic.fillRect(crossX - 12, crossY + 7, 24, 6);
        this.targetGraphic.lineStyle(2, C.gold, phase === "safe" ? 0.16 : 0.9);
        this.targetGraphic.strokeEllipse(h.x, h.y + 8, 100, 75);
        if (phase === "active") { this.targetGraphic.fillStyle(C.gold, 0.28); this.targetGraphic.fillEllipse(h.x, h.y + 8, 100, 75); }
        this.priestLabels[i].setText(phase === "safe" ? "CROSS LOWERED" : phase === "warning" ? "RAISING CROSS" : "CROSS RAISED").setPosition(h.x, h.y - 48);
      }
      this.priestLabels[i]?.setVisible(h.state === "human");
    });
    const nearby = targetHuman(w), biteTarget = targetHuman(w, 30, true);
    const section = sectionAt(w.level, p.x);
    const nextGate = w.level.gates.find((gate) => gate.x > p.x && gate.x - p.x < 210);
    const gateHint = nextGate ? gateState(w, nextGate) === "locked" ? "KEY FIRST · THE GATE IS LOCKED" : "NO RETURN · CROSS TO SEAL THIS SECTION" : null;
    this.hint.setText(w.focus ? "HOLD GLAMOUR · DON'T MOVE" : biteTarget ? `BITE NOW · ${biteTarget.stunned.toFixed(1)}s` : nearby?.state === "stunned" ? "GET CLOSER · BITE BEFORE THEY WAKE" : nearby?.behavior === "priest" && pulseState(w.elapsed, 3.8, nearby.phase) !== "safe" ? "CROSS RAISED · GLAMOUR BLOCKED" : nearby ? "FACE THEM · HOLD GLAMOUR · +2 DIRT" : gateHint || section.hint);
    this.stunButton.bg.setAlpha(canGlamour(w, nearby) && w.stunCooldown === 0 ? 1 : 0.5);
    this.biteButton.bg.setAlpha(biteTarget ? 1 : 0.5);
    this.moveButtons.forEach(({ bg, direction }) => bg.setFillStyle([...this.held.values()].includes(direction) ? 0x384756 : C.panel));
    if (w.hunt) this.renderHunt();
  }
  renderEncounters() {
    const w = this.world, g = this.dynamicGraphic;
    g.clear();
    const gates = this.gateGraphic;
    gates.clear();
    w.level.gates.forEach((gate, i) => {
      const state = gateState(w, gate), color = state === "sealed" ? C.red : state === "locked" ? 0x90d6f5 : C.gold;
      // Full-height bars make the boundary visible while standing or jumping.
      if (state !== "open") {
        gates.fillStyle(color, 0.16); gates.fillRect(gate.x - GATE_HALF_WIDTH, 208, GATE_HALF_WIDTH * 2, FLOOR - 208);
        gates.lineStyle(3, color, 0.9);
        for (const x of [-GATE_HALF_WIDTH, 0, GATE_HALF_WIDTH]) gates.lineBetween(gate.x + x, 208, gate.x + x, FLOOR);
        for (let y = 218; y < FLOOR; y += 38) gates.lineBetween(gate.x - GATE_HALF_WIDTH, y, gate.x + GATE_HALF_WIDTH, y);
      }
      gates.fillStyle(color, 0.9); gates.fillRect(gate.x - 27, FLOOR - 5, 54, 5);
      gates.lineStyle(2, color, 0.65); gates.lineBetween(gate.x - 9, FLOOR - 24, gate.x + 9, FLOOR - 15); gates.lineBetween(gate.x + 9, FLOOR - 15, gate.x - 9, FLOOR - 6);
      gates.fillStyle(C.ink, 0.95); gates.fillRoundedRect(gate.x - 67, 303, 134, 27, 3);
      this.gateLabels[i].setText(state === "sealed" ? "SEALED" : state === "locked" ? "KEY FIRST" : "NO RETURN →").setColor(state === "sealed" ? "#f18599" : state === "locked" ? "#90d6f5" : "#dfb778");
    });
    for (const p of w.level.platforms) {
      if (!p.motion && !p.crumble) continue;
      if (p.motion?.axis === "y") {
        g.lineStyle(2, 0xa99165, 0.5);
        for (const x of [p.x + 9, p.x + p.w - 9]) g.lineBetween(x, p.baseY - p.motion.range - 42, x, p.baseY + p.motion.range + 20);
        g.lineStyle(2, C.gold); g.strokeCircle(p.x + p.w / 2, p.baseY - p.motion.range - 24, 10);
      }
      if (!p.active) { g.lineStyle(1, C.muted, 0.2); g.lineBetween(p.x, p.y, p.x + p.w, p.y); continue; }
      g.fillStyle(p.motion ? 0x427889 : p.crumbleTime > 0 ? 0xa77366 : 0x887d79);
      g.fillRect(p.x, p.y, p.w, 12);
      g.fillStyle(p.motion ? 0x9ed1d9 : 0xc8b39e); g.fillRect(p.x, p.y, p.w, 3);
      if (p.crumble) {
        g.lineStyle(2, 0x352e36); g.lineBetween(p.x + 30, p.y, p.x + 44, p.y + 10); g.lineBetween(p.x + 44, p.y + 10, p.x + 58, p.y + 2);
        if (p.crumbleTime > 0) { g.fillStyle(C.red); g.fillRect(p.x, p.y + 14, p.w * Math.max(0, 1 - p.crumbleTime / 0.9), 3); }
      } else {
        g.lineStyle(2, 0x70a6b2); g.lineBetween(p.x + 8, p.y, p.x + 8, p.y - 15); g.lineBetween(p.x + p.w - 8, p.y, p.x + p.w - 8, p.y - 15);
      }
    }
    w.level.hazards.forEach((h, i) => {
      if (!h.pulse) return;
      const phase = pulseState(w.elapsed, h.period, h.phase);
      if (h.visual === "vent") {
        this.hazardSprites[i].setVisible(false);
        g.fillStyle(0x69867b); g.fillRect(h.x - 24, FLOOR - 7, 48, 7);
        g.lineStyle(2, C.ink); for (let x = h.x - 19; x < h.x + 24; x += 8) g.lineBetween(x, FLOOR - 7, x, FLOOR);
        if (phase !== "safe") {
          g.fillStyle(0xb5cd87, phase === "active" ? 0.6 : 0.15);
          for (let j = 0; j < 4; j++) g.fillEllipse(h.x + (j % 2 ? 5 : -5), FLOOR - 17 - j * 21, 36 + j * 3, 24);
        }
        return;
      }
      this.hazardSprites[i].setAlpha(phase === "safe" ? 0.18 : phase === "warning" ? 0.65 : 1);
      if (phase !== "safe") {
        this.targetGraphic.lineStyle(1, C.gold, 0.8); this.targetGraphic.strokeRect(h.x - h.w / 2, h.y - h.h / 2, h.w, h.h);
        this.targetGraphic.fillStyle(C.gold, phase === "active" ? 0.5 : 0.08); this.targetGraphic.fillRect(h.x - h.w / 2, h.y - h.h / 2, h.w, h.h);
      }
    });
    for (const shot of w.projectiles) {
      this.targetGraphic.fillStyle(0xeee1bb); this.targetGraphic.fillCircle(shot.x, shot.y + 7, 7);
      this.targetGraphic.lineStyle(2, 0x95bb7f); this.targetGraphic.lineBetween(shot.x, shot.y + 2, shot.x + 2, shot.y - 5);
    }
  }
  update(_time, delta) {
    if (this.paused || this.transitioning) return;
    const key = (name) => this.keys[name]?.isDown;
    const move = Math.max(-1, Math.min(1, (key("RIGHT") || key("D") ? 1 : 0) - (key("LEFT") || key("A") || key("Q") ? 1 : 0) + [...this.held.values()].reduce((a, b) => a + b, 0)));
    const frameSeconds = Math.max(0, delta / 1000);
    // Physics work is capped during a slow frame; the sunrise deadline is not.
    advanceClock(this.world, Math.max(0, frameSeconds - 0.05));
    this.accumulator += Math.min(frameSeconds, 0.05);
    while (this.accumulator >= STEP) {
      step(this.world, { move, stun: key("E") || key("J") || this.glamourHeld.size > 0, ...this.pending }, STEP);
      this.pending = {}; this.accumulator -= STEP;
    }
    if (this.world.status === "playing") Sfx.tick(this.world.level.duration - this.world.timeLeft, this.world.timeLeft, this.world.hunt?.phase === "escape");
    this.showEvents(); this.renderWorld();
    if (this.world.status === "safe") this.completeNight();
    else if (this.world.status === "dead") this.showSunrise();
  }
}

class HuntEndScene extends Phaser.Scene {
  constructor() { super("HuntEnd"); }
  init(data) { this.result = data; }
  create() {
    const { world: w, won, reason } = this.result, h = w.hunt;
    vignette(this); Sfx.stop(); Sfx.play(won ? "safe" : "dead");
    label(this, 195, 77, won ? "THE SEAL IS HOME" : "THE CITY REMEMBERS", 12, "#dfb778", true).setOrigin(0.5);
    label(this, 195, 126, won ? VampHunt.result(w) : "Not this night.", won ? 24 : 33).setOrigin(0.5).setWordWrapWidth(345).setAlign("center");
    label(this, 195, 398, won ? "You changed the night." : "There is another way through.", 25).setOrigin(0.5);
    const story = won ? [
      h.lampsOut ? "The lamplighter took away their sight." : "The lamps stayed lit.",
      h.bridgeOpen ? "The watchman made you a road of shadows." : "You made your own way across the roofs.",
      h.bellCut ? "Your coven silenced the bell." : "The bell chased you all the way home.",
    ].join("\n\n") : `${reason || w.reason}\n\n${h.phase === "escape" ? "Take the lower roofs if your blood runs dry.\nTurn the bellringer to slow the ward." : "The high roofs avoid the watch.\nTurn the lamplighter to put out the lights."}`;
    label(this, 195, 448, story, 16, "#b8c5cf").setOrigin(0.5, 0).setWordWrapWidth(330).setAlign("center").setLineSpacing(5);
    label(this, 195, 620, `${w.score.toLocaleString()} POINTS · ${h.allies} ALLIES`, 12, "#dfb778", true).setOrigin(0.5);
    this.leaving = false;
    const retry = () => { if (!this.leaving) { this.leaving = true; this.scene.start("Game", { mode: "bellkeeper", profile: Save.progress(), seed: w.seed }); } };
    button(this, 195, 693, 330, "HUNT AGAIN", retry, true);
    button(this, 195, 757, 330, "BACK TO THE CITY", () => { if (!this.leaving) { this.leaving = true; this.scene.start("Menu"); } });
    onKey(this, "keydown-ENTER", retry);
    this.events.once("shutdown", () => Sfx.stop());
    announce(`${won ? VampHunt.result(w) : "The hunt is over."} ${story}`);
  }
}

class BatScene extends Phaser.Scene {
  constructor() { super("Bat"); }
  init(data = {}) { this.runData = data; }
  fixed(object, depth = 50) { return object.setScrollFactor(0).setDepth(depth); }
  control(...args) {
    const item = button(this, ...args);
    this.fixed(item.bg, 60); this.fixed(item.caption, 61);
    return item;
  }
  create() {
    this.flight = VampBat.createFlight(this.runData);
    this.paused = false; this.transitioning = false; this.accumulator = 0;
    this.held = new Set(); this.pauseObjects = []; this.windowShown = false;
    Sfx.setTheme("roofs");
    this.cameras.main.setBounds(0, 0, this.flight.width + 100, GAME_H); this.cameras.main.setScroll(0, 0);
    const sky = this.fixed(this.add.graphics(), -10);
    sky.fillGradientStyle(0x111524, 0x111524, 0x423b57, 0x423b57, 1); sky.fillRect(0, 0, GAME_W, GAME_H);
    sky.fillStyle(0xe1d6b8); sky.fillCircle(286, 280, 32);
    for (let i = 0; i < 30; i++) { sky.fillStyle(C.cream, 0.4); sky.fillRect((i*83)%390, 205+(i*47)%330, 1, 1); }
    this.dawn = this.fixed(this.add.rectangle(195, 422, 390, 844, 0xf5a568, 0), -8);
    this.scenery = this.add.graphics().setDepth(1); this.batGraphic = this.add.graphics().setDepth(8);
    const f = this.flight;
    this.resident = this.add.image(f.window.x + 28, f.window.y + 18, "npc_plain").setDisplaySize(37, 44).setDepth(4);
    this.fixed(this.add.rectangle(195, 93, 390, 186, C.ink, 0.96));
    this.fixed(label(this, 20, 21, `NIGHT ${f.night} · BAT FLIGHT`, 12, "#dfb778", true));
    this.clock = this.fixed(label(this, 20, 53, "", 18, "#eee5d3", true));
    this.statusText = this.fixed(label(this, 20, 89, "", 11, "#90d9bf", true));
    this.phaseText = this.fixed(label(this, 195, 132, "Reach the open window.", 20).setOrigin(0.5));
    this.note = this.fixed(label(this, 195, 166, "You fly right automatically.", 12, "#acbdc9").setOrigin(0.5).setWordWrapWidth(330).setAlign("center"));
    this.concern = this.fixed(label(this, 195, 240, "", 17).setOrigin(0.5).setWordWrapWidth(345).setAlign("center"));
    this.feedback = this.fixed(label(this, 195, 510, "", 13, "#dfb778").setOrigin(0.5).setWordWrapWidth(340).setAlign("center"));
    this.focusBar = this.fixed(this.add.rectangle(45, 565, 300, 5, C.mint).setOrigin(0, 0.5));
    this.focusBar.setVisible(false);
    this.fixed(this.add.rectangle(195, 738, 390, 212, C.ink, 0.97));
    this.flap = this.control(195, 715, 330, "HOLD TO RISE · SPACE / ↑", () => Sfx.unlock(), true);
    this.flap.bg.on("pointerdown", p => { if (!this.paused) this.held.add(p.id); });
    this.flap.bg.on("pointerout", p => this.held.delete(p.id));
    this.flightHelp = this.fixed(label(this, 195, 778, "Hold SPACE / ↑ to rise.\nRelease to descend.", 14, "#acbdc9").setOrigin(0.5).setAlign("center").setLineSpacing(8), 61);
    this.glamour = this.control(195, 615, 330, "HOLD GLAMOUR · E", () => Sfx.unlock(), true);
    this.glamour.bg.on("pointerdown", p => { if (!this.paused) this.held.add(p.id); });
    this.glamour.bg.on("pointerout", p => this.held.delete(p.id));
    this.glamour.bg.setVisible(false).disableInteractive(); this.glamour.caption.setVisible(false);
    this.choices = f.resident.choices.map((choice, index) => this.control(195, 680 + index * 59, 350, `${index + 1}. ${choice[1]}`, () => this.choose(index)));
    this.choices.forEach(b => { b.bg.setVisible(false).disableInteractive(); b.caption.setVisible(false).setWordWrapWidth(325).setAlign("center"); });
    const pause = button(this, 344, 57, 52, "Ⅱ", () => this.paused ? this.resumeGame() : this.pauseGame());
    [pause.bg, pause.caption].forEach(o => this.fixed(o, 95));
    this.keys = this.input.keyboard.addKeys("SPACE,UP,W,Z,E,J");
    onKey(this, "keydown", e => {
      if (["Space", "ArrowUp", "KeyW", "KeyZ"].includes(e.code)) e.preventDefault?.();
      if (e.repeat) return;
      if (["Escape", "KeyP"].includes(e.code)) { this.paused ? this.resumeGame() : this.pauseGame(); return; }
      if (/^Digit[123]$/.test(e.code)) this.choose(Number(e.code.slice(-1)) - 1);
    });
    this.input.keyboard.addCapture?.(["SPACE", "UP"]);
    const release = p => this.held.delete(p.id);
    this.input.on("pointerup", release); this.input.on("pointerupoutside", release); this.input.on("gameout", () => this.held.clear());
    this.onBlur = () => this.pauseGame(); this.onVisibility = () => { if (document.hidden) this.pauseGame(); };
    window.addEventListener("blur", this.onBlur); document.addEventListener("visibilitychange", this.onVisibility);
    this.events.once("shutdown", () => {
      window.removeEventListener("blur", this.onBlur); document.removeEventListener("visibilitychange", this.onVisibility);
      this.input.removeAllListeners(); this.held.clear(); this.input.keyboard.resetKeys(); Sfx.stop();
    });
    this.renderFlight();
    announce(`Night ${f.night}. You fly right automatically. Hold Space, Up or the rise button to fly higher; release to descend. At the window, hold E or Glamour while the resident is calm, then tap a promise or press 1, 2 or 3.`);
  }
  choose(index) { if (!this.paused && !this.transitioning) VampBat.choose(this.flight, index); }
  pauseGame() {
    if (this.paused || this.transitioning) return;
    this.paused = true; this.held.clear(); this.input.keyboard.resetKeys(); this.flight.focus = 0; Sfx.stop();
    const dim = this.fixed(this.add.rectangle(195, 422, 390, 844, C.ink, 0.97).setInteractive(), 90);
    const title = this.fixed(label(this, 195, 360, "THE SKY CAN WAIT.", 25).setOrigin(0.5), 91);
    const resume = button(this, 195, 450, 330, "RESUME FLIGHT", () => this.resumeGame(), true);
    this.pauseObjects = [dim, title, this.fixed(resume.bg, 91), this.fixed(resume.caption, 91)];
    announce("Flight paused. The sunrise clock is paused too.");
  }
  resumeGame() {
    if (!this.paused || this.transitioning) return;
    this.pauseObjects.forEach(o => o.destroy()); this.pauseObjects = [];
    this.held.clear(); this.input.keyboard.resetKeys(); this.accumulator = 0; this.paused = false;
  }
  renderFlight() {
    const f = this.flight, b = f.bat, g = this.scenery;
    this.cameras.main.scrollX = Math.max(0, Math.min(f.width - 310, b.x - 125));
    this.cameras.main.scrollY = 0;
    g.clear();
    g.fillStyle(0x141d2b); g.fillRect(0, 635, f.width + 250, 50);
    f.obstacles.forEach(o => {
      const upper = o.center - o.gap / 2, lower = o.center + o.gap / 2;
      g.fillStyle(0x2a3043); g.fillRect(o.x, 210, o.w, upper - 210); g.fillRect(o.x, lower, o.w, 640 - lower);
      g.fillStyle(0xab939b); g.fillRect(o.x - 5, upper - 6, o.w + 10, 6); g.fillRect(o.x - 5, lower, o.w + 10, 6);
      g.lineStyle(2, 0x655e77); g.lineBetween(o.x + 14, 220, o.x + 14, upper - 10);
    });
    const win = f.window;
    g.fillStyle(0x2f3448); g.fillRect(win.x + 6, win.y - 90, 170, 660 - win.y);
    g.fillStyle(0xecd19a, 0.16); g.fillCircle(win.x + 25, win.y, 60);
    g.fillStyle(0xc59d69); g.fillRoundedRect(win.x, win.y - 42, 66, 90, 21);
    g.fillStyle(0x34273a); g.fillRoundedRect(win.x + 7, win.y - 34, 52, 76, 17);
    g.fillStyle(0xe1c79a); g.fillRect(win.x - 6, win.y + 46, 78, 6);
    const bat = this.batGraphic; bat.clear(); bat.fillStyle(0x211a30);
    const wing = preferences.reducedMotion ? 8 : Math.sin(f.elapsed * 17) * 13;
    bat.fillTriangle(b.x - 3, b.y, b.x - 29, b.y - wing, b.x - 15, b.y + 10);
    bat.fillTriangle(b.x + 3, b.y, b.x + 29, b.y - wing, b.x + 15, b.y + 10);
    bat.fillEllipse(b.x, b.y, 15, 21); bat.fillTriangle(b.x - 7, b.y - 5, b.x - 6, b.y - 15, b.x, b.y - 7);
    bat.fillStyle(0xf486a0); bat.fillCircle(b.x + 3, b.y - 4, 2);
    const seconds = Math.ceil(f.timeLeft);
    this.clock.setText(`${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")} TO SUNRISE`);
    this.statusText.setText(`${f.lives} COFFINS · ${f.profile.dirt} DIRT · SAME NIGHT CLOCK`);
    this.dawn.setAlpha(Math.max(0, 1 - f.timeLeft / f.level.duration - 0.35) * 0.8);
    if (f.status === "window") {
      if (!this.windowShown) {
        this.windowShown = true; this.held.clear();
        this.flap.bg.setVisible(false).disableInteractive(); this.flap.caption.setVisible(false);
        this.flightHelp.setVisible(false);
        this.glamour.bg.setVisible(true).setInteractive(); this.glamour.caption.setVisible(true);
        this.choices.forEach(b => { b.bg.setVisible(true); b.caption.setVisible(true); });
        this.focusBar.setVisible(true);
      }
      this.phaseText.setText(f.resident.name);
      this.concern.setText(`“${f.resident.concern}”`);
      this.note.setText(f.invitationLeft > 0 ? `Tap a promise or press 1, 2, 3 · ${f.invitationLeft.toFixed(1)}s` : VampBat.calm(f) ? "CALM · HOLD GLAMOUR" : "SUSPICIOUS · WAIT FOR THEIR GAZE TO SOFTEN");
      this.focusBar.setScale(f.invitationLeft > 0 ? f.invitationLeft / 4 : f.focus / 1.1, 1);
      this.choices.forEach(b => {
        b.bg.setAlpha(f.invitationLeft > 0 ? 1 : 0.6);
        if (f.invitationLeft > 0) b.bg.setInteractive(); else b.bg.disableInteractive();
      });
    }
  }
  update(_time, delta) {
    if (this.paused || this.transitioning) return;
    const f = this.flight, seconds = Math.max(0, delta / 1000), key = k => this.keys[k]?.isDown;
    VampBat.advance(f, Math.max(0, seconds - 0.05)); this.accumulator += Math.min(seconds, 0.05);
    while (this.accumulator >= STEP) {
      VampBat.step(f, { flap: key("SPACE") || key("UP") || key("W") || key("Z") || this.held.size > 0, glamour: key("E") || key("J") || this.held.size > 0 }, STEP);
      this.accumulator -= STEP;
    }
    for (const event of f.events.splice(0)) { Sfx.play(event.kind); if (event.text) { announce(event.text); this.feedback.setText(event.text); } }
    this.renderFlight(); Sfx.tick(f.level.duration - f.timeLeft, f.timeLeft);
    if (f.status === "invited" || f.status === "dead") {
      this.transitioning = true; this.held.clear(); Sfx.stop(); Sfx.play(f.status === "invited" ? "safe" : "dead");
      Save.write("vampRunnerProgress", f.profile);
      if (f.status === "dead") {
        Save.write("vampRunnerCampaign", null);
        this.scene.start("Score", { score: f.score, nights: f.night - 1, reason: f.reason, profile: f.profile });
      } else {
        this.concern.setText("Come in, little one.\n+5 dirt · +200 points");
        if (!preferences.reducedMotion) this.tweens.add({ targets: this.batGraphic, x: 70, alpha: 0, duration: 650 });
        this.time.delayedCall(700, () => this.scene.start("Game", { ...this.runData, profile: f.profile, lives: f.lives, score: f.score, timeLeft: f.timeLeft }));
      }
    }
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
    Sfx.play("safe");
    this.cameras.main.setScroll(0, 0);
    vignette(this);
    label(this, 24, 31, this.run.nightNumber % 12 === 0 ? "CAMPAIGN COMPLETE · BLOOD MOON UNLOCKED" : "SAFE UNTIL THE NEXT SUNSET", 10, "#90d9bf", true);
    label(this, 24, 90, this.run.nightNumber % 12 === 0 ? "THE CITY IS YOURS." : `NIGHT ${String(this.run.nightNumber).padStart(2, "0")} SURVIVED.`, 28);
    const next = CAMPAIGN[nightSettings(this.run.nightNumber + 1).chapter];
    label(this, 24, 137, `Next: ${next.name}`, 17, "#acbdc9");
    if (nightSettings(this.run.nightNumber + 1).oneWay) label(this, 24, 164, "ONE WAY · GATES SEAL BEHIND YOU", 11, "#dfb778", true);
    label(this, 24, 190, this.run.score.toLocaleString(), 39);
    label(this, 25, 236, "RUN SCORE", 11, "#acbdc9", true);
    this.balance = label(this, 365, 196, "", 27, "#dfb778").setOrigin(1, 0);
    label(this, 365, 235, "GRAVE DIRT", 11, "#acbdc9", true).setOrigin(1, 0);
    (this.run.contracts || []).forEach((contract, i) => {
      const value = contract.key === "untouched" ? contract.complete ? "perfect" : "missed" : `${contract.value}/${contract.target}`;
      label(this, 24, 261 + i * 19, `${contract.complete ? "✓" : "○"} ${contract.title}: ${value}`, 12, contract.complete ? "#90d9bf" : "#a9bac8");
      if (contract.complete) label(this, 365, 261 + i * 19, `+${contract.reward} dirt`, 12, "#dfb778").setOrigin(1, 0);
    });
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
    this.next = button(this, 195, 724, 342, this.run.nightNumber % 12 === 0 ? "ENTER THE BLOOD MOON →" : "NEXT NIGHT →", () => this.nextNight(), true);
    button(this, 102, 788, 158, "SAVE & QUIT", () => this.returnToMenu());
    button(this, 280, 788, 171, "END RUN & SAVE SCORE", () => this.endRun());
    onKey(this, "keydown-ENTER", () => this.nextNight());
    this.persist();
    this.refreshShop();
    announce(`Night ${this.run.nightNumber} survived. Buy upgrades or press Enter for the next night.`);
  }
  persist() {
    const progressOK = Save.write("vampRunnerProgress", this.run.profile);
    const runOK = Save.write("vampRunnerCampaign", { version: 1, nightNumber: this.run.nightNumber + 1, score: this.run.score, lives: this.run.lives, seed: this.run.seed ?? 1 });
    this.storageOK = progressOK && runOK;
  }
  buy(key) {
    if (this.transitioning || !purchase(this.run.profile, key)) return;
    this.persist(); this.refreshShop(); Sfx.play("blood");
  }
  restoreCoffin() {
    if (this.transitioning || this.run.lives >= MAX_LIVES || this.run.profile.dirt < COFFIN_COST) return;
    this.run.profile.dirt -= COFFIN_COST; this.run.lives++;
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
    this.restore.caption.setText(this.run.lives >= MAX_LIVES ? "3 / 3 COFFINS · RESTED" : `COFFINS ${this.run.lives}/3 · RESTORE FOR ${COFFIN_COST} DIRT`);
    this.restore.bg.setAlpha(this.run.lives >= MAX_LIVES || this.run.profile.dirt < COFFIN_COST ? 0.4 : 1);
    this.saveNote.setText(this.storageOK ? "Next night saved. You can come back later." : "Browser saving unavailable · kept for this session.");
  }
  nextNight() {
    if (this.transitioning) return;
    this.transitioning = true;
    this.scene.start("Bat", { nightNumber: this.run.nightNumber + 1, score: this.run.score, lives: this.run.lives, seed: this.run.seed ?? 1, profile: this.run.profile });
  }
  returnToMenu() {
    if (this.transitioning) return;
    this.transitioning = true;
    this.persist();
    this.scene.start("Menu");
  }
  endRun() {
    if (this.transitioning) return;
    this.transitioning = true;
    Save.write("vampRunnerCampaign", null);
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
      () => this.replay(),
      true,
    );
    button(this, 195, 790, 342, "BACK TO THE CITY", () =>
      this.scene.start("Menu"),
    );
    onKey(this, "keydown", (e) => {
      if (e.repeat) return;
      if (e.key === "Enter") {
        this.replay();
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
  replay() {
    Save.write("vampRunnerCampaign", null);
    this.scene.start("Game", { seed: Math.floor(Math.random() * 0xffffffff), profile: this.profile });
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
  scene: [BootScene, MenuScene, GameScene, HuntEndScene, BatScene, CryptScene, ScoreScene],
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
};
if (typeof module !== "undefined" && module.exports)
  module.exports = {
    BootScene,
    MenuScene,
    GameScene,
    HuntEndScene,
    BatScene,
    CryptScene,
    ScoreScene,
    Save,
    config,
  };
else new Phaser.Game(config);
