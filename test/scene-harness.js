// Node-only scene adapter: exercises gameplay orchestration, not Phaser rendering.
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");
const { EventEmitter } = require("node:events");
const rules = require("../rules");

class GameObject extends EventEmitter {
  constructor(x = 0, y = 0, key = "") {
    super();
    this.x = x;
    this.y = y;
    this.key = key;
    this.active = true;
    this.visible = true;
    this.depth = 0;
    this.alpha = 1;
    this.scrollFactorX = this.scrollFactorY = 1;
    this.width = 0; this.height = 0;
    this.originX = this.originY = 0.5;
    this.body = { velocity: { x: 0, y: 0 } };
  }
  setVelocity(x, y) {
    this.body.velocity = { x, y };
    return this;
  }
  setPosition(x, y) {
    this.x = x;
    this.y = y;
    return this;
  }
  setTexture(key) {
    this.key = key;
    return this;
  }
  setText(text) {
    this.text = text;
    return this;
  }
  setAlpha(alpha) {
    this.alpha = alpha;
    return this;
  }
  setVisible(visible) { this.visible = visible; return this; }
  setScrollFactor(x, y = x) { this.scrollFactorX = x; this.scrollFactorY = y; return this; }
  setOrigin(x, y = x) { this.originX = x; this.originY = y; return this; }
  setDepth(depth) { this.depth = depth; return this; }
  setInteractive() { this.interactive = true; return this; }
  disableInteractive() { this.interactive = false; return this; }
  setFillStyle(color) {
    this.color = color;
    return this;
  }
  setTint(tint) {
    this.tint = tint;
    return this;
  }
  clearTint() {
    this.tint = null;
    return this;
  }
  add(child) {
    (this.children ??= []).push(...(Array.isArray(child) ? child : [child]));
    return this;
  }
  destroy() {
    this.active = false;
    this.children?.forEach((child) => child.destroy());
  }
}
for (const method of [
  "setDisplaySize", "setScale",
  "setStrokeStyle",
  "setCircle",
  "setCollideWorldBounds",
  "refreshBody",
  "setFlipX",
  "setColor",
  "setWordWrapWidth",
  "setAlign",
  "setLineSpacing",
  "clear",
  "fillStyle",
  "fillGradientStyle",
  "fillRect",
  "fillRoundedRect",
  "fillEllipse",
  "fillCircle",
  "lineStyle",
  "strokeCircle",
  "strokeEllipse",
  "strokeRect",
  "strokeRoundedRect",
  "fillTriangle",
  "fillPoints",
  "strokePoints",
  "lineBetween",
  "generateTexture",
]) {
  GameObject.prototype[method] = function () {
    return this;
  };
}
class Group {
  constructor() {
    this.children = [];
  }
  create(x, y, key) {
    const obj = new GameObject(x, y, key);
    this.children.push(obj);
    return obj;
  }
  add(obj) {
    this.children.push(obj);
  }
  getChildren() {
    return this.children.filter((child) => child.active);
  }
}
function loadGame() {
  const storage = new Map(),
    windowEvents = new EventEmitter(),
    documentEvents = new EventEmitter();
  const elements = new Map([
    ["game-status", { textContent: "" }],
    ["loading", { remove() {} }],
  ]);
  const context = {
    module: { exports: {} },
    VampRules: rules,
    VampAudio: require("../audio"),
    VampBat: require("../bat"),
    VampHunt: require("../hunt"),
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
    },
    window: {
      matchMedia: () => ({ matches: true }),
      addEventListener: windowEvents.on.bind(windowEvents),
      removeEventListener: windowEvents.off.bind(windowEvents),
    },
    document: {
      hidden: false,
      getElementById: (id) => elements.get(id),
      addEventListener: documentEvents.on.bind(documentEvents),
      removeEventListener: documentEvents.off.bind(documentEvents),
    },
    Phaser: {
      Scene: class {},
      AUTO: 0,
      Scale: { FIT: 0, CENTER_BOTH: 0 },
      Math: {
        Between: (min, max) => Math.floor((min + max) / 2),
        Distance: { Between: (x, y, xx, yy) => Math.hypot(xx - x, yy - y) },
      },
    },
    console,
  };
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, "../game.js"), "utf8"),
    context,
    { filename: "game.js" },
  );
  function wire(scene) {
    scene.add = {};
    scene.objects = [];
    for (const type of [
      "image",
      "rectangle",
      "circle",
      "graphics",
      "container",
    ])
      scene.add[type] = (x, y, key, height, fillAlpha = 1) => {
        const obj = new GameObject(x, y, key);
        obj.type = type;
        if (type === "rectangle") { obj.width = key; obj.height = height; obj.fillAlpha = fillAlpha; }
        scene.objects.push(obj);
        return obj;
      };
    scene.add.text = (x, y, text) =>
      Object.assign(new GameObject(x, y), { text });
    scene.make = { graphics: () => new GameObject() };
    scene.transitions = [];
    scene.scene = {
      start: (name, data) => scene.transitions.push({ name, data }),
      restart: (data) => scene.transitions.push({ name: "Game", data }),
    };
    scene.cameras = { main: new GameObject() };
    for (const fn of [
      "setBackgroundColor",
      "setBounds",
      "startFollow",
      "shake",
    ])
      scene.cameras.main[fn] = () => {};
    scene.cameras.main.setScroll = (x, y) => { scene.cameras.main.scrollX = x; scene.cameras.main.scrollY = y; };
    scene.cameras.main.getWorldPoint = (x, y) => ({ x, y });
    scene.physics = {
      paused: false,
      pause() {
        this.paused = true;
      },
      resume() {
        this.paused = false;
      },
      world: { setBounds() {} },
      overlaps: [],
    };
    scene.physics.add = {
      staticGroup: () => new Group(),
      group: () => new Group(),
      image: (x, y, key) => new GameObject(x, y, key),
      collider() {},
      overlap: (a, b, callback, process, scope) =>
        scene.physics.overlaps.push({
          a,
          b,
          callback: scope ? callback.bind(scope) : callback,
        }),
    };
    scene.tweens = {
      paused: false,
      add() {},
      killTweensOf() {},
      pauseAll() {
        this.paused = true;
      },
      resumeAll() {
        this.paused = false;
      },
    };
    scene.time = { paused: false, now: 1000, callbacks: [], delayedCall(_delay, callback) { this.callbacks.push(callback); } };
    scene.input = new EventEmitter();
    scene.input.keyboard = new EventEmitter();
    scene.input.keyboard.addKeys = (names) =>
      Object.fromEntries(
        names.split(",").map((name) => [name, { isDown: false }]),
      );
    scene.input.keyboard.resetKeys = () => {
      if (scene.keys)
        Object.values(scene.keys).forEach((key) => (key.isDown = false));
    };
    scene.events = new EventEmitter();
    return scene;
  }
  // Screen hit test for standalone, unscaled controls, using Phaser 3.60's
  // InputManager scroll-factor transform. This catches the original Next Night
  // regression: a fixed display container with a world-scrolling child hit area.
  function tap(scene, x, y, id = 1) {
    const camera = scene.cameras.main;
    const objects = scene.objects.filter((o) => o.active && o.visible && o.interactive).sort((a, b) => (b.depth || 0) - (a.depth || 0) || scene.objects.indexOf(b) - scene.objects.indexOf(a));
    for (const o of objects) {
      const px = x + (camera.scrollX || 0) * o.scrollFactorX;
      const py = y + (camera.scrollY || 0) * o.scrollFactorY;
      if (px >= o.x - o.width * o.originX && px <= o.x + o.width * (1 - o.originX) && py >= o.y - o.height * o.originY && py <= o.y + o.height * (1 - o.originY)) {
        o.emit("pointerdown", { id, x, y }, 0, 0, { stopPropagation() {} });
        return o;
      }
    }
    return null;
  }
  // Detect solid UI panels painted over the centre of a control or caption.
  // This checks display-list ordering, not just whether a hidden button takes input.
  function coveringPanels(scene, object) {
    const camera = scene.cameras.main, index = scene.objects.indexOf(object);
    const x = object.x - (camera.scrollX || 0) * object.scrollFactorX;
    const y = object.y - (camera.scrollY || 0) * object.scrollFactorY;
    return scene.objects.filter((o, i) => {
      if (o.type !== "rectangle" || !o.active || !o.visible || o.alpha * o.fillAlpha < 0.9) return false;
      if (o.depth < object.depth || (o.depth === object.depth && i <= index)) return false;
      const left = o.x - (camera.scrollX || 0) * o.scrollFactorX - o.width * o.originX;
      const top = o.y - (camera.scrollY || 0) * o.scrollFactorY - o.height * o.originY;
      return x >= left && x <= left + o.width && y >= top && y <= top + o.height;
    });
  }
  return {
    ...context.module.exports,
    context,
    storage,
    windowEvents,
    documentEvents,
    elements,
    wire,
    tap,
    coveringPanels,
  };
}
module.exports = { loadGame };
