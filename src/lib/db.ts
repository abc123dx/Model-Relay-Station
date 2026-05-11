import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import Database from "better-sqlite3";
import { providerDefinitions } from "@/lib/provider-config";

export type ApiKeyRecord = {
  id: number;
  name: string;
  key_hash: string;
  key_prefix: string;
  status: "active" | "disabled";
  limit_units: number;
  used_units: number;
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
};

export type ChannelRecord = {
  id: string;
  provider: string;
  display_name: string;
  model: string;
  base_url: string;
  api_key_env: string;
  rate: number;
  enabled: 0 | 1;
  healthy: 0 | 1;
  latency_ms: number | null;
  last_checked_at: string | null;
  last_error: string | null;
  updated_at: string;
};

export type RequestLogRecord = {
  id: number;
  request_id: string;
  api_key_id: number | null;
  api_key_prefix: string | null;
  requested_model: string;
  resolved_model: string | null;
  provider: string | null;
  channel_id: string | null;
  status: "success" | "error";
  http_status: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  rate: number;
  billed_units: number;
  latency_ms: number;
  error: string | null;
  created_at: string;
};

declare global {
  // eslint-disable-next-line no-var
  var __aiRelayDb: Database.Database | undefined;
}

function nowIso() {
  return new Date().toISOString();
}

function databasePath() {
  const configured = process.env.DATABASE_PATH ?? "data/ai-relay.sqlite";
  return path.isAbsolute(configured)
    ? configured
    : path.join(/* turbopackIgnore: true */ process.cwd(), configured);
}

