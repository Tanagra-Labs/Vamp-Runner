// Vampire Runner — MVP
// Phaser 3 via CDN, no build step, mobile-first

const GAME_W = 390;
const GAME_H = 844;

const TILE = 40;
const MAP_COLS = 20;
const MAP_ROWS = 30;
const MAP_W = MAP_COLS * TILE;
const MAP_H = MAP_ROWS * TILE;

const PLAYER_SPEED = 200;
const SUNRISE_DURATION = 90; // seconds
const GARLIC_HITS_PER_LIFE = 3;
const MAX_LIVES = 3;

// Simple level layout — 0=floor, 1=wall, 2=cross, 3=garlic, 4=syringe, 5=shelter
// Map is MAP_ROWS x MAP_COLS
function buildLevelData() {
  const R = MAP_ROWS;
  const C = MAP_COLS;
  // Start with all floor
  const grid = Array.from({ length: R }, () => new Array(C).fill(0));

  // Border walls
  for (let c = 0; c < C; c++) { grid[0][c] = 1; grid[R - 1][c] = 1; }
  for (let r = 0; r < R; r++) { grid[r][0] = 1; grid[r][C - 1] = 1; }

  // Interior walls — create corridors
  const wallRanges = [
    // [row, colStart, colEnd]
    [4, 2, 8], [4, 11, 17],
    [8, 4, 9], [8, 12, 18],
    [12, 1, 6], [12, 9, 14],
    [16, 3, 10], [16, 13, 17],
    [20, 2, 7], [20, 11, 16],
    [24, 4, 9], [24, 12, 18],
  ];
  wallRanges.forEach(([r, c1, c2]) => {
    for (let c = c1; c <= c2; c++) grid[r][c] = 1;
  });

  // Crosses — dangerous obstacles
  const crosses = [
    [3, 4], [3, 14], [7, 2], [7, 11], [11, 7], [11, 16],
    [15, 3], [15, 13], [19, 6], [19, 15], [23, 4], [23, 12],
  ];
  crosses.forEach(([r, c]) => { if (grid[r][c] === 0) grid[r][c] = 2; });

  // Garlic patches
  const garlics = [
    [5, 3], [5, 16], [9, 5], [9, 13], [13, 2], [13, 17],
    [17, 5], [17, 14], [21, 3], [21, 15], [25, 6], [25, 11],
  ];
  garlics.forEach(([r, c]) => { if (grid[r][c] === 0) grid[r][c] = 3; });

  // Blood syringes
  const syringes = [
    [6, 7], [6, 12], [10, 3], [10, 16], [14, 9], [18, 7],
    [22, 10], [26, 5], [26, 14],
  ];
  syringes.forEach(([r, c]) => { if (grid[r][c] === 0) grid[r][c] = 4; });

  // Shelter at top-center (player starts at bottom-center)
  grid[1][10] = 5;

  return grid;
}

// ─── SCENES ──────────────────────────────────────────────────────────────────

