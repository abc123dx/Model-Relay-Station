export type ProviderDefinition = {
  id: "deepseek" | "zhipu" | "qwen";
  provider: string;
  displayName: string;
  model: string;
  aliases: string[];
  baseUrl: string;
  apiKeyEnv: string;
  rate: number;
};

export const providerDefinitions: ProviderDefinition[] = [
  {
    id: "deepseek",
    provider: "DeepSeek",
    displayName: "DeepSeek V4",
    model: "deepseek-v4-pro",
    aliases: ["deepseek-v4", "deepseek-v4-pro", "deepseek-v4-flash", "deepseek-chat", "deepseek"],
    baseUrl: "https://api.deepseek.com",
    apiKeyEnv: "DEEPSEEK_API_KEY",
    rate: 1
  },
  {
    id: "zhipu",
    provider: "智谱 GLM",
    displayName: "智谱 GLM-5",
    model: "glm-5",
    aliases: ["glm-5", "glm-5-air", "glm-5-flash", "zhipu", "glm"],
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    apiKeyEnv: "ZHIPU_API_KEY",
    rate: 1.2
  },
  {
    id: "qwen",
    provider: "通义千问",
    displayName: "通义千问 qwen-plus",
    model: "qwen-plus",
    aliases: ["qwen-plus", "qwen", "dashscope", "tongyi"],
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    apiKeyEnv: "DASHSCOPE_API_KEY",
    rate: 0.8
  }
];

export function getProviderByModel(model: string | undefined | null) {
  if (!model || model === "auto") return null;
  const normalized = model.toLowerCase();
  return providerDefinitions.find((provider) =>
    provider.aliases.some((alias) => alias.toLowerCase() === normalized)
  );
}

export function getProviderDefinition(id: string) {
  return providerDefinitions.find((provider) => provider.id === id);
}