function migrate(db: Database.Database) {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      key_hash TEXT NOT NULL UNIQUE,
      key_prefix TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      limit_units REAL NOT NULL DEFAULT 1000000,
      used_units REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_used_at TEXT
    );

    CREATE TABLE IF NOT EXISTS channels (
      id TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      display_name TEXT NOT NULL,
      model TEXT NOT NULL,
      base_url TEXT NOT NULL,
      api_key_env TEXT NOT NULL,
      rate REAL NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      healthy INTEGER NOT NULL DEFAULT 0,
      latency_ms INTEGER,
      last_checked_at TEXT,
      last_error TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS request_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_id TEXT NOT NULL,
      api_key_id INTEGER,
      api_key_prefix TEXT,
      requested_model TEXT NOT NULL,
      resolved_model TEXT,
      provider TEXT,
      channel_id TEXT,
      status TEXT NOT NULL,
      http_status INTEGER NOT NULL,
      prompt_tokens INTEGER NOT NULL DEFAULT 0,
      completion_tokens INTEGER NOT NULL DEFAULT 0,
      total_tokens INTEGER NOT NULL DEFAULT 0,
      rate REAL NOT NULL DEFAULT 1,
      billed_units REAL NOT NULL DEFAULT 0,
      latency_ms INTEGER NOT NULL DEFAULT 0,
      error TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_logs_created_at ON request_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_logs_api_key_id ON request_logs(api_key_id);
    CREATE INDEX IF NOT EXISTS idx_logs_model ON request_logs(resolved_model);
  `);

  const upsert = db.prepare(`
    INSERT INTO channels (
      id, provider, display_name, model, base_url, api_key_env, rate,
      enabled, healthy, updated_at
    )
    VALUES (
      @id, @provider, @display_name, @model, @base_url, @api_key_env, @rate,
      1, 0, @updated_at
    )
    ON CONFLICT(id) DO UPDATE SET
      provider = excluded.provider,
      display_name = excluded.display_name,
      model = excluded.model,
      base_url = excluded.base_url,
      api_key_env = excluded.api_key_env,
      rate = excluded.rate,
      updated_at = excluded.updated_at
  `);

  const timestamp = nowIso();
  for (const provider of providerDefinitions) {
    upsert.run({
      id: provider.id,
      provider: provider.provider,
      display_name: provider.displayName,
      model: provider.model,
      base_url: provider.baseUrl,
      api_key_env: provider.apiKeyEnv,
      rate: provider.rate,
      updated_at: timestamp
    });
  }
}

export function getDb() {
  if (globalThis.__aiRelayDb) return globalThis.__aiRelayDb;

  const file = databasePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  migrate(db);
  globalThis.__aiRelayDb = db;
  return db;
}

export function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function createRelayApiKey() {
  return `sk-relay-${crypto.randomBytes(24).toString("base64url")}`;
}

export function createApiKey(name: string, limitUnits: number) {
  const key = createRelayApiKey();
  const timestamp = nowIso();
  const record = getDb()
    .prepare(
      `
      INSERT INTO api_keys (
        name, key_hash, key_prefix, status, limit_units, used_units,
        created_at, updated_at
      )
      VALUES (?, ?, ?, 'active', ?, 0, ?, ?)
      RETURNING *
    `
    )
    .get(name.trim() || "未命名 Key", sha256(key), key.slice(0, 18), limitUnits, timestamp, timestamp) as ApiKeyRecord;

  return { key, record };
}

export function listApiKeys() {
  return getDb()
    .prepare(
      `
      SELECT * FROM api_keys
      ORDER BY created_at DESC
    `
    )
    .all() as ApiKeyRecord[];
}

export function findApiKeyBySecret(secret: string) {
  return getDb()
    .prepare("SELECT * FROM api_keys WHERE key_hash = ?")
    .get(sha256(secret)) as ApiKeyRecord | undefined;
}

export function updateApiKeyUsage(id: number, billedUnits: number) {
  getDb()
    .prepare(
      `
      UPDATE api_keys
      SET used_units = used_units + ?, last_used_at = ?, updated_at = ?
      WHERE id = ?
    `
    )
    .run(billedUnits, nowIso(), nowIso(), id);
}

export function updateApiKey(
  id: number,
  values: Partial<Pick<ApiKeyRecord, "name" | "status" | "limit_units">>
) {
  const current = getDb().prepare("SELECT * FROM api_keys WHERE id = ?").get(id) as
    | ApiKeyRecord
    | undefined;
  if (!current) return null;

  const next = {
    name: values.name ?? current.name,
    status: values.status ?? current.status,
    limit_units: values.limit_units ?? current.limit_units,
    updated_at: nowIso(),
    id
  };

  return getDb()
    .prepare(
      `
      UPDATE api_keys
      SET name = @name, status = @status, limit_units = @limit_units, updated_at = @updated_at
      WHERE id = @id
      RETURNING *
    `
    )
    .get(next) as ApiKeyRecord;
}

export function deleteApiKey(id: number) {
  return getDb().prepare("DELETE FROM api_keys WHERE id = ?").run(id);
}

export function listChannels() {
  return getDb()
    .prepare("SELECT * FROM channels ORDER BY id")
    .all() as ChannelRecord[];
}

export function getChannel(id: string) {
  return getDb().prepare("SELECT * FROM channels WHERE id = ?").get(id) as
    | ChannelRecord
    | undefined;
}

export function updateChannelEnabled(id: string, enabled: boolean) {
  return getDb()
    .prepare(
      `
      UPDATE channels
      SET enabled = ?, updated_at = ?
      WHERE id = ?
      RETURNING *
    `
    )
    .get(enabled ? 1 : 0, nowIso(), id) as ChannelRecord | undefined;
}

export function updateChannelHealth(
  id: string,
  values: Pick<ChannelRecord, "healthy" | "latency_ms" | "last_error">
) {
  return getDb()
    .prepare(
      `
      UPDATE channels
      SET healthy = @healthy,
          latency_ms = @latency_ms,
          last_error = @last_error,
          last_checked_at = @last_checked_at,
          updated_at = @updated_at
      WHERE id = @id
      RETURNING *
    `
    )
    .get({
      id,
      healthy: values.healthy,
      latency_ms: values.latency_ms,
      last_error: values.last_error,
      last_checked_at: nowIso(),
      updated_at: nowIso()
    }) as ChannelRecord | undefined;
}

export function insertRequestLog(log: Omit<RequestLogRecord, "id" | "created_at">) {
  getDb()
    .prepare(
      `
      INSERT INTO request_logs (
        request_id, api_key_id, api_key_prefix, requested_model, resolved_model,
        provider, channel_id, status, http_status, prompt_tokens, completion_tokens,
        total_tokens, rate, billed_units, latency_ms, error, created_at
      )
      VALUES (
        @request_id, @api_key_id, @api_key_prefix, @requested_model, @resolved_model,
        @provider, @channel_id, @status, @http_status, @prompt_tokens, @completion_tokens,
        @total_tokens, @rate, @billed_units, @latency_ms, @error, @created_at
      )
    `
    )
    .run({ ...log, created_at: nowIso() });
}

export function listRequestLogs(limit = 100) {
  return getDb()
    .prepare(
      `
      SELECT * FROM request_logs
      ORDER BY created_at DESC
      LIMIT ?
    `
    )
    .all(limit) as RequestLogRecord[];
}

export function deleteRequestLogsBefore(isoTimestamp: string) {
  return getDb()
    .prepare("DELETE FROM request_logs WHERE created_at < ?")
    .run(isoTimestamp);
}
