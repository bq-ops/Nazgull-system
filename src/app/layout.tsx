import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import AppShellWrapper from "@/components/AppShellWrapper";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "NAZGULL", template: "%s — NAZGULL" },
  description: "Sales, inventory, and profit dashboard for NAZGULL boutique.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
      <body>
        <AppShellWrapper>{children}</AppShellWrapper>
      </body>
    </html>
  );
}
