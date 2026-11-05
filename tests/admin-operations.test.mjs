import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import worker from "../worker/index.js";
import { completeContactDelivery } from "../worker/adminOperations.js";

const origin = "https://example.test";
const missingId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function databaseBinding(sqlite, { rejectOperations = false } = {}) {
  return {
    prepare(query) {
      if (rejectOperations && /admin_(?:operation_metrics|contacts|tasks)/u.test(query)) {
        throw new Error("Test-only operations database failure");
      }
      let values = [];
      const statement = {
        bind(...nextValues) {
          values = nextValues;
          return statement;
        },
        async first() {
          return sqlite.prepare(query).get(...values) ?? null;
        },
        async all() {
          return {
            results: sqlite.prepare(query).all(...values),
            meta: {
              size_after: sqlite.prepare("PRAGMA page_count").get().page_count
                * sqlite.prepare("PRAGMA page_size").get().page_size,
            },
          };
        },
        async run() {
          return sqlite.prepare(query).run(...values);
        },
      };
      return statement;
    },
    async batch(statements) {
      sqlite.exec("BEGIN");
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        sqlite.exec("COMMIT");
        return results;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
  };
}

async function createEnvironment(t, { operationsSchema = true } = {}) {
  const sqlite = new DatabaseSync(":memory:");
  t.after(() => sqlite.close());
  const migrationNames = (await readdir(new URL("../migrations/", import.meta.url)))
    .filter((name) => name.endsWith(".sql"))
    .sort();
  for (const name of migrationNames) {
    const migration = await readFile(new URL(`../migrations/${name}`, import.meta.url), "utf8");
    if (!operationsSchema && migration.includes("admin_operation_metrics")) continue;
    sqlite.exec(migration);
  }

  const limit = { allowed: true, retryAfter: 30 };
  const counterCalls = [];
  const env = {
    ADMIN_EMAIL: "admin@example.test",
    ADMIN_PASSWORD: "test-only-password",
    ADMIN_SESSION_KEY: "session-key-for-test-which-is-not-a-real-secret",
    AUTH_RATE_LIMIT_KEY: "rate-limit-key-for-test-which-is-not-a-real-secret",
    CONTENT_DB: databaseBinding(sqlite),
    AUTH_LIMITER: {
      getByName: () => ({ fetch: async () => Response.json(limit) }),
    },
    VISITOR_COUNTER: {
      getByName: () => ({
        fetch: async (request) => {
          const pathname = new URL(request.url).pathname;
          counterCalls.push(pathname);
          if (pathname === "/event") return Response.json({ recorded: true });
          if (pathname === "/analytics") {
            return Response.json({
              cvDownloads: { total: 4, today: 1 },
              workClicks: { total: 8, today: 2, bySlug: { "food-stall": 8 } },
              workDwell: { seconds: 85, events: 2 },
              countries: [],
              devices: [],
            });
          }
          return Response.json({ total: 41, today: 3, day: "2026-09-30" });
        },
      }),
    },
    ASSETS: { fetch: async () => new Response("public asset") },
  };
  return { env, sqlite, limit, counterCalls };
}

function request(path, { method = "GET", cookie, body, headers = {} } = {}) {
  return new Request(`${origin}${path}`, {
    method,
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(method === "GET" ? {} : { origin }),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...headers,
    },
    ...(body === undefined ? {} : { body: typeof body === "string" ? body : JSON.stringify(body) }),
  });
}

async function login(env) {
  const response = await worker.fetch(request("/api/auth/login", {
    method: "POST",
    body: { email: "admin@example.test", password: "test-only-password" },
  }), env);
  assert.equal(response.status, 200);
  return response.headers.get("set-cookie");
}

async function overview(env, cookie) {
  const response = await worker.fetch(request("/api/admin/overview", { cookie }), env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  return response.json();
}

function seedContact(sqlite, id = missingId) {
  const now = "2026-09-30T01:00:00.000Z";
  sqlite.prepare(`
    INSERT INTO admin_contacts (id, name, email, message, status, mail_status, created_at, updated_at)
    VALUES (?, 'Visitor', 'visitor@example.test', 'A real portfolio inquiry.', 'NEW', 'sent', ?, ?)
  `).run(id, now, now);
  return id;
}

function stubMail(t, responses) {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    assert.equal(String(url), "https://api.resend.com/emails");
    calls.push(JSON.parse(options.body));
    const next = responses.shift();
    assert.ok(next, "Every external mail attempt must have an explicit test response");
    if (next instanceof Error) throw next;
    return next;
  };
  t.after(() => { globalThis.fetch = originalFetch; });
  return calls;
}

