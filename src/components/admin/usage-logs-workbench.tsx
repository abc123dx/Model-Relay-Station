"use client";

import { Fragment, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  RefreshCw,
  Search,
  Trash2
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { compactKey, formatDateTime, formatNumber } from "@/lib/utils";
import type { RequestLogRecord } from "@/lib/db";
import type { usageLogsData } from "@/lib/admin-data";

type UsageLogsPayload = ReturnType<typeof usageLogsData>;
type Filters = UsageLogsPayload["filters"];

function selectClassName() {
  return "h-10 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
}

function makeParams(filters: Filters) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && String(value).length > 0) {
      params.set(key, String(value));
    }
  }
  return params;
}

function asCsvValue(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function toCsv(rows: RequestLogRecord[]) {
  const headers = [
    "created_at",
    "request_id",
    "api_key_prefix",
    "requested_model",
    "resolved_model",
    "provider",
    "channel_id",
    "status",
    "http_status",
    "prompt_tokens",
    "completion_tokens",
    "total_tokens",
    "rate",
    "billed_units",
    "latency_ms",
    "error"
  ];

  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => asCsvValue(row[header as keyof RequestLogRecord])).join(","))
  ].join("\n");
}

export function UsageLogsWorkbench({ initialData }: { initialData: UsageLogsPayload }) {
  const [data, setData] = useState(initialData);
  const [draft, setDraft] = useState<Filters>(initialData.filters);
  const [busy, setBusy] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  const successRate = useMemo(() => {
    if (!data.summary.total_requests) return 100;
    return (data.summary.success_requests / data.summary.total_requests) * 100;
  }, [data.summary.success_requests, data.summary.total_requests]);

  async function load(next: Filters) {
    setBusy(true);
    setMessage("");
    const response = await fetch(`/api/admin/logs?${makeParams(next).toString()}`);
    const payload = (await response.json()) as UsageLogsPayload;
    setBusy(false);
    if (!response.ok) {
      setMessage("加载失败，请重新登录后再试");
      return;
    }
    setData(payload);
    setDraft(payload.filters);
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    load({ ...draft, page: 1 });
  }

  function resetFilters() {
    const next = {
      page: 1,
      pageSize: data.pageSize,
      status: "all",
      model: "all",
      channel: "all",
      key: "all",
      q: "",
      from: "",
      to: ""
    };
    load(next);
  }

  function changePage(page: number) {
    load({ ...data.filters, page: Math.min(Math.max(1, page), data.totalPages) });
  }

  function downloadCsv() {
    const csv = toCsv(data.rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `ai-relay-usage-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function clearOldLogs() {
    setBusy(true);
    const response = await fetch("/api/admin/logs?days=30", { method: "DELETE" });
    const payload = (await response.json().catch(() => ({}))) as { deleted?: number };
    setBusy(false);
    if (!response.ok) {
      setMessage("清理失败，请稍后重试");
      return;
    }
    setMessage(`已清理 30 天前日志 ${payload.deleted ?? 0} 条`);
    await load({ ...data.filters, page: 1 });
  }

  const stats = [
    {
      label: "请求数",
      value: formatNumber(data.summary.total_requests),
      hint: `${successRate.toFixed(1)}% 成功率`
    },
    {
      label: "Token 消耗",
      value: formatNumber(data.summary.total_tokens),
      hint: `Prompt ${formatNumber(data.summary.prompt_tokens)} / Completion ${formatNumber(
        data.summary.completion_tokens
      )}`
    },
    {
      label: "计费单位",
      value: formatNumber(data.summary.billed_units, 2),
      hint: "已按模型倍率折算"
    },
    {
      label: "平均耗时",
      value: `${Math.round(data.summary.avg_latency_ms)}ms`,
      hint: "当前筛选范围"
    }
  ];

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-3 flex flex-wrap gap-2">
            <a
              href="/usage-logs/common"
              className="rounded-md border bg-foreground px-3 py-1.5 text-sm font-medium text-background"
            >
              Common Logs
            </a>
            <span className="rounded-md border px-3 py-1.5 text-sm text-muted-foreground">
              Drawing Logs
            </span>
            <span className="rounded-md border px-3 py-1.5 text-sm text-muted-foreground">
              Task Logs
            </span>
          </div>
          <h1 className="text-2xl font-semibold tracking-normal">使用日志</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            按请求、模型、渠道和 Key 追踪 API 调用，定位失败、观察消耗，并导出当前页数据。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => load(data.filters)} disabled={busy}>
            <RefreshCw className={busy ? "animate-spin" : ""} />
            刷新
          </Button>
          <Button type="button" variant="outline" onClick={downloadCsv} disabled={!data.rows.length}>
            <Download />
            导出 CSV
          </Button>
          <Button type="button" variant="outline" onClick={clearOldLogs} disabled={busy}>
            <Trash2 />
            清理旧日志
          </Button>
        </div>
      </section>

      {message ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {message}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold tracking-normal">{stat.value}</div>
              <p className="mt-1 text-xs text-muted-foreground">{stat.hint}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            筛选
          </CardTitle>
          <CardDescription>支持时间范围、状态、模型、渠道、Key 和关键词组合查询</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 lg:grid-cols-12" onSubmit={submit}>
            <Input
              className="lg:col-span-3"
              placeholder="Request ID / 模型 / 错误 / Key"
              value={draft.q ?? ""}
              onChange={(event) => setDraft((current) => ({ ...current, q: event.target.value }))}
            />
            <select
              className={`${selectClassName()} lg:col-span-2`}
              value={draft.status ?? "all"}
              onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value }))}
            >
              <option value="all">全部状态</option>
              <option value="success">成功</option>
              <option value="error">失败</option>
            </select>
            <select
              className={`${selectClassName()} lg:col-span-2`}
              value={draft.model ?? "all"}
              onChange={(event) => setDraft((current) => ({ ...current, model: event.target.value }))}
            >
              <option value="all">全部模型</option>
              {data.options.models.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
            <select
              className={`${selectClassName()} lg:col-span-2`}
              value={draft.channel ?? "all"}
              onChange={(event) => setDraft((current) => ({ ...current, channel: event.target.value }))}
            >
              <option value="all">全部渠道</option>
              {data.options.channels.map((channel) => (
                <option key={channel.id} value={channel.id}>
                  {channel.name}
                </option>
              ))}
            </select>
            <select
              className={`${selectClassName()} lg:col-span-2`}
              value={draft.key ?? "all"}
              onChange={(event) => setDraft((current) => ({ ...current, key: event.target.value }))}
            >
              <option value="all">全部 Key</option>
              {data.options.keys.map((key) => (
                <option key={key} value={key}>
                  {compactKey(key)}
                </option>
              ))}
            </select>
            <select
              className={selectClassName()}
              value={draft.pageSize ?? data.pageSize}
              onChange={(event) =>
                load({ ...draft, page: 1, pageSize: Number(event.target.value) })
              }
            >
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
            <Input
              className="lg:col-span-3"
              type="datetime-local"
              value={draft.from ?? ""}
              onChange={(event) => setDraft((current) => ({ ...current, from: event.target.value }))}
            />
            <Input
              className="lg:col-span-3"
              type="datetime-local"
              value={draft.to ?? ""}
              onChange={(event) => setDraft((current) => ({ ...current, to: event.target.value }))}
            />
            <div className="flex gap-2 lg:col-span-6 lg:justify-end">
              <Button type="submit" disabled={busy}>
                <Search />
                查询
              </Button>
              <Button type="button" variant="outline" onClick={resetFilters} disabled={busy}>
                重置
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.8fr)]">
        <Card>
          <CardHeader>
            <CardTitle>消耗趋势</CardTitle>
            <CardDescription>当前筛选范围内按天聚合</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="tokens"
                    name="Tokens"
                    stroke="#059669"
                    fill="#d1fae5"
                    fillOpacity={0.55}
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="requests"
                    name="请求数"
                    stroke="#2563eb"
                    fill="#dbeafe"
                    fillOpacity={0.4}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>模型排行</CardTitle>
            <CardDescription>按调用次数排序</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.modelShare} layout="vertical" margin={{ left: 22 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                  <YAxis
                    type="category"
                    dataKey="model"
                    width={112}
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip />
                  <Bar dataKey="requests" name="请求数" fill="#f59e0b" radius={[0, 5, 5, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle>Common Logs</CardTitle>
            <CardDescription>
              第 {data.page} / {data.totalPages} 页，共 {formatNumber(data.total)} 条
            </CardDescription>
          </div>
          <Badge variant="secondary">{data.pageSize} / page</Badge>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>时间</TableHead>
                <TableHead>Request ID</TableHead>
                <TableHead>Key</TableHead>
                <TableHead>模型</TableHead>
                <TableHead>渠道</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>Token</TableHead>
                <TableHead>计费</TableHead>
                <TableHead>耗时</TableHead>
                <TableHead className="text-right">详情</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((log) => {
                const expanded = expandedId === log.id;
                return (
                  <Fragment key={log.id}>
                    <TableRow>
                      <TableCell>{formatDateTime(log.created_at)}</TableCell>
                      <TableCell className="font-mono text-xs">{log.request_id}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {log.api_key_prefix ? compactKey(log.api_key_prefix) : "-"}
                      </TableCell>
                      <TableCell>
                        <div className="font-mono text-xs">{log.resolved_model ?? "-"}</div>
                        <div className="text-xs text-muted-foreground">{log.requested_model}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{log.provider ?? "-"}</div>
                        <div className="text-xs text-muted-foreground">{log.channel_id ?? "-"}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={log.status === "success" ? "success" : "destructive"}>
                          {log.status === "success" ? "成功" : log.http_status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div>{formatNumber(log.total_tokens)}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatNumber(log.prompt_tokens)} / {formatNumber(log.completion_tokens)}
                        </div>
                      </TableCell>
                      <TableCell>{formatNumber(log.billed_units, 2)}</TableCell>
                      <TableCell>{log.latency_ms}ms</TableCell>
                      <TableCell>
                        <div className="flex justify-end">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => setExpandedId(expanded ? null : log.id)}
                          >
                            <ChevronDown className={expanded ? "rotate-180" : ""} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {expanded ? (
                      <TableRow>
                        <TableCell colSpan={10} className="bg-secondary/45">
                          <div className="grid gap-3 text-sm lg:grid-cols-4">
                            <div>
                              <div className="text-xs text-muted-foreground">Request ID</div>
                              <div className="break-all font-mono text-xs">{log.request_id}</div>
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground">倍率</div>
                              <div>{log.rate}x</div>
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground">HTTP</div>
                              <div>{log.http_status}</div>
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground">错误</div>
                              <div className="break-all text-xs">{log.error || "-"}</div>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </Fragment>
                );
              })}
              {data.rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="h-28 text-center text-muted-foreground">
                    当前筛选条件下没有日志
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
              显示 {data.rows.length} 条，按时间倒序排列
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={busy || data.page <= 1}
                onClick={() => changePage(data.page - 1)}
              >
                <ChevronLeft />
                上一页
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy || data.page >= data.totalPages}
                onClick={() => changePage(data.page + 1)}
              >
                下一页
                <ChevronRight />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
