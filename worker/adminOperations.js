const contactStatuses = new Set(["NEW", "READ", "REPLIED", "ARCHIVED"]);
const taskStatuses = new Set(["OPEN", "DONE", "ARCHIVED"]);
const securityColumns = new Map([
  ["turnstileBlocked", "turnstile_blocked"],
  ["rateLimited", "rate_limited"],
  ["suspiciousRequests", "suspicious_requests"],
]);
const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const bodyMaxBytes = 8 * 1024;
const contactListLimit = 100;
const taskListLimit = 200;

function availableDatabase(env) {
  return typeof env.CONTENT_DB?.prepare === "function" ? env.CONTENT_DB : null;
}

function statement(database, query, values = []) {
  const prepared = database.prepare(query);
  return values.length ? prepared.bind(...values) : prepared;
}

async function rows(database, query, values = []) {
  const result = await statement(database, query, values).all();
  if (result?.success === false) throw new Error("Operation database unavailable");
  return Array.isArray(result?.results) ? result.results : [];
}

async function first(database, query, values = []) {
  return statement(database, query, values).first();
}

async function run(database, query, values = []) {
  const result = await statement(database, query, values).run();
  if (result?.success === false) throw new Error("Operation database unavailable");
  return result;
}

async function batch(database, statements) {
  if (typeof database.batch === "function") {
    const results = await database.batch(statements);
    if (results.some((result) => result?.success === false)) throw new Error("Operation database unavailable");
    return results;
  }
  // Only a compatibility fallback for local bindings. Cloudflare D1 supplies
  // transactional batch(), so related counters and rows commit together.
  const results = [];
  for (const entry of statements) results.push(await entry.run());
  return results;
}

function count(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : 0;
}

