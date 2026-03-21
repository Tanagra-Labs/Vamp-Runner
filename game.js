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
const NPC_SPEED = 55;
const PRIEST_SPEED = 42;
const GLAMOUR_RANGE = 72;

// Level layout — 0=floor, 1=wall, 4=syringe, 5=shelter
// Crosses and garlic are now moving NPCs, not tiles.
function buildLevelData() {
  const R = MAP_ROWS;
  const C = MAP_COLS;
  const grid = Array.from({ length: R }, () => new Array(C).fill(0));

  // Border walls
  for (let c = 0; c < C; c++) { grid[0][c] = 1; grid[R - 1][c] = 1; }
  for (let r = 0; r < R; r++) { grid[r][0] = 1; grid[r][C - 1] = 1; }

  // Interior walls
  const wallRanges = [
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

  // Blood syringes
  const syringes = [
    [6, 7], [6, 12], [10, 3], [10, 16], [14, 9], [18, 7],
    [22, 10], [26, 5], [26, 14],
  ];
  syringes.forEach(([r, c]) => { if (grid[r][c] === 0) grid[r][c] = 4; });

  // Shelter at top-center
  grid[1][10] = 5;
  return grid;
}

// NPC starting positions
function getNPCSpawns() {
  return [
    { r: 3,  c: 4,  type: 'priest' },
    { r: 3,  c: 14, type: 'priest' },
    { r: 7,  c: 2,  type: 'priest' },
    { r: 7,  c: 11, type: 'priest' },
    { r: 11, c: 7,  type: 'priest' },
    { r: 23, c: 4,  type: 'priest' },
    { r: 5,  c: 3,  type: 'garlic' },
    { r: 5,  c: 16, type: 'garlic' },
    { r: 9,  c: 5,  type: 'garlic' },
    { r: 9,  c: 13, type: 'garlic' },
    { r: 17, c: 5,  type: 'garlic' },
    { r: 17, c: 14, type: 'garlic' },
    { r: 6,  c: 10, type: 'plain'  },
    { r: 13, c: 3,  type: 'plain'  },
    { r: 15, c: 13, type: 'plain'  },
    { r: 19, c: 6,  type: 'plain'  },
    { r: 21, c: 15, type: 'plain'  },
    { r: 25, c: 8,  type: 'plain'  },
  ];
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

    // Floor — city asphalt
    g.clear();
    g.fillStyle(0x1c1f26);
    g.fillRect(0, 0, TILE, TILE);
    g.lineStyle(1, 0x252a35, 1);
    g.strokeRect(0, 0, TILE, TILE);
    g.lineStyle(1, 0x23272e, 0.6);
    g.lineBetween(TILE / 2, 0, TILE / 2, TILE);
    g.lineBetween(0, TILE / 2, TILE, TILE / 2);
    g.generateTexture('floor', TILE, TILE);

    // Wall — building facade with lit windows
    g.clear();
    g.fillStyle(0x0e1118);
    g.fillRect(0, 0, TILE, TILE);
    g.fillStyle(0x141820);
    g.fillRect(2, 2, TILE - 4, TILE - 4);
    g.fillStyle(0xffdd88, 0.7);
    g.fillRect(6, 6, 8, 6);
    g.fillRect(22, 6, 8, 6);
    g.fillRect(6, 22, 8, 6);
    g.fillRect(22, 22, 8, 6);
    g.generateTexture('wall', TILE, TILE);

    // Cross obstacle (unchanged — still used in current GameScene)
    g.clear();
    g.fillStyle(0x1c1f26);
    g.fillRect(0, 0, TILE, TILE);
    g.fillStyle(0xc0c0c0);
    g.fillRect(17, 6, 6, 28);
    g.fillRect(8, 12, 24, 6);
    g.generateTexture('cross', TILE, TILE);

    // Garlic — proper bulb with cloves and green stem
    g.clear();
    g.fillStyle(0x1c1f26);
    g.fillRect(0, 0, TILE, TILE);
    // papery outer skin
    g.fillStyle(0xfaf0e6);
    g.fillCircle(20, 24, 11);
    // clove sections
    g.fillStyle(0xe8d8c0);
    g.fillCircle(14, 22, 6);
    g.fillCircle(26, 22, 6);
    g.fillCircle(20, 29, 6);
    // clove division lines
    g.lineStyle(1, 0xccb090, 1);
    g.lineBetween(20, 14, 20, 32);
    g.lineBetween(11, 20, 29, 28);
    g.lineBetween(11, 28, 29, 20);
    // stem
    g.fillStyle(0x6a8e4e);
    g.fillRect(18, 5, 4, 12);
    // base wrapper
    g.fillStyle(0xd4c4a0);
    g.fillEllipse(20, 15, 14, 6);
    g.generateTexture('garlic', TILE, TILE);

    // Blood syringe
    g.clear();
    g.fillStyle(0x1c1f26);
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
    g.fillStyle(0x1c1f26);
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
    g.fillStyle(0x1a0030);
    g.fillTriangle(4, 22, 16, 32, 28, 22);
    g.generateTexture('player', 32, 32);

    // NPC: Priest — black robe, pale face, holds cross
    g.clear();
    g.fillStyle(0x111111);
    g.fillRect(8, 14, 16, 18);
    g.fillEllipse(16, 28, 20, 10);
    g.fillStyle(0xf0d0a0);
    g.fillCircle(16, 10, 7);
    // collar
    g.fillStyle(0xffffff);
    g.fillRect(13, 16, 6, 4);
    // cross held out to the side
    g.fillStyle(0xd4aa70);
    g.fillRect(25, 15, 4, 14);
    g.fillRect(21, 19, 12, 4);
    g.generateTexture('npc_priest', 32, 32);

    // NPC: Garlic civilian — neutral clothes, carries garlic bundle
    g.clear();
    g.fillStyle(0x4a5568);
    g.fillRect(9, 14, 14, 16);
    g.fillEllipse(16, 28, 18, 10);
    g.fillStyle(0xf0c8a0);
    g.fillCircle(16, 10, 7);
    g.fillRect(4, 16, 6, 4);
    // garlic bundle
    g.fillStyle(0xfaf0e6);
    g.fillCircle(26, 20, 6);
    g.fillStyle(0x6a8e4e);
    g.fillRect(25, 14, 2, 6);
    g.generateTexture('npc_garlic', 32, 32);

    // NPC: Plain civilian — blue-grey, no hazard
    g.clear();
    g.fillStyle(0x3d5a80);
    g.fillRect(9, 14, 14, 16);
    g.fillEllipse(16, 28, 18, 10);
    g.fillStyle(0xf0c8a0);
    g.fillCircle(16, 10, 7);
    g.fillRect(4, 16, 6, 4);
    g.fillRect(22, 16, 6, 4);
    g.generateTexture('npc_plain', 32, 32);

    // NPC: Glamoured civilian — purple aura, glowing eyes
    g.clear();
    g.fillStyle(0x6600aa, 0.3);
    g.fillCircle(16, 16, 16);
    g.fillStyle(0x6644aa);
    g.fillRect(9, 14, 14, 16);
    g.fillEllipse(16, 28, 18, 10);
    g.fillStyle(0xf0c8a0);
    g.fillCircle(16, 10, 7);
    g.fillRect(4, 16, 6, 4);
    g.fillRect(22, 16, 6, 4);
    // glowing eyes
    g.fillStyle(0xff44ff);
    g.fillCircle(13, 10, 2);
    g.fillCircle(19, 10, 2);
    g.generateTexture('npc_glamoured', 32, 32);

    g.destroy();
  }
}

