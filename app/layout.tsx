import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const inter = localFont({
  src: [
    {
      path: "../public/fonts/Inter-roman.var.woff2",
      style: "normal",
      weight: "100 900"
    },
    {
      path: "../public/fonts/Inter-italic.var.woff2",
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
    <html lang="en">
      <body className={inter.variable}>{children}</body>
    </html>
  );
}
