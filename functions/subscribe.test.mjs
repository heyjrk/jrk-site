import assert from "node:assert/strict";
import test from "node:test";
import { onRequestGet } from "./api/export.js";
import { onRequestPost } from "./api/subscribe.js";

class MemoryKV {
  constructor() {
    this.store = new Map();
    this.pages = null;
  }

  async get(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }

  async put(key, value) {
    this.store.set(key, value);
  }

  async list({ cursor } = {}) {
    if (this.pages) {
      const page = this.pages[cursor || "start"];
      return page;
    }
    return {
      keys: [...this.store.keys()].map((name) => ({ name })),
      list_complete: true,
    };
  }
}

function post(body, { origin = "http://localhost", env, url = "http://localhost/api/subscribe" } = {}) {
  return onRequestPost({
    request: new Request(url, {
      method: "POST",
      headers: { origin, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body),
    }),
    env,
  });
}

test("stores a new email and redirects back to the dossier", async () => {
  const kv = new MemoryKV();
  const response = await post(
    { email: "Reader@Example.com", page: "/bonus/", hp_field: "" },
    { env: { SIGNUPS: kv } },
  );
  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), "http://localhost/bonus/?joined=1");
  const saved = JSON.parse(kv.store.get("reader@example.com"));
  assert.equal(saved.email, "reader@example.com");
  assert.equal(saved.page, "/bonus/");
  assert.equal(Number.isNaN(Date.parse(saved.created)), false);
});

test("honeypot skips storage and still looks successful", async () => {
  const kv = new MemoryKV();
  const response = await post(
    { email: "bot@example.com", page: "/bonus/", hp_field: "filled" },
    { env: { SIGNUPS: kv } },
  );
  assert.equal(response.status, 303);
  assert.equal(kv.store.size, 0);
});

test("rejects a bad email and a foreign origin", async () => {
  const kv = new MemoryKV();
  const bad = await post({ email: "not-an-email", page: "/bonus/" }, { env: { SIGNUPS: kv } });
  assert.equal(bad.status, 400);
  assert.equal(kv.store.size, 0);

  const foreign = await post(
    { email: "a@b.co", page: "/bonus/" },
    { env: { SIGNUPS: kv }, origin: "https://evil.example" },
  );
  assert.equal(foreign.status, 403);
  assert.equal(kv.store.size, 0);
});

test("keeps the first signup when the address repeats", async () => {
  const kv = new MemoryKV();
  await kv.put("a@b.co", JSON.stringify({ email: "a@b.co", created: "2020-01-01T00:00:00.000Z", page: "/bonus/" }));
  const response = await post(
    { email: "a@b.co", page: "/" },
    { env: { SIGNUPS: kv } },
  );
  assert.equal(response.status, 303);
  assert.equal(JSON.parse(kv.store.get("a@b.co")).created, "2020-01-01T00:00:00.000Z");
});

test("refuses a return path outside the site", async () => {
  const kv = new MemoryKV();
  const response = await post(
    { email: "a@b.co", page: "https://evil.example/phish" },
    { env: { SIGNUPS: kv } },
  );
  assert.equal(response.headers.get("location"), "http://localhost/bonus/?joined=1");
  assert.equal(JSON.parse(kv.store.get("a@b.co")).page, "/bonus/");
});

test("says the list is unavailable when KV is not bound", async () => {
  const response = await post({ email: "a@b.co", page: "/bonus/" }, { env: {} });
  assert.equal(response.status, 503);
});

test("export returns csv only with the token", async () => {
  const kv = new MemoryKV();
  kv.pages = {
    start: {
      keys: [{ name: "=a@b.co" }],
      list_complete: false,
      cursor: "next",
    },
    next: {
      keys: [{ name: "reader@example.com" }],
      list_complete: true,
    },
  };
  await kv.put("=a@b.co", JSON.stringify({ email: "=a@b.co", created: "2026-01-01T00:00:00.000Z", page: "/" }));
  await kv.put("reader@example.com", JSON.stringify({ email: "reader@example.com", created: "2026-02-02T00:00:00.000Z", page: "/bonus/" }));

  const env = { SIGNUPS: kv, EXPORT_TOKEN: "secret-token" };
  const denied = await onRequestGet({
    request: new Request("http://localhost/api/export"),
    env,
  });
  assert.equal(denied.status, 401);

  const missing = await onRequestGet({
    request: new Request("http://localhost/api/export"),
    env: { SIGNUPS: kv },
  });
  assert.equal(missing.status, 404);

  const ok = await onRequestGet({
    request: new Request("http://localhost/api/export", {
      headers: { authorization: "Bearer secret-token" },
    }),
    env,
  });
  assert.equal(ok.status, 200);
  assert.match(ok.headers.get("content-type"), /text\/csv/);
  const csv = await ok.text();
  assert.equal(
    csv,
    "email,created,page\n'=a@b.co,2026-01-01T00:00:00.000Z,/\nreader@example.com,2026-02-02T00:00:00.000Z,/bonus/\n",
  );
});
