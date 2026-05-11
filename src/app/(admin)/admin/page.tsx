import { Activity, CheckCircle2, CircleDollarSign, KeyRound, Network } from "lucide-react";
import { DashboardCharts } from "@/components/admin/dashboard-charts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { dashboardData } from "@/lib/admin-data";
import { formatDateTime, formatNumber } from "@/lib/utils";

export default function AdminDashboardPage() {
  const data = dashboardData();
  const successRate =
    data.totals.total_requests > 0
      ? (data.totals.success_requests / data.totals.total_requests) * 100
      : 100;
  const healthyChannels = data.channels.filter(
    (channel) => channel.enabled === 1 && channel.healthy === 1
  ).length;

  const stats = [
    {
      label: "24h 请求",
      value: formatNumber(data.totals.total_requests),
      icon: Activity,
      hint: `${successRate.toFixed(1)}% 成功率`
    },
    {
      label: "24h Token",
      value: formatNumber(data.totals.total_tokens),
      icon: CircleDollarSign,
      hint: `${formatNumber(data.totals.total_billed, 2)} 计费单位`
    },
    {
      label: "活跃 Key",
      value: formatNumber(data.keyStats.active_keys ?? 0),
      icon: KeyRound,
      hint: `总计 ${formatNumber(data.keyStats.total_keys ?? 0)} 个`
    },
    {
      label: "健康渠道",
      value: `${healthyChannels}/${data.channels.length}`,
      icon: Network,
      hint: "后台定期探活"
    }
  ];

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-normal">仪表盘</h1>
          <Badge variant="success">OpenAI API 兼容</Badge>
        </div>
        <p className="max-w-3xl text-sm text-muted-foreground">
          对外入口 `/v1/chat/completions`，支持非流式和 SSE 流式转发，按模型倍率记录用量。
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.label}>
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {item.label}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold tracking-normal">{item.value}</div>
                <p className="mt-1 text-xs text-muted-foreground">{item.hint}</p>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <DashboardCharts usageByDay={data.usageByDay} modelShare={data.modelShare} />

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader>
            <CardTitle>最近调用</CardTitle>
            <CardDescription>最新 8 条请求记录</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>时间</TableHead>
                  <TableHead>模型</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>Tokens</TableHead>
                  <TableHead>耗时</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>{formatDateTime(log.created_at)}</TableCell>
                    <TableCell className="font-mono text-xs">{log.resolved_model ?? log.requested_model}</TableCell>
                    <TableCell>
                      <Badge variant={log.status === "success" ? "success" : "destructive"}>
                        {log.status === "success" ? "成功" : "失败"}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatNumber(log.total_tokens)}</TableCell>
                    <TableCell>{log.latency_ms}ms</TableCell>
                  </TableRow>
                ))}
                {data.recentLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      暂无调用记录
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>渠道状态</CardTitle>
            <CardDescription>启用、健康和环境变量配置</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.channels.map((channel) => (
              <div key={channel.id} className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <div className="font-medium">{channel.display_name}</div>
                  <div className="text-xs text-muted-foreground">{channel.model}</div>
                </div>
                <Badge
                  variant={
                    channel.enabled !== 1
                      ? "secondary"
                      : !channel.env_configured
                        ? "warning"
                        : channel.healthy === 1
                          ? "success"
                          : "destructive"
                  }
                >
                  {channel.enabled !== 1 ? (
                    "停用"
                  ) : !channel.env_configured ? (
                    "未配置"
                  ) : channel.healthy === 1 ? (
                    <span className="inline-flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      可用
                    </span>
                  ) : (
                    "异常"
                  )}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