test("operations reads and writes require a signed admin session and same-origin mutations", async (t) => {
  const { env, sqlite } = await createEnvironment(t);
  seedContact(sqlite);
  for (const [path, method, body] of [
    ["/api/admin/overview", "GET", undefined],
    ["/api/admin/tasks", "POST", { title: "Update CV" }],
    [`/api/admin/tasks/${missingId}`, "PATCH", { status: "DONE" }],
    [`/api/admin/contacts/${missingId}`, "PATCH", { status: "READ" }],
  ]) {
    const denied = await worker.fetch(request(path, { method, body }), env);
    assert.equal(denied.status, 401, path);
    assert.equal(denied.headers.get("cache-control"), "no-store");
  }
  const forged = await worker.fetch(request("/api/admin/overview", {
    cookie: "__Host-phrnono_admin=forged.signature",
  }), env);
  assert.equal(forged.status, 401);
  const cookie = await login(env);
  assert.match(cookie, /HttpOnly/u);
  assert.match(cookie, /Secure/u);
  assert.match(cookie, /SameSite=Strict/u);
  for (const [path, method, body] of [
    ["/api/admin/tasks", "POST", { title: "Update CV" }],
    [`/api/admin/contacts/${missingId}`, "PATCH", { status: "READ" }],
  ]) {
    for (const otherOrigin of ["https://other.test", "null", ""]) {
      const denied = await worker.fetch(request(path, {
        method, cookie, body, headers: { origin: otherOrigin, "sec-fetch-site": "cross-site" },
      }), env);
      assert.equal(denied.status, 403);
    }
  }
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM admin_tasks").get().count, 0);
  assert.equal(sqlite.prepare("SELECT status FROM admin_contacts WHERE id = ?").get(missingId).status, "NEW");
  const body = await overview(env, cookie);
  assert.equal(body.operations.available, true);
  assert.deepEqual(body.visitors, { total: 41, today: 3, day: "2026-09-30" });
});

test("maintenance tasks persist in D1 through edit, done, archive and reopen", async (t) => {
  const { env, sqlite } = await createEnvironment(t);
  const cookie = await login(env);
  const created = await worker.fetch(request("/api/admin/tasks", {
    method: "POST", cookie, body: { title: "  Compress Game Wall images  " },
  }), env);
  assert.equal(created.status, 201);
  const { task } = await created.json();
  assert.equal(task.title, "Compress Game Wall images");
  assert.equal(task.status, "OPEN");
  assert.ok(Number.isFinite(Date.parse(task.createdAt)));
  for (const [patch, expected] of [
    [{ title: "Update CV", status: "DONE" }, { title: "Update CV", status: "DONE" }],
    [{ status: "ARCHIVED" }, { title: "Update CV", status: "ARCHIVED" }],
    [{ status: "OPEN" }, { title: "Update CV", status: "OPEN" }],
  ]) {
    const response = await worker.fetch(request(`/api/admin/tasks/${task.id}`, {
      method: "PATCH", cookie, body: patch,
    }), env);
    assert.equal(response.status, 200);
    const updated = (await response.json()).task;
    assert.equal(updated.title, expected.title);
    assert.equal(updated.status, expected.status);
    assert.equal(updated.createdAt, task.createdAt);
  }
  // Replace the binding/handler caller: state must come from D1, not the request's memory.
  const recreatedEnvironment = { ...env, CONTENT_DB: databaseBinding(sqlite) };
  const persisted = (await overview(recreatedEnvironment, cookie)).operations.tasks.find((item) => item.id === task.id);
  assert.equal(persisted.title, "Update CV");
  assert.equal(persisted.status, "OPEN");
});

