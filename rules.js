/* Shared, deterministic game rules. No rendering or browser dependency. */
(function (root) {
  "use strict";
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

  // ── Map variants ─────────────────────────────────────────────────────────────
  // variant 0 = horizontal corridors (original)
  // variant 1 = dense chokepoints
  // variant 2 = open-centre with perimeter pillars

  function buildLevelData(variant = 0) {
    const R = MAP_ROWS;
    const C = MAP_COLS;
    const grid = Array.from({ length: R }, () => new Array(C).fill(0));

    // Always border walls
    for (let c = 0; c < C; c++) {
      grid[0][c] = 1;
      grid[R - 1][c] = 1;
    }
    for (let r = 0; r < R; r++) {
      grid[r][0] = 1;
      grid[r][C - 1] = 1;
    }

    if (variant === 0) {
      // Horizontal corridor walls — original layout
      [
        [4, 2, 8],
        [4, 11, 17],
        [8, 4, 9],
        [8, 12, 18],
        [12, 1, 6],
        [12, 9, 14],
        [16, 3, 10],
        [16, 13, 17],
        [20, 2, 7],
        [20, 11, 16],
        [24, 4, 9],
        [24, 12, 18],
      ].forEach(([r, c1, c2]) => {
        for (let c = c1; c <= c2; c++) grid[r][c] = 1;
      });

      [
        [6, 7],
        [6, 12],
        [10, 3],
        [10, 16],
        [14, 9],
        [18, 7],
        [22, 10],
        [26, 5],
        [26, 14],
      ].forEach(([r, c]) => {
        if (!grid[r][c]) grid[r][c] = 4;
      });
    } else if (variant === 1) {
      // Dense chokepoints — tight vertical slots force the player to pick routes
      [
        [3, 1, 7],
        [3, 13, 19],
        [6, 4, 10],
        [6, 11, 16],
        [9, 2, 6],
        [9, 14, 18],
        [13, 5, 9],
        [13, 12, 17],
        [17, 1, 8],
        [17, 11, 15],
        [21, 3, 9],
        [21, 12, 18],
        [25, 2, 7],
        [25, 13, 18],
      ].forEach(([r, c1, c2]) => {
        for (let c = c1; c <= c2; c++) grid[r][c] = 1;
      });

      // Vertical dividers to create narrow gaps
      [
        [5, 10],
        [10, 10],
        [15, 10],
        [20, 10],
      ].forEach(([r, c]) => {
        grid[r][c] = 1;
        grid[r + 1][c] = 1;
      });

      [
        [5, 5],
        [8, 14],
        [11, 3],
        [14, 16],
        [18, 8],
        [22, 11],
        [26, 6],
        [26, 15],
        [4, 10],
      ].forEach(([r, c]) => {
        if (!grid[r][c]) grid[r][c] = 4;
      });
    } else {
      // Open centre — perimeter rooms with 3×3 pillar clusters in the open field
      const pillars = [
        [4, 3],
        [4, 4],
        [5, 3],
        [4, 16],
        [4, 17],
        [5, 17],
        [8, 7],
        [8, 8],
        [9, 7],
        [8, 12],
        [8, 13],
        [9, 13],
        [14, 3],
        [14, 4],
        [15, 3],
        [14, 16],
        [14, 17],
        [15, 17],
        [19, 6],
        [19, 7],
        [20, 6],
        [19, 12],
        [19, 13],
        [20, 13],
        [24, 4],
        [24, 5],
        [25, 4],
        [24, 15],
        [24, 16],
        [25, 16],
      ];
      pillars.forEach(([r, c]) => {
        grid[r][c] = 1;
      });

      // Two horizontal half-walls at mid-map to break line-of-sight
      for (let c = 1; c <= 6; c++) grid[12][c] = 1;
      for (let c = 13; c <= 18; c++) grid[12][c] = 1;
      for (let c = 1; c <= 6; c++) grid[22][c] = 1;
      for (let c = 13; c <= 18; c++) grid[22][c] = 1;

      [
        [6, 10],
        [10, 5],
        [10, 15],
        [16, 9],
        [16, 11],
        [20, 4],
        [20, 16],
        [27, 8],
        [27, 13],
      ].forEach(([r, c]) => {
        if (!grid[r][c]) grid[r][c] = 4;
      });
    }

    grid[1][10] = 5; // shelter always at top-centre
    return grid;
  }

  // NPC starting positions per map variant
  function getNPCSpawns(variant = 0) {
    const spawns = [
      // variant 0 — original
      [
        { r: 3, c: 4, type: "priest" },
        { r: 3, c: 14, type: "priest" },
        { r: 7, c: 2, type: "priest" },
        { r: 7, c: 11, type: "priest" },
        { r: 11, c: 7, type: "priest" },
        { r: 23, c: 4, type: "priest" },
        { r: 5, c: 3, type: "garlic" },
        { r: 5, c: 16, type: "garlic" },
        { r: 9, c: 5, type: "garlic" },
        { r: 9, c: 13, type: "garlic" },
        { r: 17, c: 5, type: "garlic" },
        { r: 17, c: 14, type: "garlic" },
        { r: 6, c: 10, type: "plain" },
        { r: 13, c: 3, type: "plain" },
        { r: 15, c: 13, type: "plain" },
        { r: 19, c: 6, type: "plain" },
        { r: 21, c: 15, type: "plain" },
        { r: 25, c: 8, type: "plain" },
      ],
      // variant 1 — dense chokepoints
      [
        { r: 4, c: 9, type: "priest" },
        { r: 4, c: 11, type: "priest" },
        { r: 8, c: 2, type: "priest" },
        { r: 8, c: 17, type: "priest" },
        { r: 16, c: 10, type: "priest" },
        { r: 24, c: 9, type: "priest" },
        { r: 7, c: 3, type: "garlic" },
        { r: 7, c: 17, type: "garlic" },
        { r: 12, c: 3, type: "garlic" },
        { r: 12, c: 18, type: "garlic" },
        { r: 19, c: 5, type: "garlic" },
        { r: 19, c: 16, type: "garlic" },
        { r: 6, c: 11, type: "plain" },
        { r: 11, c: 6, type: "plain" },
        { r: 14, c: 12, type: "plain" },
        { r: 20, c: 9, type: "plain" },
        { r: 23, c: 5, type: "plain" },
        { r: 27, c: 14, type: "plain" },
      ],
      // variant 2 — open centre
      [
        { r: 3, c: 5, type: "priest" },
        { r: 3, c: 15, type: "priest" },
        { r: 7, c: 10, type: "priest" },
        { r: 13, c: 9, type: "priest" },
        { r: 18, c: 4, type: "priest" },
        { r: 23, c: 14, type: "priest" },
        { r: 6, c: 3, type: "garlic" },
        { r: 6, c: 17, type: "garlic" },
        { r: 11, c: 7, type: "garlic" },
        { r: 11, c: 12, type: "garlic" },
        { r: 17, c: 9, type: "garlic" },
        { r: 21, c: 15, type: "garlic" },
        { r: 5, c: 10, type: "plain" },
        { r: 10, c: 4, type: "plain" },
        { r: 13, c: 14, type: "plain" },
        { r: 18, c: 11, type: "plain" },
        { r: 23, c: 5, type: "plain" },
        { r: 26, c: 10, type: "plain" },
      ],
    ];
    return spawns[variant] || spawns[0];
  }

  function nightSettings(night) {
    const n = Math.max(1, Math.floor(night) || 1);
    return {
      duration: Math.max(40, SUNRISE_DURATION - (n - 1) * 6),
      speed: Math.min(2.1, 1 + (n - 1) * 0.08),
      variant: (n - 1) % 3,
    };
  }

  function timeRatio(left, duration) {
    return Math.max(0, Math.min(1, left / Math.max(1, duration)));
  }

  // Dawn follows from the south; the northern crypt remains safe until time runs out.
  function sunlightBoundary(left, duration) {
    return MAP_H * timeRatio(left, duration);
  }

  function nightScore(stats, survived) {
    const survival = survived
      ? stats.night * 500 + Math.ceil(stats.timeLeft) * 15
      : 0;
    return Math.max(
      0,
      survival + stats.blood * 300 + stats.allies * 150 - stats.lost * 200,
    );
  }

  function movementVector(x, y) {
    const length = Math.hypot(x, y);
    const divisor = Math.max(1, length);
    return { x: x / divisor, y: y / divisor };
  }

  function walkable(grid, row, col) {
    return !!grid[row] && grid[row][col] !== undefined && grid[row][col] !== 1;
  }

  function nearestOpenCell(grid, row, col) {
    if (walkable(grid, row, col)) return { r: row, c: col };
    let nearest = null,
      distance = Infinity;
    for (let r = 1; r < grid.length - 1; r++) {
      for (let c = 1; c < grid[r].length - 1; c++) {
        const d = Math.abs(r - row) + Math.abs(c - col);
        if (walkable(grid, r, c) && d < distance) {
          nearest = { r, c };
          distance = d;
        }
      }
    }
    return nearest;
  }

  // Tile-centre waypoints stop helpers and hunters getting stuck against walls.
  function findPath(grid, from, to) {
    const start = nearestOpenCell(grid, from.r, from.c);
    const end = nearestOpenCell(grid, to.r, to.c);
    if (!start || !end) return [];
    const key = (p) => p.r + "," + p.c;
    const queue = [start],
      visited = new Set([key(start)]),
      parent = new Map();
    for (let i = 0; i < queue.length; i++) {
      const point = queue[i];
      if (point.r === end.r && point.c === end.c) {
        const path = [point];
        while (parent.has(key(path[0]))) path.unshift(parent.get(key(path[0])));
        return path;
      }
      for (const [dr, dc] of [
        [-1, 0],
        [0, 1],
        [1, 0],
        [0, -1],
      ]) {
        const next = { r: point.r + dr, c: point.c + dc };
        if (walkable(grid, next.r, next.c) && !visited.has(key(next))) {
          visited.add(key(next));
          parent.set(key(next), point);
          queue.push(next);
        }
      }
    }
    return [];
  }

  function clearSight(grid, a, b) {
    const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 8));
    for (let i = 0; i <= steps; i++) {
      const x = a.x + ((b.x - a.x) * i) / steps,
        y = a.y + ((b.y - a.y) * i) / steps;
      if (!walkable(grid, Math.floor(y / TILE), Math.floor(x / TILE)))
        return false;
    }
    return true;
  }

  function cleanScores(value) {
    if (!Array.isArray(value)) return [];
    return value
      .filter(
        (s) =>
          s &&
          typeof s.name === "string" &&
          Number.isFinite(s.score) &&
          s.score >= 0,
      )
      .map((s) => ({
        name:
          s.name
            .toUpperCase()
            .replace(/[^A-Z]/g, "")
            .slice(0, 7) || "ANON",
        score: Math.floor(s.score),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }

  const api = {
    TILE,
    MAP_COLS,
    MAP_ROWS,
    MAP_W,
    MAP_H,
    PLAYER_SPEED,
    SUNRISE_DURATION,
    GARLIC_HITS_PER_LIFE,
    MAX_LIVES,
    NPC_SPEED,
    PRIEST_SPEED,
    GLAMOUR_RANGE,
    buildLevelData,
    getNPCSpawns,
    nightSettings,
    timeRatio,
    sunlightBoundary,
    nightScore,
    movementVector,
    walkable,
    nearestOpenCell,
    findPath,
    clearSight,
    cleanScores,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.VampRules = api;
})(typeof window !== "undefined" ? window : this);
