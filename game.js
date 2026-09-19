// Vamp Runner — Nightfall. Phaser 3.60, generated artwork, no build step.
/* global Phaser, VampRules */
const {
  TILE,
  MAP_COLS,
  MAP_ROWS,
  MAP_W,
  MAP_H,
  PLAYER_SPEED,
  GARLIC_HITS_PER_LIFE,
  MAX_LIVES,
  NPC_SPEED,
  PRIEST_SPEED,
  buildLevelData,
  getNPCSpawns,
  nightSettings,
  timeRatio,
  sunlightBoundary,
  nightScore,
  movementVector,
  nearestOpenCell,
  findPath,
  clearSight,
  cleanScores,
} = VampRules;
const GAME_W = 390,
  GAME_H = 844;
const GLAMOUR_DISTANCE = 112,
  DASH_SPEED = 480,
  DASH_LENGTH = 0.19,
  DASH_COOLDOWN = 3.5;
const DISTRICTS = ["OLD QUARTER", "CATHEDRAL WARD", "HOLLOW GARDENS"];
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
    .setInteractive({ useHandCursor: true });
  const caption = label(
    scene,
    x,
    y,
    text,
    13,
    primary ? "#ffffff" : "#eee5d3",
    true,
  ).setOrigin(0.5);
  bg.on("pointerover", () => bg.setFillStyle(primary ? 0xe15d75 : 0x263344));
  bg.on("pointerout", () => bg.setFillStyle(primary ? C.red : C.panel));
  bg.on("pointerdown", (pointer, lx, ly, event) => {
    event?.stopPropagation();
    callback();
  });
  return { bg, caption };
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
      "Green crypt: home. Cross: lose a coffin.\nThree garlic hits: lose a coffin. Blood: heal.",
      14,
      "#afbec9",
    ).setLineSpacing(6);
    const rows = [
      ["01", "MOVE", "Arrow keys, WASD / ZQSD, or drag."],
      ["02", "SHADOW DASH", "Space / Shift. Slip past danger."],
      ["03", "GLAMOUR", "E or tap a nearby blue civilian."],
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
    this.input.keyboard.on("keydown-ENTER", () => this.startRun());
    this.input.keyboard.on("keydown-SPACE", () => this.startRun());
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
    Sfx.play("glamour");
    this.scene.start("Game");
  }
}

