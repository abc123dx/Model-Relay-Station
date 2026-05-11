import {
  type RequestLogRecord,
  deleteRequestLogsBefore,
  getDb,
  listChannels,
  listRequestLogs
} from "@/lib/db";

export function channelSummaries() {
  return listChannels().map((channel) => ({
    ...channel,
    env_configured: Boolean(process.env[channel.api_key_env])
  }));
}

export function dashboardData() {
  const db = getDb();
  const totals = db
    .prepare(
      `
      SELECT
        COUNT(*) as total_requests,
        COALESCE(SUM(total_tokens), 0) as total_tokens,
        COALESCE(SUM(billed_units), 0) as total_billed,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_requests
      FROM request_logs
      WHERE created_at >= datetime('now', '-24 hours')
    `
    )
    .get() as {
    total_requests: number;
    total_tokens: number;
    total_billed: number;
    success_requests: number;
  };

  const keyStats = db
    .prepare(
      `
      SELECT
        COUNT(*) as total_keys,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_keys
      FROM api_keys
    `
    )
    .get() as { total_keys: number; active_keys: number };

  const usageByDay = db
    .prepare(
      `
      SELECT
        substr(created_at, 1, 10) as date,
        COUNT(*) as requests,
        COALESCE(SUM(total_tokens), 0) as tokens,
        COALESCE(SUM(billed_units), 0) as billed
      FROM request_logs
      WHERE created_at >= datetime('now', '-13 days')
      GROUP BY substr(created_at, 1, 10)
      ORDER BY date ASC
    `
    )
    .all() as Array<{ date: string; requests: number; tokens: number; billed: number }>;

  const modelShare = db
    .prepare(
      `
      SELECT
        COALESCE(resolved_model, requested_model) as model,
        COUNT(*) as requests,
        COALESCE(SUM(total_tokens), 0) as tokens
      FROM request_logs
      WHERE created_at >= datetime('now', '-14 days')
      GROUP BY COALESCE(resolved_model, requested_model)
      ORDER BY requests DESC
    `
    )
    .all() as Array<{ model: string; requests: number; tokens: number }>;

  return {
    totals,
    keyStats,
    channels: channelSummaries(),
    usageByDay,
    modelShare,
    recentLogs: listRequestLogs(8)
  };
}

export function logsData() {
  return listRequestLogs(200);
}

export type UsageLogFilters = {
  page?: number;
  pageSize?: number;
  status?: string;
  model?: string;
  channel?: string;
  key?: string;
  q?: string;
  from?: string;
  to?: string;
};

function normalizePageSize(value?: number) {
  const allowed = [10, 20, 50, 100];
  return allowed.includes(Number(value)) ? Number(value) : 20;
}

function logWhere(filters: UsageLogFilters) {
  const where: string[] = [];
  const params: Array<string | number> = [];

  if (filters.status && filters.status !== "all") {
    where.push("status = ?");
    params.push(filters.status);
  }

  if (filters.model && filters.model !== "all") {
    where.push("COALESCE(resolved_model, requested_model) = ?");
    params.push(filters.model);
  }

  if (filters.channel && filters.channel !== "all") {
    where.push("channel_id = ?");
    params.push(filters.channel);
  }

  if (filters.key && filters.key !== "all") {
    where.push("api_key_prefix = ?");
    params.push(filters.key);
  }

  if (filters.from) {
    where.push("created_at >= ?");
    params.push(filters.from);
  }

  if (filters.to) {
    where.push("created_at <= ?");
    params.push(filters.to);
  }

  if (filters.q?.trim()) {
    const q = `%${filters.q.trim()}%`;
    where.push(`
      (
        request_id LIKE ?
        OR api_key_prefix LIKE ?
        OR requested_model LIKE ?
        OR COALESCE(resolved_model, '') LIKE ?
        OR COALESCE(provider, '') LIKE ?
        OR COALESCE(channel_id, '') LIKE ?
        OR COALESCE(error, '') LIKE ?
      )
    `);
    params.push(q, q, q, q, q, q, q);
  }

  return {
    clause: where.length ? `WHERE ${where.join(" AND ")}` : "",
    params
  };
}

export function usageLogsData(filters: UsageLogFilters = {}) {
  const db = getDb();
  const page = Math.max(1, Number(filters.page ?? 1));
  const pageSize = normalizePageSize(filters.pageSize);
  const offset = (page - 1) * pageSize;
  const where = logWhere(filters);

  const summary = db
    .prepare(
      `
      SELECT
        COUNT(*) as total_requests,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_requests,
        COALESCE(SUM(prompt_tokens), 0) as prompt_tokens,
        COALESCE(SUM(completion_tokens), 0) as completion_tokens,
        COALESCE(SUM(total_tokens), 0) as total_tokens,
        COALESCE(SUM(billed_units), 0) as billed_units,
        COALESCE(AVG(latency_ms), 0) as avg_latency_ms
      FROM request_logs
      ${where.clause}
    `
    )
    .get(...where.params) as {
    total_requests: number;
    success_requests: number;
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    billed_units: number;
    avg_latency_ms: number;
  };

  const rows = db
    .prepare(
      `
      SELECT *
      FROM request_logs
      ${where.clause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `
    )
    .all(...where.params, pageSize, offset) as RequestLogRecord[];

  const trend = db
    .prepare(
      `
      SELECT
        substr(created_at, 1, 10) as date,
        COUNT(*) as requests,
        COALESCE(SUM(total_tokens), 0) as tokens,
        COALESCE(SUM(billed_units), 0) as billed
      FROM request_logs
      ${where.clause}
      GROUP BY substr(created_at, 1, 10)
      ORDER BY date ASC
      LIMIT 30
    `
    )
    .all(...where.params) as Array<{
    date: string;
    requests: number;
    tokens: number;
    billed: number;
  }>;

  const modelShare = db
    .prepare(
      `
      SELECT
        COALESCE(resolved_model, requested_model) as model,
        COUNT(*) as requests,
        COALESCE(SUM(total_tokens), 0) as tokens
      FROM request_logs
      ${where.clause}
      GROUP BY COALESCE(resolved_model, requested_model)
      ORDER BY requests DESC
      LIMIT 8
    `
    )
    .all(...where.params) as Array<{
    model: string;
    requests: number;
    tokens: number;
  }>;

  const modelOptions = db
    .prepare(
      `
      SELECT DISTINCT COALESCE(resolved_model, requested_model) as value
      FROM request_logs
      WHERE COALESCE(resolved_model, requested_model) IS NOT NULL
      ORDER BY value
    `
    )
    .all() as Array<{ value: string }>;

  const keyOptions = db
    .prepare(
      `
      SELECT DISTINCT api_key_prefix as value
      FROM request_logs
      WHERE api_key_prefix IS NOT NULL
      ORDER BY value
    `
    )
    .all() as Array<{ value: string }>;

  return {
    rows,
    summary,
    trend,
    modelShare,
    page,
    pageSize,
    total: summary.total_requests,
    totalPages: Math.max(1, Math.ceil(summary.total_requests / pageSize)),
    filters,
    options: {
      models: modelOptions.map((item) => item.value),
      keys: keyOptions.map((item) => item.value),
      channels: channelSummaries().map((channel) => ({
        id: channel.id,
        name: channel.display_name
      }))
    }
  };
}

export function clearLogsOlderThan(days: number) {
  const normalized = Math.max(1, Math.min(3650, Number(days) || 30));
  const before = new Date(Date.now() - normalized * 24 * 60 * 60 * 1000).toISOString();
  return deleteRequestLogsBefore(before);
}
