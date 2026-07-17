import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Model Relay Station",
  description: "A self-hosted, OpenAI-compatible gateway for multiple LLM providers"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