class GameScene extends Phaser.Scene {
  constructor() {
    super("Game");
  }
  init(data = {}) {
    this.nightNumber = data.nightNumber || 1;
    this.accumulatedScore = data.accumulatedScore || 0;
    this.lives = data.lives ?? MAX_LIVES;
  }
  create() {
    const settings = nightSettings(this.nightNumber);
    this.time.paused = false;
    this.physics.resume();
    this.tweens.resumeAll();
    this.effectiveDuration = settings.duration;
    this.npcSpeedMult = settings.speed;
    this.variant = settings.variant;
    this.timeLeft = this.effectiveDuration;
    this.garlicHits = 0;
    this.gameOver = false;
    this.paused = false;
    this.invulnerableFor = 0;
    this.dashFor = 0;
    this.dashCooldown = 0;
    this.facing = { x: 0, y: -1 };
    this.syringesCollected = 0;
    this.glamouredEver = 0;
    this.livesLost = 0;
    this.trailTimer = 0;
    this.warningShown = false;
    this.levelData = buildLevelData(this.variant);
    this.cameras.main.setBackgroundColor("#0b1018");
    this.buildWorld();
    this.spawnPlayer();
    this.spawnNPCs();
    this.sunlightGraphic = this.add.graphics().setDepth(5);
    this.targetGraphic = this.add.graphics().setDepth(4);
    // Extra space keeps the crypt above the player, clear of the HUD and controls.
    this.cameras.main.setBounds(0, -150, MAP_W, MAP_H + 300);
    this.cameras.main.startFollow(this.player, true, 0.13, 0.13);
    this.buildUI();
    this.buildControls();
    this.physics.add.collider(this.player, this.walls);
    this.physics.add.overlap(this.player, this.npcGroup, (_player, sprite) =>
      this.touchNPC(sprite.npc),
    );
    this.physics.add.overlap(
      this.player,
      this.syringes,
      this.collectSyringe,
      null,
      this,
    );
    this.physics.add.overlap(this.player, this.shelterGroup, () =>
      this.triggerNightComplete(),
    );
    this.updateUI();
    this.updateSunlight();
    this.showBanner(
      "NIGHT " +
        String(this.nightNumber).padStart(2, "0") +
        " · " +
        DISTRICTS[this.variant],
      "Head north. The crypt is waiting.",
    );
    this.onBlur = () => this.pauseGame();
    this.onVisibility = () => {
      if (document.hidden) this.pauseGame();
    };
    window.addEventListener("blur", this.onBlur);
    document.addEventListener("visibilitychange", this.onVisibility);
    this.events.once("shutdown", () => {
      window.removeEventListener("blur", this.onBlur);
      document.removeEventListener("visibilitychange", this.onVisibility);
      this.time.paused = false;
    });
    announce(
      "Night " + this.nightNumber + ". Reach the northern crypt before dawn.",
    );
  }
  buildWorld() {
    this.walls = this.physics.add.staticGroup();
    this.syringes = this.physics.add.staticGroup();
    this.shelterGroup = this.physics.add.staticGroup();
    for (let r = 0; r < MAP_ROWS; r++)
      for (let c = 0; c < MAP_COLS; c++) {
        const x = c * TILE + 20,
          y = r * TILE + 20,
          cell = this.levelData[r][c];
        this.add
          .image(x, y, "floor")
          .setDepth(0)
          .setAlpha(0.88 + ((r * 7 + c * 13) % 4) * 0.03);
        if (cell === 1)
          this.walls.create(x, y, "wall").setDepth(1).refreshBody();
        if (cell === 4) {
          const pickup = this.syringes
            .create(x, y, "syringe")
            .setDepth(1)
            .refreshBody()
            .setCircle(12, 8, 8);
          if (!preferences.reducedMotion)
            this.tweens.add({
              targets: pickup,
              alpha: 0.55,
              duration: 1100,
              yoyo: true,
              repeat: -1,
              delay: (r % 3) * 200,
            });
        }
        if (cell === 5) {
          this.shelter = this.shelterGroup
            .create(x, y, "shelter")
            .setDepth(2)
            .refreshBody();
          label(this, x, y - 37, "THE CRYPT", 11, "#90d9bf", true)
            .setOrigin(0.5)
            .setDepth(3);
          const halo = this.add.circle(x, y, 33, C.mint, 0.08).setDepth(1);
          if (!preferences.reducedMotion)
            this.tweens.add({
              targets: halo,
              scale: 1.25,
              alpha: 0.02,
              duration: 1700,
              repeat: -1,
              yoyo: true,
            });
        }
      }
    const lamps = this.add.graphics().setDepth(1);
    for (let r = 3; r < MAP_ROWS - 2; r += 6)
      for (const c of [2, 17]) {
        if (this.levelData[r][c] === 1) continue;
        const x = c * TILE + 20,
          y = r * TILE + 20;
        for (let i = 3; i > 0; i--) {
          lamps.fillStyle(C.gold, 0.02);
          lamps.fillCircle(x, y, 18 * i);
        }
        lamps.fillStyle(C.gold, 0.75);
        lamps.fillCircle(x, y, 2);
      }
  }
  spawnPlayer() {
    this.player = this.physics.add
      .image(10 * TILE + 20, (MAP_ROWS - 3) * TILE + 20, "player")
      .setDepth(3)
      .setCircle(10, 6, 10)
      .setCollideWorldBounds(true);
    this.physics.world.setBounds(0, 0, MAP_W, MAP_H);
  }
  spawnNPCs() {
    this.npcs = [];
    this.npcGroup = this.physics.add.group();
    const occupied = new Set();
    getNPCSpawns(this.variant).forEach(({ r, c, type }) => {
      let cell = nearestOpenCell(this.levelData, r, c);
      // Keep the centre of the spawn tile clear, even in the tighter district.
      if (occupied.has(cell.r + "," + cell.c)) {
        const copy = this.levelData.map((row) => row.slice());
        occupied.forEach((key) => {
          const [rr, cc] = key.split(",").map(Number);
          copy[rr][cc] = 1;
        });
        cell = nearestOpenCell(copy, r, c);
      }
      occupied.add(cell.r + "," + cell.c);
      const sprite = this.physics.add
        .image(cell.c * TILE + 20, cell.r * TILE + 20, "npc_" + type)
        .setDepth(2)
        .setCircle(10, 6, 10)
        .setCollideWorldBounds(true);
      this.npcGroup.add(sprite);
      this.physics.add.collider(sprite, this.walls);
      const npc = {
        sprite,
        type,
        glamoured: false,
        stunTimer: 0,
        dirTimer: 0,
        path: [],
        chasing: false,
      };
      sprite.npc = npc;
      this.npcs.push(npc);
    });
  }
  nearestSyringe(x, y) {
    let best = null,
      dist = Infinity;
    this.syringes.getChildren().forEach((s) => {
      const d = Phaser.Math.Distance.Between(x, y, s.x, s.y);
      if (s.active && d < dist) {
        best = s;
        dist = d;
      }
    });
    return best;
  }
  routeNPC(npc) {
    const from = {
      r: Math.floor(npc.sprite.y / TILE),
      c: Math.floor(npc.sprite.x / TILE),
    };
    const distance = Phaser.Math.Distance.Between(
      npc.sprite.x,
      npc.sprite.y,
      this.player.x,
      this.player.y,
    );
    npc.chasing = npc.type === "priest" && !npc.glamoured && distance < 240;
    let destination;
    if (npc.glamoured)
      destination =
        this.nearestSyringe(npc.sprite.x, npc.sprite.y) || this.player;
    else if (npc.chasing) destination = this.player;
    else {
      const target = nearestOpenCell(
        this.levelData,
        from.r + Phaser.Math.Between(-3, 3),
        from.c + Phaser.Math.Between(-3, 3),
      );
      destination = { x: target.c * TILE + 20, y: target.r * TILE + 20 };
    }
    const to = {
      r: Math.floor(destination.y / TILE),
      c: Math.floor(destination.x / TILE),
    };
    npc.path = findPath(this.levelData, from, to).map((p) => ({
      x: p.c * TILE + 20,
      y: p.r * TILE + 20,
    }));
    if (
      npc.path.length &&
      Phaser.Math.Distance.Between(
        npc.sprite.x,
        npc.sprite.y,
        npc.path[0].x,
        npc.path[0].y,
      ) < 8
    )
      npc.path.shift();
    npc.dirTimer = npc.glamoured ? 900 : npc.chasing ? 1100 : 2200;
  }
  updateNPCs(delta) {
    for (const npc of this.npcs) {
      if (!npc.sprite.active) continue;
      if (npc.stunTimer > 0) {
        npc.stunTimer = Math.max(0, npc.stunTimer - delta);
        npc.sprite.setVelocity(0, 0);
        if (npc.stunTimer === 0) npc.sprite.clearTint();
        continue;
      }
      npc.dirTimer -= delta;
      // Finish the current waypoint before replanning to avoid backtracking mid-tile.
      if (
        npc.dirTimer <= 0 &&
        (npc.path.length === 0 ||
          Phaser.Math.Distance.Between(
            npc.sprite.x,
            npc.sprite.y,
            npc.path[0].x,
            npc.path[0].y,
          ) < 7)
      )
        this.routeNPC(npc);
      let next = npc.path[0];
      if (
        next &&
        Phaser.Math.Distance.Between(
          npc.sprite.x,
          npc.sprite.y,
          next.x,
          next.y,
        ) < 5
      ) {
        npc.path.shift();
        next = npc.path[0];
      }
      if (next) {
        const dx = next.x - npc.sprite.x,
          dy = next.y - npc.sprite.y,
          len = Math.hypot(dx, dy) || 1;
        const speed =
          (npc.glamoured
            ? NPC_SPEED * 1.5
            : npc.type === "priest"
              ? PRIEST_SPEED
              : NPC_SPEED) * this.npcSpeedMult;
        npc.sprite.setVelocity((dx / len) * speed, (dy / len) * speed);
        if (Math.abs(dx) > 3) npc.sprite.setFlipX(dx < 0);
      } else npc.sprite.setVelocity(0, 0);
      if (!npc.glamoured) continue;
      const nearby = this.nearestSyringe(npc.sprite.x, npc.sprite.y);
      if (
        nearby &&
        Phaser.Math.Distance.Between(
          npc.sprite.x,
          npc.sprite.y,
          nearby.x,
          nearby.y,
        ) < 25
      )
        this.collectSyringe(npc.sprite, nearby);
      this.npcs.forEach((other) => {
        if (
          other.type === "priest" &&
          !other.glamoured &&
          other.stunTimer === 0 &&
          Phaser.Math.Distance.Between(
            npc.sprite.x,
            npc.sprite.y,
            other.sprite.x,
            other.sprite.y,
          ) < 48 &&
          clearSight(this.levelData, npc.sprite, other.sprite)
        ) {
          other.stunTimer = 2500;
          other.sprite.setTint(C.mint);
          other.sprite.setVelocity(0, 0);
          this.floatText(
            other.sprite.x,
            other.sprite.y - 15,
            "STUNNED",
            "#90d9bf",
          );
        }
      });
    }
  }
  eligibleTarget(npc) {
    return (
      npc.type === "plain" &&
      !npc.glamoured &&
      npc.sprite.active &&
      Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        npc.sprite.x,
        npc.sprite.y,
      ) <= GLAMOUR_DISTANCE &&
      clearSight(this.levelData, this.player, npc.sprite)
    );
  }
  nearestGlamourTarget() {
    return (
      this.npcs
        .filter((n) => this.eligibleTarget(n))
        .sort(
          (a, b) =>
            Phaser.Math.Distance.Between(
              this.player.x,
              this.player.y,
              a.sprite.x,
              a.sprite.y,
            ) -
            Phaser.Math.Distance.Between(
              this.player.x,
              this.player.y,
              b.sprite.x,
              b.sprite.y,
            ),
        )[0] || null
    );
  }
  glamourNPC(npc = this.nearestGlamourTarget()) {
    if (this.gameOver || this.paused) return;
    if (!npc || !this.eligibleTarget(npc)) {
      this.controlMessage("Get closer to a blue civilian.");
      return;
    }
    npc.glamoured = true;
    npc.sprite.setTexture("npc_glamoured");
    npc.dirTimer = 0;
    npc.path = [];
    this.glamouredEver++;
    this.updateUI();
    Sfx.play("glamour");
    this.burst(npc.sprite.x, npc.sprite.y, C.mint);
    this.floatText(
      npc.sprite.x,
      npc.sprite.y - 12,
      "AN ALLY, AT LAST",
      "#90d9bf",
    );
  }
  buildUI() {
    const hud = this.add.graphics().setScrollFactor(0).setDepth(10);
    hud.fillStyle(C.ink, 0.96);
    hud.fillRoundedRect(12, 12, 366, 134, 12);
    hud.lineStyle(1, C.line, 0.7);
    hud.strokeRoundedRect(12, 12, 366, 134, 12);
    label(
      this,
      24,
      25,
      "NIGHT " +
        String(this.nightNumber).padStart(2, "0") +
        " / " +
        DISTRICTS[this.variant],
      10,
      "#a5b5c4",
      true,
    )
      .setScrollFactor(0)
      .setDepth(11);
    this.timerText = label(this, 24, 48, "", 32)
      .setScrollFactor(0)
      .setDepth(11);
    label(this, 130, 64, "UNTIL DAWN", 10, "#b5a488", true)
      .setScrollFactor(0)
      .setDepth(11);
    this.add
      .rectangle(24, 92, 342, 4, 0x344351)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(11);
    this.timerBar = this.add
      .rectangle(24, 92, 342, 4, C.gold)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(12);
    this.livesText = label(this, 24, 110, "", 12, "#ecb0bc", true)
      .setScrollFactor(0)
      .setDepth(11);
    this.garlicText = label(this, 168, 111, "", 11, "#d6c78b", true)
      .setScrollFactor(0)
      .setDepth(11);
    this.scoreText = label(this, 366, 112, "", 11, "#eee5d3", true)
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(11);
    const pause = this.add
      .rectangle(350, 59, 42, 42, C.panel)
      .setStrokeStyle(1, C.line)
      .setInteractive({ useHandCursor: true })
      .setScrollFactor(0)
      .setDepth(12);
    label(this, 350, 59, "Ⅱ", 20)
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(12);
    pause.on("pointerdown", (_p, _x, _y, e) => {
      e?.stopPropagation();
      this.pauseGame();
    });
    this.cryptText = label(this, 195, 159, "", 11, "#90d9bf", true)
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(11);
    this.minimap = this.add.graphics().setScrollFactor(0).setDepth(11);
    this.footer = this.add
      .rectangle(195, 786, 390, 116, C.ink, 0.88)
      .setScrollFactor(0)
      .setDepth(10);
    label(this, 25, 717, "MOVE", 10, "#90a5b6", true)
      .setScrollFactor(0)
      .setDepth(11);
    label(this, 169, 815, "P / ESC · PAUSE", 9, "#8e9cac", true)
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(11);
    this.glamourStatus = label(this, 195, 687, "", 11, "#90d9bf", true)
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(11);
  }
  updateUI() {
    const ratio = timeRatio(this.timeLeft, this.effectiveDuration),
      seconds = Math.ceil(this.timeLeft);
    this.timerText.setText(
      Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0"),
    );
    this.timerText.setColor(seconds <= 15 ? "#f38a94" : "#eee5d3");
    this.timerBar.width = 342 * ratio;
    this.timerBar.setFillStyle(seconds <= 15 ? C.red : C.gold);
    this.livesText.setText("COFFINS " + this.lives + "/3");
    this.garlicText.setText("GARLIC " + this.garlicHits + "/3");
    this.scoreText.setText(
      (
        this.accumulatedScore + this.calculateNightScore(false)
      ).toLocaleString(),
    );
  }
  buildControls() {
    this.joystick = {
      active: false,
      pointerId: null,
      baseX: 85,
      baseY: 783,
      dx: 0,
      dy: 0,
    };
    this.joyBase = this.add
      .circle(85, 783, 44, 0x334a59, 0.28)
      .setStrokeStyle(1, 0x5f7988, 0.7)
      .setScrollFactor(0)
      .setDepth(12);
    this.joyStick = this.add
      .circle(85, 783, 18, 0x829aaa, 0.4)
      .setScrollFactor(0)
      .setDepth(13);
    this.dashButton = this.add
      .circle(322, 737, 31, 0x502e43, 0.9)
      .setStrokeStyle(1, C.red)
      .setScrollFactor(0)
      .setDepth(12)
      .setInteractive({ useHandCursor: true });
    this.dashLabel = label(this, 322, 737, "DASH", 11, "#f5bac5", true)
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(13);
    label(this, 322, 777, "SPACE", 8, "#b0a1b0", true)
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(13);
    this.glamourButton = this.add
      .circle(245, 781, 29, 0x26453f, 0.9)
      .setStrokeStyle(1, C.mint)
      .setScrollFactor(0)
      .setDepth(12)
      .setInteractive({ useHandCursor: true });
    label(this, 245, 779, "CHARM", 9, "#bbe7d6", true)
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(13);
    label(this, 245, 821, "E", 8, "#b1c9c0", true)
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(13);
    this.dashButton.on("pointerdown", (_p, _x, _y, e) => {
      e?.stopPropagation();
      this.startDash();
    });
    this.glamourButton.on("pointerdown", (_p, _x, _y, e) => {
      e?.stopPropagation();
      this.glamourNPC();
    });
    this.keys = this.input.keyboard.addKeys("W,A,S,D,Z,Q,UP,DOWN,LEFT,RIGHT");
    this.input.keyboard.on("keydown", (event) => {
      if (event.repeat) return;
      if (["Escape", "KeyP"].includes(event.code)) {
        this.paused ? this.resumeGame() : this.pauseGame();
        return;
      }
      if (this.paused || this.gameOver) return;
      if (["Space", "ShiftLeft", "ShiftRight"].includes(event.code)) {
        event.preventDefault();
        this.startDash();
      }
      if (event.code === "KeyE") this.glamourNPC();
    });
    this.input.on("pointerdown", (p) => {
      if (this.gameOver || this.paused || p.y < 185) return;
      // Action buttons own the right-hand control area; movement cannot swallow them.
      if (p.x > 180 && p.y > 690) return;
      const world = this.cameras.main.getWorldPoint(p.x, p.y);
      const target = this.npcs.find(
        (n) =>
          this.eligibleTarget(n) &&
          Phaser.Math.Distance.Between(
            world.x,
            world.y,
            n.sprite.x,
            n.sprite.y,
          ) < 25,
      );
      if (target && p.y < 690) {
        this.glamourNPC(target);
        return;
      }
      if (this.joystick.active) return;
      Object.assign(this.joystick, {
        active: true,
        pointerId: p.id,
        baseX: p.x,
        baseY: p.y,
      });
      this.joyBase.setPosition(p.x, p.y);
      this.joyStick.setPosition(p.x, p.y);
    });
    this.input.on("pointermove", (p) => {
      if (!this.joystick.active || this.joystick.pointerId !== p.id) return;
      const dx = p.x - this.joystick.baseX,
        dy = p.y - this.joystick.baseY,
        dist = Math.hypot(dx, dy);
      const strength = Math.min(1, Math.max(0, (dist - 7) / 36)),
        len = dist || 1;
      this.joystick.dx = (dx / len) * strength;
      this.joystick.dy = (dy / len) * strength;
      this.joyStick.setPosition(
        this.joystick.baseX + (dx / len) * Math.min(40, dist),
        this.joystick.baseY + (dy / len) * Math.min(40, dist),
      );
    });
    const release = (p) => {
      if (p.id === this.joystick.pointerId) this.resetMovement();
    };
    this.input.on("pointerup", release);
    this.input.on("pointerupoutside", release);
    this.input.on("gameout", () => this.resetMovement());
  }
  resetMovement() {
    if (!this.joystick) return;
    Object.assign(this.joystick, {
      active: false,
      pointerId: null,
      dx: 0,
      dy: 0,
    });
    this.joyBase.setPosition(85, 783);
    this.joyStick.setPosition(85, 783);
  }
  movement() {
    const k = this.keys;
    const x =
      Number(k.RIGHT.isDown || k.D.isDown) -
      Number(k.LEFT.isDown || k.A.isDown || k.Q.isDown);
    const y =
      Number(k.DOWN.isDown || k.S.isDown) -
      Number(k.UP.isDown || k.W.isDown || k.Z.isDown);
    return x || y
      ? movementVector(x, y)
      : movementVector(this.joystick.dx, this.joystick.dy);
  }
  startDash() {
    if (this.paused || this.gameOver || this.dashCooldown > 0) return;
    const movement = this.movement(),
      length = Math.hypot(movement.x, movement.y);
    this.dashDirection = length
      ? { x: movement.x / length, y: movement.y / length }
      : { ...this.facing };
    this.dashFor = DASH_LENGTH;
    this.dashCooldown = DASH_COOLDOWN;
    Sfx.play("dash");
    this.burst(this.player.x, this.player.y, C.red, 7);
  }
  touchNPC(npc) {
    if (!npc || npc.glamoured || npc.stunTimer > 0 || this.isProtected())
      return;
    if (npc.type === "priest") this.loseLife("A hunter’s cross found you.");
    if (npc.type === "garlic") {
      this.garlicHits++;
      this.invulnerableFor = 1.5;
      if (this.garlicHits >= GARLIC_HITS_PER_LIFE) {
        this.garlicHits = 0;
        this.loseLife("Too much garlic. Too little time.");
      } else {
        this.feedbackHit();
        this.floatText(
          this.player.x,
          this.player.y - 15,
          "GARLIC " + this.garlicHits + "/3",
          "#e4cc85",
        );
      }
      this.updateUI();
    }
  }
  isProtected() {
    return (
      this.gameOver ||
      this.paused ||
      this.invulnerableFor > 0 ||
      this.dashFor > 0
    );
  }
  collectSyringe(_collector, syringe) {
    if (this.gameOver || this.paused || !syringe.active) return;
    const { x, y } = syringe;
    this.tweens.killTweensOf(syringe);
    syringe.destroy();
    this.syringesCollected++;
    this.garlicHits = Math.max(0, this.garlicHits - 1);
    this.dashCooldown = Math.max(0, this.dashCooldown - 1.2);
    this.floatText(x, y - 10, "+300 · BLOOD", "#f5a0af");
    this.burst(x, y, C.red, 6);
    this.updateUI();
    Sfx.play("blood");
  }
  loseLife(reason) {
    if (this.gameOver || this.paused) return;
    this.lives = Math.max(0, this.lives - 1);
    this.livesLost++;
    this.invulnerableFor = 2;
    this.feedbackHit();
    this.updateUI();
    if (this.lives === 0) this.triggerLose(reason);
    else
      this.floatText(
        this.player.x,
        this.player.y - 15,
        "ONE COFFIN LOST",
        "#f6a5b2",
      );
  }
  feedbackHit() {
    if (!preferences.reducedMotion) this.cameras.main.shake(170, 0.005);
    this.burst(this.player.x, this.player.y, C.red);
    Sfx.play("hit");
  }
  updateSunlight() {
    this.sunline = sunlightBoundary(this.timeLeft, this.effectiveDuration);
    const g = this.sunlightGraphic;
    g.clear();
    if (this.sunline >= MAP_H) return;
    g.fillStyle(0xdf8d44, 0.25);
    g.fillRect(0, this.sunline, MAP_W, MAP_H - this.sunline);
    for (let i = 0; i < 5; i++) {
      g.fillStyle(C.gold, 0.04 + i * 0.02);
      g.fillRect(0, this.sunline + i * 8, MAP_W, 8);
    }
    g.fillStyle(C.gold, 0.75);
    g.fillRect(0, this.sunline, MAP_W, 2);
  }
  calculateNightScore(survived = false) {
    return nightScore(
      {
        night: this.nightNumber,
        timeLeft: this.timeLeft,
        blood: this.syringesCollected,
        allies: this.glamouredEver,
        lost: this.livesLost,
      },
      survived,
    );
  }
  stopRun() {
    this.gameOver = true;
    this.resetMovement();
    this.player.setVelocity(0, 0);
    this.player.setAlpha(1);
    this.npcs.forEach((n) => n.sprite.setVelocity(0, 0));
    this.physics.pause();
    this.tweens.killTweensOf(this.player);
  }
  triggerNightComplete() {
    if (this.gameOver || this.paused) return;
    this.stopRun();
    const points = this.calculateNightScore(true),
      total = this.accumulatedScore + points;
    this.accumulatedScore = total;
    Sfx.play("safe");
    const bonusLife = this.nightNumber % 3 === 0 && this.lives < MAX_LIVES;
    if (bonusLife) this.lives++;
    this.makeOverlay(
      "THE CRYPT IS YOURS.",
      "Night " + this.nightNumber + " survived.",
      [
        ["Time remaining", Math.ceil(this.timeLeft) + " seconds"],
        ["Blood collected", String(this.syringesCollected)],
        ["Allies charmed", String(this.glamouredEver)],
        ["Night score", "+" + points.toLocaleString()],
        ["Run total", total.toLocaleString()],
      ],
      bonusLife
        ? "A third night survived. One coffin restored."
        : "The city will be less forgiving tomorrow.",
    );
    this.overlayButton(570, "NEXT NIGHT  →", () => this.nextNight(), true);
    this.overlayButton(
      634,
      "END RUN & SAVE",
      () => this.finishRun(total, this.nightNumber, "You chose to sleep."),
      false,
    );
    this.input.keyboard.once("keydown-ENTER", () => this.nextNight());
    announce(
      "Night survived. " + points + " points. Press Enter for the next night.",
    );
  }
  nextNight() {
    if (!this.gameOver) return;
    this.scene.restart({
      nightNumber: this.nightNumber + 1,
      accumulatedScore: this.accumulatedScore,
      lives: this.lives,
    });
  }
  triggerLose(reason) {
    if (this.gameOver) return;
    this.stopRun();
    Sfx.play("hit");
    const score = this.accumulatedScore + this.calculateNightScore(false);
    this.finishRun(score, this.nightNumber - 1, reason);
  }
  finishRun(score, nights, reason) {
    this.scene.start("Score", { score, nights, reason });
  }
  makeOverlay(title, subtitle, rows = [], note = "") {
    this.overlay = this.add.container(0, 0).setScrollFactor(0).setDepth(30);
    const dim = this.add
      .rectangle(195, 422, 390, 844, C.ink, 0.92)
      .setInteractive();
    dim.on("pointerdown", (_p, _x, _y, e) => e?.stopPropagation());
    this.overlay.add(dim);
    this.overlay.add(label(this, 195, 216, title, 25).setOrigin(0.5));
    this.overlay.add(
      label(this, 195, 261, subtitle, 15, "#acbdc9").setOrigin(0.5),
    );
    rows.forEach(([key, val], i) => {
      this.overlay.add(label(this, 40, 315 + i * 33, key, 14, "#a3b5c4"));
      this.overlay.add(
        label(this, 350, 315 + i * 33, val, 14, "#eee5d3", true).setOrigin(
          1,
          0,
        ),
      );
    });
    if (note)
      this.overlay.add(
        label(this, 195, 510, note, 12, "#bca984").setOrigin(0.5),
      );
  }
  overlayButton(y, title, callback, primary = false) {
    const item = button(this, 195, y, 310, title, callback, primary);
    this.overlay.add([item.bg, item.caption]);
    return item;
  }
  pauseGame() {
    if (this.paused || this.gameOver) return;
    this.paused = true;
    this.resetMovement();
    this.input.keyboard.resetKeys();
    this.player.setVelocity(0, 0);
    this.physics.pause();
    this.tweens.pauseAll();
    this.time.paused = true;
    this.makeOverlay(
      "EVEN THE UNDEAD REST.",
      "The night can wait.",
      [
        ["Move", "Arrows / WASD / ZQSD"],
        ["Dash", "Space or Shift"],
        ["Charm nearby civilian", "E"],
        ["Resume", "P or Escape"],
      ],
      "Blood heals garlic damage and recharges dash.",
    );
    this.overlayButton(570, "RESUME THE HUNT", () => this.resumeGame(), true);
    this.overlayButton(634, "SAVE RUN & RETURN", () =>
      this.finishRun(
        this.accumulatedScore + this.calculateNightScore(false),
        this.nightNumber - 1,
        "You returned to the shadows.",
      ),
    );
    announce("Paused. Press Escape to resume.");
  }
  resumeGame() {
    if (!this.paused || this.gameOver) return;
    this.overlay.destroy();
    this.overlay = null;
    this.input.keyboard.resetKeys();
    this.resetMovement();
    this.time.paused = false;
    this.tweens.resumeAll();
    this.physics.resume();
    this.paused = false;
    announce("Resumed.");
  }
  showBanner(title, subtitle) {
    const box = this.add.container(0, 0).setScrollFactor(0).setDepth(20);
    box.add(
      this.add
        .rectangle(195, 270, 354, 92, C.ink, 0.9)
        .setStrokeStyle(1, C.line),
    );
    box.add(label(this, 195, 252, title, 12, "#dfb778", true).setOrigin(0.5));
    box.add(label(this, 195, 282, subtitle, 15).setOrigin(0.5));
    this.tweens.add({
      targets: box,
      alpha: 0,
      delay: 2300,
      duration: preferences.reducedMotion ? 0 : 600,
      onComplete: () => box.destroy(),
    });
  }
  controlMessage(text) {
    if (this.lastMessage && this.time.now - this.lastMessage < 1000) return;
    this.lastMessage = this.time.now;
    const txt = label(this, 195, 656, text, 12, "#eee5d3")
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(18);
    this.tweens.add({
      targets: txt,
      alpha: 0,
      delay: 1200,
      duration: 400,
      onComplete: () => txt.destroy(),
    });
  }
  floatText(x, y, text, color) {
    const txt = label(this, x, y, text, 10, color, true)
      .setOrigin(0.5)
      .setDepth(8);
    this.tweens.add({
      targets: txt,
      y: y - (preferences.reducedMotion ? 0 : 28),
      alpha: 0,
      delay: 250,
      duration: 650,
      onComplete: () => txt.destroy(),
    });
  }
  burst(x, y, color, count = 10) {
    if (preferences.reducedMotion) return;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2,
        particle = this.add.circle(x, y, 1.5, color).setDepth(4);
      this.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * 24,
        y: y + Math.sin(angle) * 24,
        alpha: 0,
        duration: 370,
        onComplete: () => particle.destroy(),
      });
    }
  }
  updateRadar() {
    const g = this.minimap,
      scale = 2,
      x = 24,
      y = 187;
    g.clear();
    g.fillStyle(C.ink, 0.85);
    g.fillRoundedRect(x - 5, y - 5, 50, 70, 4);
    for (let r = 0; r < MAP_ROWS; r++)
      for (let c = 0; c < MAP_COLS; c++)
        if (this.levelData[r][c] === 1) {
          g.fillStyle(0x5c6e7b, 0.7);
          g.fillRect(x + c * scale, y + r * scale, scale, scale);
        }
    g.fillStyle(C.mint);
    g.fillCircle(x + 10.5 * scale, y + 1.5 * scale, 2.5);
    g.lineStyle(1, C.gold);
    g.lineBetween(
      x,
      y + (this.sunline / TILE) * scale,
      x + 40,
      y + (this.sunline / TILE) * scale,
    );
    g.fillStyle(0xffa0b2);
    g.fillCircle(
      x + (this.player.x / TILE) * scale,
      y + (this.player.y / TILE) * scale,
      2,
    );
    const delta = this.shelter.y - this.player.y,
      arrow = delta < -20 ? "↑" : delta > 20 ? "↓" : "◆";
    this.cryptText.setText(
      "CRYPT " +
        arrow +
        "  " +
        Math.round(
          Phaser.Math.Distance.Between(
            this.player.x,
            this.player.y,
            this.shelter.x,
            this.shelter.y,
          ) / 10,
        ) +
        "m",
    );
  }
  update(time, delta) {
    if (this.gameOver || this.paused) return;
    const dt = Math.min(delta, 50) / 1000;
    this.timeLeft = Math.max(0, this.timeLeft - dt);
    this.invulnerableFor = Math.max(0, this.invulnerableFor - dt);
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    this.dashFor = Math.max(0, this.dashFor - dt);
    if (this.timeLeft <= 0) {
      this.triggerLose("Dawn found you outside the crypt.");
      return;
    }
    const movement = this.movement(),
      length = Math.hypot(movement.x, movement.y);
    if (length > 0.01)
      this.facing = { x: movement.x / length, y: movement.y / length };
    const direction = this.dashFor > 0 ? this.dashDirection : movement,
      speed = this.dashFor > 0 ? DASH_SPEED : PLAYER_SPEED;
    this.player.setVelocity(direction.x * speed, direction.y * speed);
    if (direction.x) this.player.setFlipX(direction.x < 0);
    this.player.setTexture(
      length > 0 && Math.floor(time / 130) % 2 ? "player_step" : "player",
    );
    this.player.setAlpha(
      this.invulnerableFor > 0
        ? preferences.reducedMotion
          ? 0.65
          : Math.floor(time / 100) % 2
            ? 0.4
            : 1
        : 1,
    );
    this.trailTimer -= dt;
    if (
      this.dashFor > 0 &&
      this.trailTimer <= 0 &&
      !preferences.reducedMotion
    ) {
      this.trailTimer = 0.04;
      const ghost = this.add
        .image(this.player.x, this.player.y, "player")
        .setTint(C.red)
        .setAlpha(0.35)
        .setDepth(2);
      this.tweens.add({
        targets: ghost,
        alpha: 0,
        duration: 240,
        onComplete: () => ghost.destroy(),
      });
    }
    this.updateNPCs(dt * 1000);
    this.updateSunlight();
    if (this.player.y + 10 >= this.sunline && !this.isProtected())
      this.loseLife("You lingered in the sunrise.");
    if (this.gameOver) return;
    if (this.timeLeft <= 15 && !this.warningShown) {
      this.warningShown = true;
      this.showBanner(
        "DAWN IS ALMOST HERE",
        "Forget the blood. Find your coffin.",
      );
      announce("Fifteen seconds until dawn.");
    }
    const target = this.nearestGlamourTarget();
    this.targetGraphic.clear();
    for (const npc of this.npcs)
      if (npc.chasing && npc.stunTimer === 0) {
        this.targetGraphic.lineStyle(1, C.red, 0.6);
        this.targetGraphic.strokeCircle(npc.sprite.x, npc.sprite.y, 19);
        this.targetGraphic.fillStyle(C.red);
        this.targetGraphic.fillRect(npc.sprite.x - 1, npc.sprite.y - 28, 2, 6);
        this.targetGraphic.fillCircle(npc.sprite.x, npc.sprite.y - 19, 1);
      }
    if (target) {
      this.targetGraphic.lineStyle(1, C.mint, 0.8);
      this.targetGraphic.strokeCircle(target.sprite.x, target.sprite.y, 23);
    }
    this.glamourStatus.setText(
      target
        ? "E / CHARM · RECRUIT AN ALLY"
        : this.glamouredEver
          ? "ALLIES " + this.glamouredEver + " · THEY COLLECT BLOOD FOR YOU"
          : "",
    );
    this.glamourButton.setAlpha(target ? 1 : 0.65);
    this.dashLabel.setText(
      this.dashCooldown > 0 ? this.dashCooldown.toFixed(1) + "s" : "DASH",
    );
    this.dashButton.setAlpha(this.dashCooldown > 0 ? 0.5 : 1);
    this.updateUI();
    this.updateRadar();
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
      () => this.scene.start("Game"),
      true,
    );
    button(this, 195, 790, 342, "BACK TO THE CITY", () =>
      this.scene.start("Menu"),
    );
    this.input.keyboard.on("keydown", (e) => {
      if (e.repeat) return;
      if (e.key === "Enter") {
        this.scene.start("Game");
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
  physics: { default: "arcade", arcade: { gravity: { y: 0 }, debug: false } },
  input: { activePointers: 3, keyboard: true },
  render: { antialias: true, roundPixels: true },
  scene: [BootScene, MenuScene, GameScene, ScoreScene],
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
};
if (typeof module !== "undefined" && module.exports)
  module.exports = {
    BootScene,
    MenuScene,
    GameScene,
    ScoreScene,
    Save,
    config,
  };
else new Phaser.Game(config);