test("operations writes reject oversized, malformed and unknown input without creating records", async (t) => {
  const { env, sqlite } = await createEnvironment(t);
  const cookie = await login(env);
  for (const body of [
    {}, { title: "" }, { title: "   " }, { title: 12 }, { title: "x".repeat(241) },
    { title: "Update CV", status: "DONE" }, { title: "Update CV", unexpected: true },
  ]) {
    const response = await worker.fetch(request("/api/admin/tasks", { method: "POST", cookie, body }), env);
    assert.equal(response.status, 422, JSON.stringify(body));
  }
  const malformed = await worker.fetch(request("/api/admin/tasks", { method: "POST", cookie, body: "{" }), env);
  assert.equal(malformed.status, 400);
  const oversized = await worker.fetch(request("/api/admin/tasks", {
    method: "POST", cookie, body: { title: "x".repeat(9000) },
  }), env);
  assert.equal(oversized.status, 413);
  const malformedId = await worker.fetch(request("/api/admin/tasks/not-a-uuid", {
    method: "PATCH", cookie, body: { status: "DONE" },
  }), env);
  assert.equal(malformedId.status, 422);
  const missing = await worker.fetch(request(`/api/admin/tasks/${missingId}`, {
    method: "PATCH", cookie, body: { status: "DONE" },
  }), env);
  assert.equal(missing.status, 404);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM admin_tasks").get().count, 0);

  const created = await worker.fetch(request("/api/admin/tasks", {
    method: "POST", cookie, body: { title: "x".repeat(240) },
  }), env);
  assert.equal(created.status, 201);
  const { task } = await created.json();
  for (const body of [{}, { status: "NEW" }, { title: "x".repeat(241) }, { title: "" }, { unknown: true }]) {
    const response = await worker.fetch(request(`/api/admin/tasks/${task.id}`, {
      method: "PATCH", cookie, body,
    }), env);
    assert.equal(response.status, 422);
  }
  assert.equal(sqlite.prepare("SELECT title, status FROM admin_tasks WHERE id = ?").get(task.id).status, "OPEN");
});

test("contact workflow changes are manual, persisted and never claim a new email delivery", async (t) => {
  const { env, sqlite } = await createEnvironment(t);
  const id = seedContact(sqlite);
  const cookie = await login(env);
  const originalFetch = globalThis.fetch;
  let mailAttempts = 0;
  globalThis.fetch = async () => {
    mailAttempts += 1;
    throw new Error("A manual status edit must not send an email");
  };
  t.after(() => { globalThis.fetch = originalFetch; });
  const initial = (await overview(env, cookie)).operations.email;
  for (const status of ["READ", "REPLIED", "ARCHIVED", "NEW"]) {
    const response = await worker.fetch(request(`/api/admin/contacts/${id}`, {
      method: "PATCH", cookie, body: { status },
    }), env);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).contact.status, status);
    const email = (await overview({ ...env, CONTENT_DB: databaseBinding(sqlite) }, cookie)).operations.email;
    assert.equal(email.counts[status], 1);
    assert.equal(Object.values(email.counts).reduce((sum, count) => sum + count, 0), 1);
    assert.equal(email.sent, initial.sent);
    assert.equal(email.lastDeliveryAt, initial.lastDeliveryAt);
  }
  for (const body of [{ status: "OPEN" }, { status: "read" }, { status: "READ", message: "Changed story" }, {}]) {
    const response = await worker.fetch(request(`/api/admin/contacts/${id}`, {
      method: "PATCH", cookie, body,
    }), env);
    assert.equal(response.status, 422);
  }
  const missing = await worker.fetch(request("/api/admin/contacts/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", {
    method: "PATCH", cookie, body: { status: "READ" },
  }), env);
  assert.equal(missing.status, 404);
  assert.equal(sqlite.prepare("SELECT status FROM admin_contacts WHERE id = ?").get(id).status, "NEW");
  assert.equal(mailAttempts, 0);
});

