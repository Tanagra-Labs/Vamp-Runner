const test = require("node:test");
const assert = require("node:assert/strict");
const R = require("../rules");

for (let variant = 0; variant < 3; variant++) {
  test(`district ${variant}: all pickups, NPC spawns and crypt are reachable`, () => {
    const grid = R.buildLevelData(variant),
      spawn = { r: 27, c: 10 };
    const destinations = [
      { r: 1, c: 10 },
      ...R.getNPCSpawns(variant).map((p) => R.nearestOpenCell(grid, p.r, p.c)),
    ];
    grid.forEach((row, r) =>
      row.forEach((cell, c) => {
        if (cell === 4) destinations.push({ r, c });
      }),
    );
    for (const destination of destinations) {
      const path = R.findPath(grid, spawn, destination);
      assert.ok(path.length, `Unreachable ${JSON.stringify(destination)}`);
      assert.deepEqual(path.at(-1), destination);
      path.forEach((point, i) => {
        assert.ok(R.walkable(grid, point.r, point.c));
        if (i)
          assert.equal(
            Math.abs(point.r - path[i - 1].r) +
              Math.abs(point.c - path[i - 1].c),
            1,
          );
      });
    }
    assert.equal(grid[spawn.r][spawn.c], 0);
    assert.equal(grid[1][10], 5);
  });
}

test("sunrise chases from the south and leaves the crypt safe until the end", () => {
  assert.equal(R.sunlightBoundary(90, 90), 1200);
  assert.equal(R.sunlightBoundary(45, 90), 600);
  assert.equal(R.sunlightBoundary(0, 90), 0);
  assert.ok(R.sunlightBoundary(10, 90) > 60);
  assert.equal(R.timeRatio(84, 84), 1);
  assert.equal(R.timeRatio(-2, 84), 0);
  assert.equal(R.timeRatio(100, 84), 1);
});

test("survival and time bonuses are awarded only for surviving a night", () => {
  const stats = { night: 1, timeLeft: 60, blood: 2, allies: 1, lost: 0 };
  assert.equal(R.nightScore(stats, true), 2150);
  assert.equal(R.nightScore(stats, false), 750);
  assert.equal(
    R.nightScore({ ...stats, blood: 0, allies: 0, lost: 3 }, false),
    0,
  );
});

test("keyboard diagonals are normalized while joystick half-speed is preserved", () => {
  assert.equal(Math.hypot(...Object.values(R.movementVector(1, 1))), 1);
  assert.deepEqual(R.movementVector(0.3, 0.4), { x: 0.3, y: 0.4 });
  assert.deepEqual(R.movementVector(0, 0), { x: 0, y: 0 });
});

test("glamour and ally stuns cannot pass through a wall", () => {
  const grid = R.buildLevelData(0);
  assert.equal(
    R.clearSight(grid, { x: 180, y: 140 }, { x: 180, y: 220 }),
    false,
  );
  assert.equal(
    R.clearSight(grid, { x: 420, y: 140 }, { x: 420, y: 220 }),
    true,
  );
});

test("difficulty rotates districts and remains bounded across long runs", () => {
  assert.deepEqual(
    [1, 2, 3, 4].map((n) => R.nightSettings(n).variant),
    [0, 1, 2, 0],
  );
  assert.equal(R.nightSettings(2).duration, 84);
  assert.equal(R.nightSettings(500).duration, 40);
  assert.equal(R.nightSettings(500).speed, 2.1);
});

test("unreachable destinations return no path without looping", () => {
  assert.deepEqual(
    R.findPath(
      [
        [1, 1, 1, 1, 1],
        [1, 0, 1, 0, 1],
        [1, 1, 1, 1, 1],
      ],
      { r: 1, c: 1 },
      { r: 1, c: 3 },
    ),
    [],
  );
});

test("old scores survive migration and malformed local data cannot break the menu", () => {
  assert.deepEqual(R.cleanScores({ wrong: true }), []);
  assert.deepEqual(
    R.cleanScores([
      null,
      { name: "VAL    ", score: 1234 },
      { name: 5, score: 4 },
      { name: "BAD", score: NaN },
      { name: "NEG", score: -1 },
    ]),
    [{ name: "VAL", score: 1234 }],
  );
  assert.equal(
    R.cleanScores(
      Array.from({ length: 20 }, (_, i) => ({ name: "ABC", score: i })),
    ).length,
    10,
  );
  assert.equal(R.cleanScores([{ name: "<b>x</b>", score: 23.5 }])[0].score, 23);
});
