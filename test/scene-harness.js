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
    this.alpha = 1;
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
  "setOrigin",
  "setDepth",
  "setScrollFactor",
  "setInteractive",
  "disableInteractive",
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
  "fillRect",
  "fillRoundedRect",
  "fillEllipse",
  "fillCircle",
  "lineStyle",
  "strokeCircle",
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
    for (const type of [
      "image",
      "rectangle",
      "circle",
      "graphics",
      "container",
    ])
      scene.add[type] = (x, y, key) => new GameObject(x, y, key);
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
    scene.time = { paused: false, now: 1000 };
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
  return {
    ...context.module.exports,
    context,
    storage,
    windowEvents,
    documentEvents,
    elements,
    wire,
  };
}
module.exports = { loadGame };