test("actual external mail successes and failures update delivery counters and retained inquiries", async (t) => {
  const { env } = await createEnvironment(t);
  Object.assign(env, {
    RESEND_API_KEY: "test-only-resend-key",
    CONTACT_FROM_EMAIL: "website@example.test",
    CONTACT_TO_EMAIL: "owner@example.test",
  });
  const calls = stubMail(t, [Response.json({ id: "mail-success" }), new Response("provider unavailable", { status: 503 }), new Error("network down")]);
  const cookie = await login(env);
  const initial = (await overview(env, cookie)).operations.email;
  const successful = await worker.fetch(request("/api/contact", {
    method: "POST", body: { name: "Visitor", email: "visitor@example.test", message: "Please tell me about this portfolio." },
  }), env);
  assert.equal(successful.status, 200);
  assert.deepEqual(await successful.json(), { sent: true });
  const afterSuccess = (await overview(env, cookie)).operations.email;
  assert.equal(afterSuccess.sent, initial.sent + 1);
  assert.equal(afterSuccess.failed, initial.failed);
  assert.ok(Number.isFinite(Date.parse(afterSuccess.lastDeliveryAt)));
  assert.equal(afterSuccess.contacts[0].mailStatus, "sent");
  assert.equal(afterSuccess.contacts[0].status, "NEW");
  assert.equal(calls[0].reply_to, "visitor@example.test");
  assert.deepEqual(calls[0].to, ["owner@example.test"]);
  // Retried completion must not count twice or turn an accepted delivery into failure.
  await completeContactDelivery(env, afterSuccess.contacts[0].id, { configured: true, sent: true });
  await completeContactDelivery(env, afterSuccess.contacts[0].id, { configured: true, sent: false });
  const afterRepeatedOutcome = (await overview(env, cookie)).operations.email;
  assert.equal(afterRepeatedOutcome.sent, afterSuccess.sent);
  assert.equal(afterRepeatedOutcome.failed, afterSuccess.failed);
  assert.equal(afterRepeatedOutcome.contacts[0].mailStatus, "sent");
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const failed = await worker.fetch(request("/api/contact", {
      method: "POST", body: { name: "Visitor", email: `visitor${attempt}@example.test`, message: "A failed delivery still needs an owner reply." },
    }), env);
    assert.equal(failed.status, 502);
  }
  const afterFailures = (await overview(env, cookie)).operations.email;
  assert.equal(afterFailures.sent, afterSuccess.sent);
  assert.equal(afterFailures.failed, afterSuccess.failed + 2);
  assert.equal(afterFailures.lastDeliveryAt, afterSuccess.lastDeliveryAt);
  assert.equal(afterFailures.contacts.filter((item) => item.mailStatus === "failed").length, 2);
  assert.equal(afterFailures.counts.NEW, 3);
  assert.equal(calls.length, 3);
});

test("an unconfigured mail provider is labeled without fabricating sent or failed delivery metrics", async (t) => {
  const { env } = await createEnvironment(t);
  const cookie = await login(env);
  const initial = (await overview(env, cookie)).operations.email;
  const response = await worker.fetch(request("/api/contact", {
    method: "POST", body: { name: "Visitor", email: "visitor@example.test", message: "A portfolio inquiry with no configured mail service." },
  }), env);
  assert.equal(response.status, 503);
  const email = (await overview(env, cookie)).operations.email;
  assert.equal(email.sent, initial.sent);
  assert.equal(email.failed, initial.failed);
  assert.equal(email.lastDeliveryAt, null);
  assert.equal(email.contacts[0].mailStatus, "unconfigured");
  assert.equal(email.contacts[0].status, "NEW");
});

