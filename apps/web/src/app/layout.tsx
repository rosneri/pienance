import type { Metadata, Viewport } from "next";
import { Fraunces, Geist } from "next/font/google";
import type { ReactNode } from "react";
import "./tokens.css";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  axes: ["SOFT", "opsz"],
  variable: "--font-fraunces",
  display: "swap",
});

const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });

export const metadata: Metadata = {
  title: "pienance",
  description: "Your money as a pie: see what is left in proportions, not numbers.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "oklch(97% 0.012 80)" },
    { media: "(prefers-color-scheme: dark)", color: "oklch(17% 0.014 55)" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${geist.variable}`}>
      <body>{children}</body>
    </html>
  );
}
