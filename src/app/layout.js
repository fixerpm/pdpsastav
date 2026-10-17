import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ConvexClientProvider from "./ConvexClientProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

import { BRAND_CONFIG } from "@/config/branding";

export const metadata = {
  title: `${BRAND_CONFIG.name} — Real-Time Chat`,
  description: `${BRAND_CONFIG.name} — Zamonaviy, xavfsiz va professional real-time chat platformasi`,
  icons: {
    icon: BRAND_CONFIG.avatarUrl,
    apple: BRAND_CONFIG.avatarUrl,
  },
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="uz"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-100">
        <Suspense fallback={null}>
          <ConvexClientProvider>{children}</ConvexClientProvider>
        </Suspense>
      </body>
    </html>
  );
}