test("security telemetry stores aggregate categories and never sensitive attack detail", async (t) => {
  const { env, sqlite, limit } = await createEnvironment(t);
  const cookie = await login(env);
  const initial = (await overview(env, cookie)).operations.security;
  const sensitive = {
    "cf-connecting-ip": "198.51.100.91",
    "user-agent": "private-agent-sentinel",
    referer: "https://private.example.test/private-referrer",
  };
  env.TURNSTILE_SECRET_KEY = "test-only-turnstile-secret";
  const blocked = await worker.fetch(request("/api/contact", {
    method: "POST", headers: sensitive,
    body: { name: "Private name", email: "private-email@example.test", message: "private-message-sentinel contact body" },
  }), env);
  assert.equal(blocked.status, 403);
  const honeypot = await worker.fetch(request("/api/contact", {
    method: "POST", headers: sensitive,
    body: { website: "private-attack-sentinel", email: "private-email@example.test", message: "private-message-sentinel contact body" },
  }), env);
  assert.equal(honeypot.status, 200);
  limit.allowed = false;
  const limited = await worker.fetch(request("/api/auth/login", {
    method: "POST", headers: sensitive,
    body: { email: "private-email@example.test", password: "private-password-sentinel" },
  }), env);
  assert.equal(limited.status, 429);
  limit.allowed = true;
  const security = (await overview(env, cookie)).operations.security;
  assert.equal(security.turnstileBlocked, initial.turnstileBlocked + 1);
  assert.equal(security.rateLimited, initial.rateLimited + 1);
  assert.equal(security.suspiciousRequests, initial.suspiciousRequests + 1);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM admin_contacts").get().count, 0);
  const telemetry = JSON.stringify(sqlite.prepare("SELECT * FROM admin_operation_metrics").all());
  for (const sentinel of Object.values(sensitive).concat([
    "private-email@example.test", "private-message-sentinel", "private-password-sentinel", "private-attack-sentinel",
  ])) {
    assert.equal(telemetry.includes(sentinel), false, sentinel);
    assert.equal(JSON.stringify(security).includes(sentinel), false, sentinel);
  }
  assert.deepEqual(Object.keys(security).sort(), ["rateLimited", "suspiciousRequests", "trackingSince", "turnstileBlocked"]);
});

test("ordinary invalid contact input is validation feedback and is not classified as an attack", async (t) => {
  const { env, sqlite } = await createEnvironment(t);
  const cookie = await login(env);
  const before = (await overview(env, cookie)).operations;
  for (const body of [
    { email: "visitor@example.test", message: "short" },
    { email: "invalid email", message: "A legitimate user mistyped their email." },
    { email: "", message: "A legitimate user has not entered an email yet." },
  ]) {
    const invalid = await worker.fetch(request("/api/contact", { method: "POST", body }), env);
    assert.equal(invalid.status, 422);
  }
  const after = (await overview(env, cookie)).operations;
  assert.deepEqual(after.security, before.security);
  assert.equal(after.health.events, before.health.events);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM admin_contacts").get().count, 0);
});

test("health reports measured database, storage reservations and event totals without invented uptime", async (t) => {
  const { env, sqlite } = await createEnvironment(t);
  const now = "2026-09-30T01:00:00.000Z";
  sqlite.prepare(`
    INSERT INTO content_media (id, content_id, collection, kind, mime_type, byte_size, storage_key, alt_text, visibility, created_at, updated_at)
    VALUES (?, NULL, 'works', 'image', 'image/png', ?, ?, '', 'private', ?, ?)
  `).run(missingId, 1_234_567, "cms/works/image/test.png", now, now);
  sqlite.prepare(`
    INSERT INTO content_upload_sessions
      (id, upload_id, content_id, collection, kind, mime_type, byte_size, part_size, part_count, storage_key, alt_text, status, reserved_bytes, expires_at, created_at, updated_at)
    VALUES (?, 'test-upload', NULL, 'music', 'audio', 'audio/mpeg', ?, 16777216, 2, 'cms/music/audio/test.mp3', '', 'active', ?, '2099-01-01T00:00:00.000Z', ?, ?)
  `).run("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", 22_000_000, 22_000_000, now, now);
  const cookie = await login(env);
  const before = (await overview(env, cookie)).operations.health;
  assert.equal(before.databaseStatus, "connected");
  assert.equal(before.databaseBytes, sqlite.prepare("PRAGMA page_count").get().page_count * sqlite.prepare("PRAGMA page_size").get().page_size);
  assert.equal(before.storageBytes, 1_234_567);
  assert.equal(before.reservedBytes, 22_000_000);
  assert.equal(before.storageLimitBytes, 8 * 1024 * 1024 * 1024);
  assert.equal(before.uptimePercent, null);
  assert.ok(Number.isFinite(Date.parse(before.checkedAt)));
  const created = await worker.fetch(request("/api/admin/tasks", {
    method: "POST", cookie, body: { title: "Add new character project" },
  }), env);
  assert.equal(created.status, 201);
  const after = (await overview(env, cookie)).operations.health;
  assert.equal(after.events, before.events + 1);
  assert.equal(after.events, sqlite.prepare("SELECT event_count FROM admin_operation_metrics WHERE id = 1").get().event_count);
});

