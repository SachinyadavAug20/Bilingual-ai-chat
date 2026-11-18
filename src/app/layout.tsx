import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vibbber — Bilingual AI Parenting Coach (English & Urdu)",
  description:
    "Evidence-based, bilingual AI parenting coach with strict safety guardrails, structured practical advice, and zero logins.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