class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  create() {
    // Generate textures programmatically — no external assets needed
    this.makeTextures();
    this.scene.start('Game');
  }

  makeTextures() {
    const g = this.make.graphics({ x: 0, y: 0, add: false });

    // Floor tile
    g.clear();
    g.fillStyle(0x1a1a2e);
    g.fillRect(0, 0, TILE, TILE);
    g.lineStyle(1, 0x16213e, 1);
    g.strokeRect(0, 0, TILE, TILE);
    g.generateTexture('floor', TILE, TILE);

    // Wall tile
    g.clear();
    g.fillStyle(0x0f0f1a);
    g.fillRect(0, 0, TILE, TILE);
    g.fillStyle(0x1c1c30);
    g.fillRect(2, 2, TILE - 4, TILE - 4);
    g.lineStyle(1, 0x2a2a4a, 1);
    g.strokeRect(2, 2, TILE - 4, TILE - 4);
    g.generateTexture('wall', TILE, TILE);

    // Cross obstacle
    g.clear();
    g.fillStyle(0x1a1a2e);
    g.fillRect(0, 0, TILE, TILE);
    g.fillStyle(0xc0c0c0);
    // vertical bar
    g.fillRect(17, 6, 6, 28);
    // horizontal bar
    g.fillRect(8, 12, 24, 6);
    g.generateTexture('cross', TILE, TILE);

    // Garlic
    g.clear();
    g.fillStyle(0x1a1a2e);
    g.fillRect(0, 0, TILE, TILE);
    g.fillStyle(0xd4e6a5);
    g.fillCircle(20, 22, 9);
    g.fillStyle(0xb8cc8a);
    g.fillCircle(14, 17, 6);
    g.fillCircle(26, 17, 6);
    g.fillStyle(0x8fae6b);
    g.fillRect(18, 6, 4, 10);
    g.generateTexture('garlic', TILE, TILE);

    // Blood syringe
    g.clear();
    g.fillStyle(0x1a1a2e);
    g.fillRect(0, 0, TILE, TILE);
    g.fillStyle(0x888888);
    g.fillRect(14, 8, 12, 6);
    g.fillStyle(0xcc0000);
    g.fillRect(10, 14, 20, 12);
    g.fillStyle(0xaaaaaa);
    g.fillRect(17, 26, 6, 8);
    g.generateTexture('syringe', TILE, TILE);

    // Shelter (coffin)
    g.clear();
    g.fillStyle(0x1a1a2e);
    g.fillRect(0, 0, TILE, TILE);
    g.fillStyle(0x3d1c02);
    g.fillRect(6, 4, 28, 32);
    g.fillStyle(0x5a2d0c);
    g.fillRect(8, 6, 24, 28);
    g.fillStyle(0x8b0000);
    g.fillRect(16, 14, 8, 12);
    g.generateTexture('shelter', TILE, TILE);

    // Player (vampire)
    g.clear();
    g.fillStyle(0x1a0a2e);
    g.fillCircle(16, 16, 14);
    g.fillStyle(0xf5cba7);
    g.fillCircle(16, 13, 7);
    g.fillStyle(0x2c003e);
    g.fillRect(4, 20, 24, 12);
    g.fillStyle(0x8b0000);
    g.fillRect(10, 21, 12, 4);
    // Cape
    g.fillStyle(0x1a0030);
    g.fillTriangle(4, 22, 16, 32, 28, 22);
    g.generateTexture('player', 32, 32);

    // Sunlight overlay (warm orange strip)
    g.clear();
    g.fillStyle(0xffa500, 0.7);
    g.fillRect(0, 0, MAP_W, 4);
    g.generateTexture('sunstrip', MAP_W, 4);

    g.destroy();
  }
}

// ─────────────────────────────────────────────────────────────────────────────

class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  create() {
    this.cameras.main.setBackgroundColor('#000000');

    // State
    this.lives = MAX_LIVES;
    this.garlicHits = 0;
    this.timeLeft = SUNRISE_DURATION;
    this.gameOver = false;
    this.won = false;
    this.invincible = false; // brief iframes after hit

    // Build world
    this.levelData = buildLevelData();
    this.buildWorld();

    // Player
    this.spawnPlayer();

    // Sunlight creep (rendered as a rectangle overlay that grows from top)
    this.sunlightHeight = 0;
    this.sunlightGraphic = this.add.graphics();
    this.sunlightGraphic.setDepth(5);

    // Camera
    this.cameras.main.setBounds(0, 0, MAP_W, MAP_H);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

    // UI (fixed to camera)
    this.buildUI();

    // Virtual joystick
    this.buildJoystick();

    // Overlap/collision
    this.physics.add.collider(this.player, this.walls);
    this.physics.add.overlap(this.player, this.crosses, this.hitCross, null, this);
    this.physics.add.overlap(this.player, this.garlics, this.hitGarlic, null, this);
    this.physics.add.overlap(this.player, this.syringes, this.collectSyringe, null, this);
    this.physics.add.overlap(this.player, this.shelterGroup, this.reachShelter, null, this);

