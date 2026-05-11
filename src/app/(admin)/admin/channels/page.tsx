import { ChannelManager } from "@/components/admin/channel-manager";
import { channelSummaries } from "@/lib/admin-data";

export default function ChannelsPage() {
  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-semibold tracking-normal">渠道管理</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          DeepSeek V4、智谱 GLM-5、通义千问 qwen-plus 三个渠道会参与 `auto` 负载均衡和失败重试。
        </p>
      </section>
      <ChannelManager initialChannels={channelSummaries()} />
    </div>
  );
}