// ─────────────────────────────────────────────────────────────────────────────

class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  create() {
    this.cameras.main.setBackgroundColor('#000000');

    this.lives = MAX_LIVES;
    this.garlicHits = 0;
    this.timeLeft = SUNRISE_DURATION;
    this.gameOver = false;
    this.won = false;
    this.invincible = false;
    this.syringesCollected = 0;
    this.glamouredEver = 0;
    this.livesLost = 0;

    this.levelData = buildLevelData();
    this.buildWorld();
    this.spawnPlayer();
    this.spawnNPCs();

    this.sunlightHeight = 0;
    this.sunlightGraphic = this.add.graphics().setDepth(5);

    this.cameras.main.setBounds(0, 0, MAP_W, MAP_H);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

    this.buildUI();
    this.buildJoystick();

    this.physics.add.collider(this.player, this.walls);
    this.physics.add.overlap(this.player, this.npcGroup, (player, npcSprite) => {
      const npc = this.npcs.find(n => n.sprite === npcSprite);
      if (!npc || npc.glamoured) return;
      if (npc.type === 'priest') this.hitByPriest();
      else if (npc.type === 'garlic') this.hitByGarlicNPC();
    });
    this.physics.add.overlap(this.player, this.syringes, this.collectSyringe, null, this);
    this.physics.add.overlap(this.player, this.shelterGroup, this.reachShelter, null, this);