    // Countdown timer
    this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: this.tickTimer,
      callbackScope: this,
    });
  }

  // ── World builder ──────────────────────────────────────────────────────────

  buildWorld() {
    this.walls = this.physics.add.staticGroup();
    this.crosses = this.physics.add.staticGroup();
    this.garlics = this.physics.add.staticGroup();
    this.syringes = this.physics.add.staticGroup();
    this.shelterGroup = this.physics.add.staticGroup();

    for (let r = 0; r < MAP_ROWS; r++) {
      for (let c = 0; c < MAP_COLS; c++) {
        const x = c * TILE + TILE / 2;
        const y = r * TILE + TILE / 2;
        const cell = this.levelData[r][c];

        // Always draw floor underneath
        this.add.image(x, y, 'floor').setDepth(0);

        if (cell === 1) {
          const w = this.walls.create(x, y, 'wall').setDepth(1);
          w.refreshBody();
        } else if (cell === 2) {
          const cr = this.crosses.create(x, y, 'cross').setDepth(1);
          cr.refreshBody();
        } else if (cell === 3) {
          const ga = this.garlics.create(x, y, 'garlic').setDepth(1);
          ga.refreshBody();
        } else if (cell === 4) {
          const sy = this.syringes.create(x, y, 'syringe').setDepth(1);
          sy.refreshBody();
        } else if (cell === 5) {
          const sh = this.shelterGroup.create(x, y, 'shelter').setDepth(1);
          sh.refreshBody();
        }
      }
    }
  }

  spawnPlayer() {
    // Start at bottom-center of map
    const startX = Math.floor(MAP_COLS / 2) * TILE + TILE / 2;
    const startY = (MAP_ROWS - 3) * TILE + TILE / 2;
    this.player = this.physics.add.image(startX, startY, 'player')
      .setDepth(3)
      .setCircle(14, 2, 2)
      .setCollideWorldBounds(true);
    this.physics.world.setBounds(0, 0, MAP_W, MAP_H);
  }

  // ── UI ─────────────────────────────────────────────────────────────────────

  buildUI() {
    const cam = this.cameras.main;
    const cx = cam.scrollX;

    // Timer bar background
    this.timerBg = this.add.rectangle(GAME_W / 2, 28, GAME_W - 20, 20, 0x333333)
      .setScrollFactor(0).setDepth(10).setOrigin(0.5, 0.5);

    this.timerBar = this.add.rectangle(10, 18, GAME_W - 20, 16, 0xffa500)
      .setScrollFactor(0).setDepth(11).setOrigin(0, 0);

    this.timerText = this.add.text(GAME_W / 2, 28, '90', {
      fontFamily: 'Georgia, serif',
      fontSize: '14px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
    }).setScrollFactor(0).setDepth(12).setOrigin(0.5, 0.5);

    // Lives (coffin icons drawn as text emojis — fallback: rectangles)
    this.livesText = this.add.text(10, 50, '', {
      fontFamily: 'Georgia, serif',
      fontSize: '22px',
      color: '#8b0000',
    }).setScrollFactor(0).setDepth(10);

    // Garlic hit counter
    this.garlicText = this.add.text(GAME_W - 10, 50, '', {
      fontFamily: 'Georgia, serif',
      fontSize: '14px',
      color: '#d4e6a5',
      stroke: '#000',
      strokeThickness: 2,
    }).setScrollFactor(0).setDepth(10).setOrigin(1, 0);

    // Status message
    this.statusText = this.add.text(GAME_W / 2, GAME_H / 2, '', {
      fontFamily: 'Georgia, serif',
      fontSize: '32px',
      color: '#ff2222',
      stroke: '#000',
      strokeThickness: 4,
      align: 'center',
    }).setScrollFactor(0).setDepth(20).setOrigin(0.5, 0.5).setVisible(false);

    // Sub-status (restart hint)
    this.subText = this.add.text(GAME_W / 2, GAME_H / 2 + 50, '', {
      fontFamily: 'Georgia, serif',
      fontSize: '18px',
      color: '#cccccc',
      stroke: '#000',
      strokeThickness: 3,
      align: 'center',
    }).setScrollFactor(0).setDepth(20).setOrigin(0.5, 0.5).setVisible(false);

    this.updateUI();
  }

  updateUI() {
    // Timer bar
    const pct = this.timeLeft / SUNRISE_DURATION;
    const barW = (GAME_W - 20) * pct;
    this.timerBar.width = Math.max(0, barW);
    const col = pct > 0.5 ? 0xffa500 : pct > 0.25 ? 0xff6600 : 0xff2200;
    this.timerBar.setFillStyle(col);
    this.timerText.setText(String(Math.max(0, this.timeLeft)) + 's');

    // Lives
    const coffin = '⚰';
    this.livesText.setText(coffin.repeat(this.lives));

    // Garlic hits
    if (this.garlicHits > 0) {
      this.garlicText.setText('🧄 ' + this.garlicHits + '/' + GARLIC_HITS_PER_LIFE);
    } else {
      this.garlicText.setText('');
    }
  }

  // ── Virtual Joystick ───────────────────────────────────────────────────────

  buildJoystick() {
    this.joystick = {
      active: false,
      pointerId: null,
      baseX: 0, baseY: 0,
      stickX: 0, stickY: 0,
      dx: 0, dy: 0,
    };

    // Joystick visuals (drawn in camera space, always visible)
    this.joyBase = this.add.circle(0, 0, 48, 0xffffff, 0.15)
      .setScrollFactor(0).setDepth(15).setVisible(false);
    this.joyStick = this.add.circle(0, 0, 24, 0xffffff, 0.35)
      .setScrollFactor(0).setDepth(16).setVisible(false);

    this.input.on('pointerdown', (p) => {
      if (this.gameOver) {
        this.scene.restart();
        return;
      }
      if (!this.joystick.active) {
        this.joystick.active = true;
        this.joystick.pointerId = p.id;
        this.joystick.baseX = p.x;
        this.joystick.baseY = p.y;
        this.joystick.stickX = p.x;
        this.joystick.stickY = p.y;
        this.joyBase.setPosition(p.x, p.y).setVisible(true);
        this.joyStick.setPosition(p.x, p.y).setVisible(true);
      }
    });

    this.input.on('pointermove', (p) => {
      if (this.joystick.active && p.id === this.joystick.pointerId) {
        const dx = p.x - this.joystick.baseX;
        const dy = p.y - this.joystick.baseY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxR = 55;
        const clamped = Math.min(dist, maxR);
        const angle = Math.atan2(dy, dx);
        this.joystick.stickX = this.joystick.baseX + Math.cos(angle) * clamped;
        this.joystick.stickY = this.joystick.baseY + Math.sin(angle) * clamped;
        this.joystick.dx = dist > 4 ? Math.cos(angle) : 0;
        this.joystick.dy = dist > 4 ? Math.sin(angle) : 0;
        this.joyStick.setPosition(this.joystick.stickX, this.joystick.stickY);
      }
    });

    this.input.on('pointerup', (p) => {
      if (p.id === this.joystick.pointerId) {
        this.joystick.active = false;
        this.joystick.pointerId = null;
        this.joystick.dx = 0;
        this.joystick.dy = 0;
        this.joyBase.setVisible(false);
        this.joyStick.setVisible(false);
      }
    });
  }

  // ── Hazard Handlers ────────────────────────────────────────────────────────

  hitCross(player, cross) {
    if (this.invincible || this.gameOver) return;
    this.loseLife('BURNED BY HOLY LIGHT');
  }

  hitGarlic(player, garlic) {
    if (this.invincible || this.gameOver) return;
    this.garlicHits++;
    this.setInvincible(1500);
    this.cameras.main.shake(200, 0.005);

    // Flash green tint
    this.player.setTint(0x88ff44);
    this.time.delayedCall(300, () => this.player.clearTint());

    if (this.garlicHits >= GARLIC_HITS_PER_LIFE) {
      this.garlicHits = 0;
      this.loseLife('GARLIC OVERLOAD');
    }
    this.updateUI();
  }

  collectSyringe(player, syringe) {
    syringe.destroy();
    // Visual feedback
    const txt = this.add.text(syringe.x, syringe.y, '+BLOOD', {
      fontFamily: 'Georgia, serif', fontSize: '16px', color: '#ff2222',
      stroke: '#000', strokeThickness: 2,
    }).setDepth(8);
    this.tweens.add({
      targets: txt, y: syringe.y - 40, alpha: 0, duration: 800,
      onComplete: () => txt.destroy(),
    });
    // Heal: reduce garlic hits by 1
    if (this.garlicHits > 0) this.garlicHits = Math.max(0, this.garlicHits - 1);
    this.updateUI();
  }

  reachShelter() {
    if (this.gameOver) return;
    this.triggerWin();
  }

  // ── Life System ────────────────────────────────────────────────────────────

  loseLife(reason) {
    this.lives--;
    this.setInvincible(2000);
    this.cameras.main.shake(300, 0.012);
    this.cameras.main.flash(200, 150, 0, 0);
    this.updateUI();

    if (this.lives <= 0) {
      this.triggerLose(reason);
    }
  }

  setInvincible(ms) {
    this.invincible = true;
    // Flash the player
    this.tweens.add({
      targets: this.player, alpha: 0.3, duration: 100,
      yoyo: true, repeat: Math.floor(ms / 200),
    });
    this.time.delayedCall(ms, () => {
      this.invincible = false;
      this.player.setAlpha(1);
    });
  }

  // ── Timer ──────────────────────────────────────────────────────────────────

  tickTimer() {
    if (this.gameOver) return;
    this.timeLeft = Math.max(0, this.timeLeft - 1);
    this.updateUI();
    this.updateSunlight();

    if (this.timeLeft <= 0) {
      this.triggerLose('SUNRISE — YOU BURN');
    }
  }

  updateSunlight() {
    const elapsed = SUNRISE_DURATION - this.timeLeft;
    // Sunlight creeps down from y=0; full map covered at SUNRISE_DURATION
    this.sunlightHeight = (elapsed / SUNRISE_DURATION) * MAP_H;

    this.sunlightGraphic.clear();
    if (this.sunlightHeight > 0) {
      // Gradient-ish: draw multiple strips
      const strips = 8;
      for (let i = 0; i < strips; i++) {
        const alpha = 0.1 + (i / strips) * 0.45;
        const stripH = this.sunlightHeight / strips;
        this.sunlightGraphic.fillStyle(0xff8800, alpha);
        this.sunlightGraphic.fillRect(0, i * stripH, MAP_W, stripH + 1);
      }
      // Hard edge
      this.sunlightGraphic.fillStyle(0xffaa00, 0.6);
      this.sunlightGraphic.fillRect(0, this.sunlightHeight - 4, MAP_W, 4);
    }

    // Check if player is in sunlight
    if (!this.invincible && this.player.y < this.sunlightHeight) {
      this.loseLife('CAUGHT IN SUNLIGHT');
    }
  }

  // ── End States ─────────────────────────────────────────────────────────────

  triggerWin() {
    this.gameOver = true;
    this.won = true;
    this.player.setVelocity(0, 0);

    this.statusText.setText('YOU MADE IT!\nSUNRISE SURVIVED')
      .setColor('#ffdd44').setVisible(true);
    this.subText.setText('Tap anywhere to play again').setVisible(true);
    this.cameras.main.flash(500, 100, 100, 0);
  }

  triggerLose(reason) {
    this.gameOver = true;
    this.player.setVelocity(0, 0);
    this.player.setTint(0xff4400);

    this.cameras.main.shake(400, 0.02);
    this.cameras.main.flash(300, 150, 30, 0);

    this.statusText.setText('YOU PERISH\n' + reason)
      .setColor('#ff2222').setVisible(true);
    this.subText.setText('Tap anywhere to try again').setVisible(true);
  }

  // ── Update ─────────────────────────────────────────────────────────────────

  update() {
    if (this.gameOver) {
      this.player.setVelocity(0, 0);
      return;
    }

    const { dx, dy } = this.joystick;
    if (dx !== 0 || dy !== 0) {
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      this.player.setVelocity(
        (dx / len) * PLAYER_SPEED,
        (dy / len) * PLAYER_SPEED
      );
      // Face direction
      this.player.setFlipX(dx < 0);
    } else {
      this.player.setVelocity(0, 0);
    }
  }
}

// ─── CONFIG & LAUNCH ──────────────────────────────────────────────────────────

const config = {
  type: Phaser.AUTO,
  width: GAME_W,
  height: GAME_H,
  backgroundColor: '#000000',
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: 0 }, debug: false },
  },
  scene: [BootScene, GameScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    parent: document.body,
  },
};

new Phaser.Game(config);
