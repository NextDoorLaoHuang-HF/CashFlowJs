import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import "./ui.css";

const inter = localFont({
  src: [
    {
      path: "./fonts/Inter-roman.var.woff2",
      style: "normal",
      weight: "100 900"
    },
    {
      path: "./fonts/Inter-italic.var.woff2",
      style: "italic",
      weight: "100 900"
    }
  ],
  variable: "--font-inter",
  display: "swap"
});

export const metadata: Metadata = {
  title: "CashFlow JS Refactor",
  description: "Modernized CashFlow-style simulator ready for Vercel"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh">
      <body className={inter.variable}>{children}</body>
    </html>
  );
}
