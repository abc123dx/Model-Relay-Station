import { UsageLogsWorkbench } from "@/components/admin/usage-logs-workbench";
import { usageLogsData } from "@/lib/admin-data";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CommonUsageLogsPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const data = usageLogsData({
    page: Number(one(params.page) ?? 1),
    pageSize: Number(one(params.pageSize) ?? 20),
    status: one(params.status) ?? "all",
    model: one(params.model) ?? "all",
    channel: one(params.channel) ?? "all",
    key: one(params.key) ?? "all",
    q: one(params.q) ?? "",
    from: one(params.from) ?? "",
    to: one(params.to) ?? ""
  });

  return <UsageLogsWorkbench initialData={data} />;
}