test("missing operations schema leaves the existing dashboard usable and marks tracking unavailable", async (t) => {
  const { env } = await createEnvironment(t, { operationsSchema: false });
  const cookie = await login(env);
  const body = await overview(env, cookie);
  assert.equal(body.visitors.total, 41);
  assert.equal(body.analytics.cvDownloads.total, 4);
  assert.equal(body.operations.available, false);
  assert.equal(body.operations.security.turnstileBlocked, null);
  assert.equal(body.operations.email.sent, null);
  assert.equal(body.operations.health.events, null);
  assert.equal(body.operations.health.uptimePercent, null);
  assert.deepEqual(body.operations.tasks, []);
  assert.deepEqual(body.operations.email.contacts, []);
  assert.equal(body.operations.health.databaseStatus, "connected");
  const unavailableWrite = await worker.fetch(request("/api/admin/tasks", {
    method: "POST", cookie, body: { title: "Update CV" },
  }), env);
  assert.equal(unavailableWrite.status, 503);
});

test("unavailable bindings and absent database metadata are explicit rather than simulated instrument values", async (t) => {
  const { env, sqlite } = await createEnvironment(t);
  const cookie = await login(env);
  const withoutDatabase = await overview({ ...env, CONTENT_DB: undefined }, cookie);
  assert.equal(withoutDatabase.operations.available, false);
  assert.equal(withoutDatabase.operations.health.databaseStatus, "unavailable");
  for (const field of ["databaseBytes", "storageBytes", "reservedBytes", "events", "uptimePercent"]) {
    assert.equal(withoutDatabase.operations.health[field], null, field);
  }
  const originalBinding = databaseBinding(sqlite);
  for (const metadata of [undefined, {}, { size_after: null }]) {
    const withoutMetadata = {
      ...originalBinding,
      prepare(query) {
        const prepared = originalBinding.prepare(query);
        const originalAll = prepared.all;
        prepared.all = async () => {
          const result = await originalAll();
          result.meta = metadata;
          return result;
        };
        return prepared;
      },
    };
    const body = await overview({ ...env, CONTENT_DB: withoutMetadata }, cookie);
    assert.equal(body.operations.available, true);
    assert.equal(body.operations.health.databaseStatus, "connected");
    assert.equal(body.operations.health.databaseBytes, null);
    assert.equal(body.operations.health.storageBytes, 0);
    assert.equal(body.operations.health.uptimePercent, null);
  }
});

test("operations telemetry failures cannot break public assets, analytics, login, CMS or email delivery", async (t) => {
  const { env, sqlite, counterCalls } = await createEnvironment(t);
  env.CONTENT_DB = databaseBinding(sqlite, { rejectOperations: true });
  Object.assign(env, {
    RESEND_API_KEY: "test-only-resend-key",
    CONTACT_FROM_EMAIL: "website@example.test",
    CONTACT_TO_EMAIL: "owner@example.test",
  });
  const calls = stubMail(t, [Response.json({ id: "mail-without-telemetry" })]);
  const cookie = await login(env);
  const asset = await worker.fetch(request("/assets/app.js"), env);
  assert.equal(asset.status, 200);
  assert.equal(await asset.text(), "public asset");
  const analytics = await worker.fetch(request("/api/analytics/events", {
    method: "POST", body: { type: "work_click", slug: "food-stall" },
  }), env);
  assert.equal(analytics.status, 200);
  assert.ok(counterCalls.includes("/event"));
  const cms = await worker.fetch(request("/api/admin/content/works", {
    method: "POST", cookie, body: { title: "A normal content draft", status: "draft", data: {} },
  }), env);
  assert.equal(cms.status, 201);
  const delivered = await worker.fetch(request("/api/contact", {
    method: "POST", body: { name: "Visitor", email: "visitor@example.test", message: "Mail delivery must not depend on the telemetry write." },
  }), env);
  assert.equal(delivered.status, 200);
  assert.deepEqual(await delivered.json(), { sent: true });
  assert.equal(calls.length, 1);
  assert.equal((await overview(env, cookie)).operations.available, false);
});
