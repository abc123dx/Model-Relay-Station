import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ai-relay",
  description: "OpenAI compatible AI model relay station"
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
