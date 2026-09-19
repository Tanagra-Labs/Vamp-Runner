const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { createServer } = require("../server");

test("serves all game assets, query strings and health without exposing repository files", async (t) => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const request = (path, method = "GET") =>
    new Promise((resolve, reject) => {
      const req = http.request(
        { hostname: "127.0.0.1", port: server.address().port, path, method },
        (res) => {
          let body = "";
          res.on("data", (data) => (body += data));
          res.on("end", () =>
            resolve({ status: res.statusCode, headers: res.headers, body }),
          );
        },
      );
      req.on("error", reject);
      req.end();
    });
  for (const path of [
    "/",
    "/index.html",
    "/styles.css",
    "/game.js",
    "/rules.js",
    "/game.js?v=1",
  ]) {
    const response = await request(path);
    assert.equal(response.status, 200, path);
    assert.ok(response.body.length > 0, path);
  }
  assert.equal((await request("/health")).body, "ok");
  assert.equal((await request("/game.js", "HEAD")).body, "");
  assert.equal((await request("/", "POST")).status, 405);
  assert.equal((await request("/%E0%A4%A")).status, 400);
  for (const path of [
    "/server.js",
    "/package.json",
    "/.git/config",
    "/../server.js",
    "/%2e%2e/server.js",
    "/missing",
  ])
    assert.equal((await request(path)).status, 404, path);
});