function contactShape(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    message: row.message,
    status: row.status,
    mailStatus: row.mail_status === "pending" ? "unconfigured" : row.mail_status,
    // The unresolved initial state is explicit; it is never presented as a
    // confirmed failure or a confirmed mail delivery.
    deliveryPending: row.mail_status === "pending",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function taskShape(row) {
  return { id: row.id, title: row.title, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at };
}

function unavailableOperations(storageLimitBytes) {
  return {
    available: false,
    security: { turnstileBlocked: null, rateLimited: null, suspiciousRequests: null, trackingSince: null },
    health: {
      databaseBytes: null, storageBytes: null, reservedBytes: null, storageLimitBytes,
      events: null, uptimePercent: null, databaseStatus: "unavailable", checkedAt: new Date().toISOString(),
    },
    email: {
      sent: null, failed: null, lastDeliveryAt: null, trackingSince: null, contacts: [],
      counts: { NEW: null, READ: null, REPLIED: null, ARCHIVED: null },
    },
    tasks: [],
  };
}

export async function getOperationsOverview(env, { storageLimitBytes }) {
  const overview = unavailableOperations(storageLimitBytes);
  const database = availableDatabase(env);
  if (!database) return overview;

  // .all() preserves D1's meta.size_after; do not estimate database size from
  // SQL page counts or invented limits. This query also probes the base schema
  // independently so a missing operations migration does not break the page.
  try {
    const result = await statement(database, `SELECT
      COALESCE((SELECT SUM(byte_size) FROM content_media), 0) AS storage_bytes,
      COALESCE((SELECT SUM(reserved_bytes) FROM content_upload_sessions WHERE status IN ('active', 'expired')), 0) AS reserved_bytes`).all();
    if (result?.success === false) throw new Error("Operation database unavailable");
    const row = result?.results?.[0];
    const size = result?.meta?.size_after;
    overview.health.databaseStatus = "connected";
    overview.health.databaseBytes = Number.isSafeInteger(size) && size >= 0 ? size : null;
    overview.health.storageBytes = row ? count(row.storage_bytes) : null;
    overview.health.reservedBytes = row ? count(row.reserved_bytes) : null;
  } catch {
    // The existing owner dashboard still works when the binding/schema does not.
  }

  try {
    const [metrics, contacts, statusCounts, tasks] = await Promise.all([
      first(database, "SELECT * FROM admin_operation_metrics WHERE id = 1"),
      rows(database, "SELECT * FROM admin_contacts ORDER BY created_at DESC, id DESC LIMIT ?", [contactListLimit]),
      rows(database, "SELECT status, COUNT(*) AS total FROM admin_contacts GROUP BY status"),
      rows(database, "SELECT * FROM admin_tasks ORDER BY updated_at DESC, id DESC LIMIT ?", [taskListLimit]),
    ]);
    if (!metrics || typeof metrics.tracking_since !== "string") return overview;
    overview.available = true;
    overview.health.databaseStatus = "connected";
    overview.security = {
      turnstileBlocked: count(metrics.turnstile_blocked), rateLimited: count(metrics.rate_limited),
      suspiciousRequests: count(metrics.suspicious_requests), trackingSince: metrics.tracking_since,
    };
    overview.health.events = count(metrics.event_count);
    overview.email = {
      sent: count(metrics.mail_sent), failed: count(metrics.mail_failed), lastDeliveryAt: metrics.last_delivery_at ?? null,
      trackingSince: metrics.tracking_since, contacts: contacts.map(contactShape),
      counts: { NEW: 0, READ: 0, REPLIED: 0, ARCHIVED: 0 },
    };
    for (const row of statusCounts) if (contactStatuses.has(row.status)) overview.email.counts[row.status] = count(row.total);
    overview.tasks = tasks.map(taskShape);
  } catch {
    // Never make the existing overview depend on the new optional migration.
  }
  return overview;
}

// An allowlisted counter increment is the entire security record. No request
// object, IP, path, payload, headers, credentials or conversation is persisted.
export async function recordSecurityEvent(env, type) {
  const database = availableDatabase(env);
  const column = securityColumns.get(type);
  if (!database || !column) return false;
  try {
    await run(database, `UPDATE admin_operation_metrics SET ${column} = ${column} + 1, event_count = event_count + 1 WHERE id = 1`);
    return true;
  } catch {
    return false;
  }
}

export async function saveContactSubmission(env, { name, email, message }) {
  const database = availableDatabase(env);
  if (!database) return null;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  try {
    await run(database, `INSERT INTO admin_contacts (id, name, email, message, status, mail_status, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'NEW', 'pending', ?, ?)`, [id, name, email, message, now, now]);
    return id;
  } catch {
    // A telemetry/storage outage must not disable the existing contact API.
    return null;
  }
}

export async function completeContactDelivery(env, id, result) {
  const database = availableDatabase(env);
  if (!database) return false;
  const now = new Date().toISOString();
  const status = !result.configured ? "unconfigured" : result.sent ? "sent" : "failed";
  try {
    const statements = [];
    // Write outcome counters before the contact update in one D1 transaction.
    // The pending condition also makes re-completing a persisted contact a no-op.
    const pendingCondition = id ? " AND EXISTS (SELECT 1 FROM admin_contacts WHERE id = ? AND mail_status = 'pending')" : "";
    if (result.configured) {
      statements.push(result.sent
        ? statement(database, `UPDATE admin_operation_metrics SET mail_sent = mail_sent + 1, last_delivery_at = ?, event_count = event_count + 1 WHERE id = 1${pendingCondition}`, id ? [now, id] : [now])
        : statement(database, `UPDATE admin_operation_metrics SET mail_failed = mail_failed + 1, event_count = event_count + 1 WHERE id = 1${pendingCondition}`, id ? [id] : []));
    }
    // Unconfigured forwarding is an unavailable integration, not a failed send.
    if (id) statements.push(statement(database, "UPDATE admin_contacts SET mail_status = ?, updated_at = ? WHERE id = ? AND mail_status = 'pending'", [status, now, id]));
    if (statements.length) await batch(database, statements);
    return true;
  } catch {
    return false;
  }
}

function validatedTitle(value) {
  if (typeof value !== "string" || value.length > 240 || /[\u0000-\u001f\u007f]/u.test(value)) return null;
  return value.trim() || null;
}

async function operationsSchemaReady(database) {
  return Boolean(await first(database, "SELECT tracking_since FROM admin_operation_metrics WHERE id = 1"));
}

// Shared owner session/origin/body readers are provided by the main Worker so
// every mutation uses the same hardened authentication as the existing CMS.
export async function handleAdminOperations(request, env, url, helpers) {
  const { requireAdmin, readJsonRequest, jsonResponse, methodNotAllowed, isPlainObject } = helpers;
  const isContact = url.pathname.startsWith("/api/admin/contacts/");
  const isTaskCollection = url.pathname === "/api/admin/tasks";
  const id = isTaskCollection ? null : url.pathname.split("/").at(-1);
  const allowed = isTaskCollection ? "POST" : "PATCH";
  if (request.method !== allowed) return methodNotAllowed(allowed);
  const auth = await requireAdmin(request, env, { write: true });
  if (auth.response) return auth.response;
  if (!isTaskCollection && (!idPattern.test(id ?? "") || url.pathname.split("/").length !== 5)) return jsonResponse({ error: "A valid record id is required." }, 422);

  const body = await readJsonRequest(request, bodyMaxBytes);
  if (body.error || !isPlainObject(body.value)) return jsonResponse({ error: body.error ?? "Invalid request." }, body.status ?? 400);
  const keys = Object.keys(body.value);
  if (isContact) {
    if (keys.length !== 1 || keys[0] !== "status" || !contactStatuses.has(body.value.status)) {
      return jsonResponse({ error: "A valid contact status is required." }, 422);
    }
  } else {
    if (!keys.length || keys.some((key) => !["title", "status"].includes(key)) || (isTaskCollection && (keys.length !== 1 || keys[0] !== "title"))) {
      return jsonResponse({ error: "Invalid task fields." }, 422);
    }
    if (keys.includes("title") && !validatedTitle(body.value.title)) return jsonResponse({ error: "Task title must be between 1 and 240 characters." }, 422);
    if (keys.includes("status") && !taskStatuses.has(body.value.status)) return jsonResponse({ error: "A valid task status is required." }, 422);
  }

  const database = availableDatabase(env);
  if (!database) return jsonResponse({ error: "Owner operations are unavailable." }, 503);
  try {
    if (!await operationsSchemaReady(database)) return jsonResponse({ error: "Owner operations are unavailable." }, 503);
    const now = new Date().toISOString();
    if (isContact) {
      const contact = await first(database, "SELECT * FROM admin_contacts WHERE id = ?", [id.toLowerCase()]);
      if (!contact) return jsonResponse({ error: "Contact not found." }, 404);
      if (contact.status !== body.value.status) {
        await batch(database, [
          statement(database, "UPDATE admin_contacts SET status = ?, updated_at = ? WHERE id = ?", [body.value.status, now, contact.id]),
          statement(database, "UPDATE admin_operation_metrics SET event_count = event_count + 1 WHERE id = 1"),
        ]);
      }
      return jsonResponse({ contact: contactShape(await first(database, "SELECT * FROM admin_contacts WHERE id = ?", [contact.id])) });
    }
    if (isTaskCollection) {
      const taskId = crypto.randomUUID();
      const title = validatedTitle(body.value.title);
      await batch(database, [
        statement(database, "INSERT INTO admin_tasks (id, title, status, created_at, updated_at) VALUES (?, ?, 'OPEN', ?, ?)", [taskId, title, now, now]),
        statement(database, "UPDATE admin_operation_metrics SET event_count = event_count + 1 WHERE id = 1"),
      ]);
      return jsonResponse({ task: taskShape(await first(database, "SELECT * FROM admin_tasks WHERE id = ?", [taskId])) }, 201);
    }
    const task = await first(database, "SELECT * FROM admin_tasks WHERE id = ?", [id.toLowerCase()]);
    if (!task) return jsonResponse({ error: "Task not found." }, 404);
    const title = keys.includes("title") ? validatedTitle(body.value.title) : task.title;
    const status = keys.includes("status") ? body.value.status : task.status;
    if (title !== task.title || status !== task.status) {
      await batch(database, [
        statement(database, "UPDATE admin_tasks SET title = ?, status = ?, updated_at = ? WHERE id = ?", [title, status, now, task.id]),
        statement(database, "UPDATE admin_operation_metrics SET event_count = event_count + 1 WHERE id = 1"),
      ]);
    }
    return jsonResponse({ task: taskShape(await first(database, "SELECT * FROM admin_tasks WHERE id = ?", [task.id])) });
  } catch {
    return jsonResponse({ error: "Owner operations are unavailable." }, 503);
  }
}
