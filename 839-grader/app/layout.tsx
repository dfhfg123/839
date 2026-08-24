import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "839 批改助手 | 北师大教育实践与方法",
  description: "北师大839专业课论述题与教案设计题诊断批改工具",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
