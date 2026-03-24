import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI 面试助手 - 智能面试辅助系统",
  description: "实时语音转写、智能问题识别、AI 参考答案生成",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh" className="dark">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className="antialiased bg-[#0F0F14] text-[#F0F0F5]">
        {children}
      </body>
    </html>
  );
}