    this.time.addEvent({ delay: 1000, loop: true, callback: this.tickTimer, callbackScope: this });

    const hint = this.add.text(GAME_W / 2, GAME_H - 80, 'Tap civilians to glamour them', {
      fontFamily: 'Georgia, serif', fontSize: '14px', color: '#cc44ff',
      stroke: '#000', strokeThickness: 2, align: 'center',
    }).setScrollFactor(0).setDepth(20).setOrigin(0.5, 0.5);
    this.tweens.add({ targets: hint, alpha: 0, duration: 1200, delay: 3000, onComplete: () => hint.destroy() });
  }

  // ── World ──────────────────────────────────────────────────────────────────

  buildWorld() {
    this.walls = this.physics.add.staticGroup();
    this.syringes = this.physics.add.staticGroup();
    this.shelterGroup = this.physics.add.staticGroup();

    for (let r = 0; r < MAP_ROWS; r++) {
      for (let c = 0; c < MAP_COLS; c++) {
        const x = c * TILE + TILE / 2;
        const y = r * TILE + TILE / 2;
        const cell = this.levelData[r][c];
        this.add.image(x, y, 'floor').setDepth(0);
        if      (cell === 1) this.walls.create(x, y, 'wall').setDepth(1).refreshBody();
        else if (cell === 4) this.syringes.create(x, y, 'syringe').setDepth(1).refreshBody();
        else if (cell === 5) this.shelterGroup.create(x, y, 'shelter').setDepth(1).refreshBody();
      }
    }
  }

  spawnPlayer() {
    const startX = Math.floor(MAP_COLS / 2) * TILE + TILE / 2;
    const startY = (MAP_ROWS - 3) * TILE + TILE / 2;
    this.player = this.physics.add.image(startX, startY, 'player')
      .setDepth(3).setCircle(14, 2, 2).setCollideWorldBounds(true);
    this.physics.world.setBounds(0, 0, MAP_W, MAP_H);
  }

  // ── NPCs ───────────────────────────────────────────────────────────────────

  spawnNPCs() {
    this.npcs = [];
    this.npcGroup = this.physics.add.group();

    getNPCSpawns().forEach(({ r, c, type }) => {
      const x = c * TILE + TILE / 2;
      const y = r * TILE + TILE / 2;
      const texKey = type === 'priest' ? 'npc_priest' : type === 'garlic' ? 'npc_garlic' : 'npc_plain';
      const sprite = this.physics.add.image(x, y, texKey)
        .setDepth(2).setCircle(12, 4, 4).setCollideWorldBounds(true);
      this.npcGroup.add(sprite);
      this.physics.add.collider(sprite, this.walls);

      const npc = { sprite, type, glamoured: false, dirTimer: Phaser.Math.Between(400, 1800), dx: 0, dy: 0, stunned: false, stunTimer: 0 };
      this.pickDirection(npc);
      this.npcs.push(npc);
    });
  }

  pickDirection(npc) {
    if (npc.glamoured) {
      // Move toward nearest syringe, or idle near player
      const target = this.nearestSyringe(npc.sprite.x, npc.sprite.y);
      if (target) {
        const dx = target.x - npc.sprite.x;
        const dy = target.y - npc.sprite.y;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        npc.dx = dx / len; npc.dy = dy / len;
      } else {
        const dx = this.player.x - npc.sprite.x;
        const dy = this.player.y - npc.sprite.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 80) { npc.dx = dx / dist; npc.dy = dy / dist; }
        else { npc.dx = 0; npc.dy = 0; }
      }
      return;
    }

    // Priests bias toward player 50% of the time
    if (npc.type === 'priest' && this.player && Math.random() < 0.5) {
      const dx = this.player.x - npc.sprite.x;
      const dy = this.player.y - npc.sprite.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      npc.dx = dx / len; npc.dy = dy / len;
    } else {
      const angle = Math.random() * Math.PI * 2;
      npc.dx = Math.cos(angle); npc.dy = Math.sin(angle);
    }
  }

  nearestSyringe(x, y) {
    let best = null, bestDist = Infinity;
    this.syringes.getChildren().forEach(s => {
      const d = Phaser.Math.Distance.Between(x, y, s.x, s.y);
      if (d < bestDist) { bestDist = d; best = s; }
    });
    return best;
  }

  updateNPCs(delta) {
    this.npcs.forEach(npc => {
      if (!npc.sprite.active) return;

      if (npc.stunned) {
        npc.stunTimer -= delta;
        if (npc.stunTimer <= 0) { npc.stunned = false; npc.sprite.clearTint(); }
        npc.sprite.setVelocity(0, 0);
        return;
      }

      const blocked = !npc.sprite.body.blocked.none;
      npc.dirTimer -= delta;
      if (npc.dirTimer <= 0 || blocked) {
        const interval = npc.glamoured ? 600 : npc.type === 'priest' ? 1500 : 2200;
        npc.dirTimer = interval + Phaser.Math.Between(0, 500);
        this.pickDirection(npc);
      }

      const speed = npc.glamoured ? NPC_SPEED * 1.3 : npc.type === 'priest' ? PRIEST_SPEED : NPC_SPEED;
      npc.sprite.setVelocity(npc.dx * speed, npc.dy * speed);
      if (npc.dx < 0) npc.sprite.setFlipX(true);
      else if (npc.dx > 0) npc.sprite.setFlipX(false);

      if (npc.glamoured) {
        // Collect nearby syringes
        const nearby = this.nearestSyringe(npc.sprite.x, npc.sprite.y);
        if (nearby && Phaser.Math.Distance.Between(npc.sprite.x, npc.sprite.y, nearby.x, nearby.y) < 22) {
          nearby.destroy();
          this.syringesCollected++;
          if (this.garlicHits > 0) this.garlicHits = Math.max(0, this.garlicHits - 1);
          this.updateUI();
          this.floatText(npc.sprite.x, npc.sprite.y, '+BLOOD', '#ff2222');
          this.pickDirection(npc);
        }
        // Stun nearby priests
        this.npcs.forEach(other => {
          if (other === npc || other.type !== 'priest' || other.glamoured || other.stunned) return;
          if (Phaser.Math.Distance.Between(npc.sprite.x, npc.sprite.y, other.sprite.x, other.sprite.y) < 50) {
            other.stunned = true;
            other.stunTimer = 2000;
            other.sprite.setTint(0xaaaaff);
          }
        });
      }
    });
  }

  // Tap-to-glamour: finds a plain NPC near the tapped world position
  findGlamourTarget(wx, wy) {
    for (const npc of this.npcs) {
      if (npc.type !== 'plain' || npc.glamoured || !npc.sprite.active) continue;
      if (Phaser.Math.Distance.Between(wx, wy, npc.sprite.x, npc.sprite.y) < GLAMOUR_RANGE) return npc;
    }
    return null;
  }

  glamourNPC(npc) {
    npc.glamoured = true;
    npc.sprite.setTexture('npc_glamoured');
    npc.dirTimer = 0;
    this.glamouredEver++;
    this.updateUI();
    this.cameras.main.flash(120, 80, 0, 120);
    this.floatText(npc.sprite.x, npc.sprite.y - 10, 'GLAMOURED!', '#dd44ff');
  }

  // ── UI ─────────────────────────────────────────────────────────────────────

  buildUI() {
    this.timerBg = this.add.rectangle(GAME_W / 2, 28, GAME_W - 20, 20, 0x333333)
      .setScrollFactor(0).setDepth(10).setOrigin(0.5, 0.5);
    this.timerBar = this.add.rectangle(10, 18, GAME_W - 20, 16, 0xffa500)
      .setScrollFactor(0).setDepth(11).setOrigin(0, 0);
    this.timerText = this.add.text(GAME_W / 2, 28, '90', {
      fontFamily: 'Georgia, serif', fontSize: '14px', color: '#ffffff', stroke: '#000000', strokeThickness: 3,
    }).setScrollFactor(0).setDepth(12).setOrigin(0.5, 0.5);

    this.livesText = this.add.text(10, 50, '', {
      fontFamily: 'Georgia, serif', fontSize: '22px', color: '#8b0000',
    }).setScrollFactor(0).setDepth(10);

    this.garlicText = this.add.text(GAME_W - 10, 50, '', {
      fontFamily: 'Georgia, serif', fontSize: '14px', color: '#d4e6a5', stroke: '#000', strokeThickness: 2,
    }).setScrollFactor(0).setDepth(10).setOrigin(1, 0);

    this.glamourText = this.add.text(GAME_W / 2, 50, '', {
      fontFamily: 'Georgia, serif', fontSize: '13px', color: '#dd44ff', stroke: '#000', strokeThickness: 2,
    }).setScrollFactor(0).setDepth(10).setOrigin(0.5, 0);

    this.updateUI();
  }

  updateUI() {
    const pct = this.timeLeft / SUNRISE_DURATION;
    this.timerBar.width = Math.max(0, (GAME_W - 20) * pct);
    this.timerBar.setFillStyle(pct > 0.5 ? 0xffa500 : pct > 0.25 ? 0xff6600 : 0xff2200);
    this.timerText.setText(String(Math.max(0, this.timeLeft)) + 's');
    this.livesText.setText('⚰'.repeat(this.lives));
    this.garlicText.setText(this.garlicHits > 0 ? '🧄 ' + this.garlicHits + '/' + GARLIC_HITS_PER_LIFE : '');
    const gc = this.npcs ? this.npcs.filter(n => n.glamoured).length : 0;
    this.glamourText.setText(gc > 0 ? '✨ ' + gc + ' glamoured' : '');
  }

  floatText(x, y, msg, color) {
    const txt = this.add.text(x, y, msg, {
      fontFamily: 'Georgia, serif', fontSize: '15px', color, stroke: '#000', strokeThickness: 2,
    }).setDepth(9);
    this.tweens.add({ targets: txt, y: y - 45, alpha: 0, duration: 900, onComplete: () => txt.destroy() });
  }

  // ── Joystick ───────────────────────────────────────────────────────────────

  buildJoystick() {
    this.joystick = { active: false, pointerId: null, baseX: 0, baseY: 0, dx: 0, dy: 0 };
    this.joyBase = this.add.circle(0, 0, 48, 0xffffff, 0.15).setScrollFactor(0).setDepth(15).setVisible(false);
    this.joyStick = this.add.circle(0, 0, 24, 0xffffff, 0.35).setScrollFactor(0).setDepth(16).setVisible(false);

    this.input.on('pointerdown', (p) => {
      if (this.gameOver) return;
      // Try glamour first
      const target = this.findGlamourTarget(p.worldX, p.worldY);
      if (target) { this.glamourNPC(target); return; }
      if (!this.joystick.active) {
        this.joystick.active = true;
        this.joystick.pointerId = p.id;
        this.joystick.baseX = p.x; this.joystick.baseY = p.y;
        this.joyBase.setPosition(p.x, p.y).setVisible(true);
        this.joyStick.setPosition(p.x, p.y).setVisible(true);
      }
    });

    this.input.on('pointermove', (p) => {
      if (this.joystick.active && p.id === this.joystick.pointerId) {
        const dx = p.x - this.joystick.baseX;
        const dy = p.y - this.joystick.baseY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);
        const clamped = Math.min(dist, 55);
        this.joyStick.setPosition(this.joystick.baseX + Math.cos(angle) * clamped, this.joystick.baseY + Math.sin(angle) * clamped);
        this.joystick.dx = dist > 4 ? Math.cos(angle) : 0;
        this.joystick.dy = dist > 4 ? Math.sin(angle) : 0;
      }
    });

    this.input.on('pointerup', (p) => {
      if (p.id === this.joystick.pointerId) {
        this.joystick.active = false; this.joystick.pointerId = null;
        this.joystick.dx = 0; this.joystick.dy = 0;
        this.joyBase.setVisible(false); this.joyStick.setVisible(false);
      }
    });
  }

  // ── Hazards ────────────────────────────────────────────────────────────────

  hitByPriest() {
    if (this.invincible || this.gameOver) return;
    this.loseLife('BURNED BY HOLY CROSS');
  }

  hitByGarlicNPC() {
    if (this.invincible || this.gameOver) return;
    this.garlicHits++;
    this.setInvincible(1500);
    this.cameras.main.shake(200, 0.005);
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
    this.syringesCollected++;
    this.floatText(syringe.x, syringe.y, '+BLOOD', '#ff2222');
    if (this.garlicHits > 0) this.garlicHits = Math.max(0, this.garlicHits - 1);
    this.updateUI();
  }

  reachShelter() {
    if (this.gameOver) return;
    this.triggerWin();
  }

  // ── Lives ──────────────────────────────────────────────────────────────────

  loseLife(reason) {
    this.lives--;
    this.livesLost++;
    this.setInvincible(2000);
    this.cameras.main.shake(300, 0.012);
    this.cameras.main.flash(200, 150, 0, 0);
    this.updateUI();
    if (this.lives <= 0) this.triggerLose(reason);
  }

  setInvincible(ms) {
    this.invincible = true;
    this.tweens.add({ targets: this.player, alpha: 0.3, duration: 100, yoyo: true, repeat: Math.floor(ms / 200) });
    this.time.delayedCall(ms, () => { this.invincible = false; this.player.setAlpha(1); });
  }

  // ── Timer & sunlight ───────────────────────────────────────────────────────

  tickTimer() {
    if (this.gameOver) return;
    this.timeLeft = Math.max(0, this.timeLeft - 1);
    this.updateUI();
    this.updateSunlight();
    if (this.timeLeft <= 0) this.triggerLose('SUNRISE — YOU BURN');
  }

  updateSunlight() {
    const elapsed = SUNRISE_DURATION - this.timeLeft;
    this.sunlightHeight = (elapsed / SUNRISE_DURATION) * MAP_H;
    this.sunlightGraphic.clear();
    if (this.sunlightHeight > 0) {
      for (let i = 0; i < 8; i++) {
        this.sunlightGraphic.fillStyle(0xff8800, 0.1 + (i / 8) * 0.45);
        this.sunlightGraphic.fillRect(0, i * (this.sunlightHeight / 8), MAP_W, this.sunlightHeight / 8 + 1);
      }
      this.sunlightGraphic.fillStyle(0xffaa00, 0.6);
      this.sunlightGraphic.fillRect(0, this.sunlightHeight - 4, MAP_W, 4);
    }
    if (!this.invincible && this.player.y < this.sunlightHeight) this.loseLife('CAUGHT IN SUNLIGHT');
  }

  // ── End states ─────────────────────────────────────────────────────────────

  calculateScore() {
    let s = 0;
    if (this.won) s += 2000;
    s += this.timeLeft * 15;
    s += this.syringesCollected * 300;
    s += this.glamouredEver * 150;
    s -= this.livesLost * 200;
    return Math.max(0, s);
  }

  triggerWin() {
    this.gameOver = true; this.won = true;
    this.player.setVelocity(0, 0);
    this.cameras.main.flash(500, 100, 100, 0);
    this.time.delayedCall(1500, () => this.scene.start('Score', { score: this.calculateScore(), won: true }));
  }

  triggerLose(reason) {
    this.gameOver = true;
    this.player.setVelocity(0, 0);
    this.player.setTint(0xff4400);
    this.cameras.main.shake(400, 0.02);
    this.cameras.main.flash(300, 150, 30, 0);
    this.add.text(GAME_W / 2, GAME_H / 2, 'YOU PERISH\n' + reason, {
      fontFamily: 'Georgia, serif', fontSize: '28px', color: '#ff2222',
      stroke: '#000', strokeThickness: 4, align: 'center',
    }).setScrollFactor(0).setDepth(20).setOrigin(0.5, 0.5);
    this.time.delayedCall(1800, () => this.scene.start('Score', { score: this.calculateScore(), won: false }));
  }

  // ── Update loop ────────────────────────────────────────────────────────────

  update(time, delta) {
    if (this.gameOver) { this.player.setVelocity(0, 0); return; }

    const { dx, dy } = this.joystick;
    if (dx !== 0 || dy !== 0) {
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      this.player.setVelocity((dx / len) * PLAYER_SPEED, (dy / len) * PLAYER_SPEED);
      this.player.setFlipX(dx < 0);
    } else {
      this.player.setVelocity(0, 0);
    }

    this.updateNPCs(delta);
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
