import { redirect } from "next/navigation";

export default function LegacyLogsPage() {
  redirect("/usage-logs/common");
}
