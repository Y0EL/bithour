import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "@/lib/suppress-logs";
import LogSuppressor from "@/components/LogSuppressor";
import NextAuthProvider from "@/components/NextAuthProvider";
import I18nProvider from "@/components/I18nProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  title: "Bithour Production",
  description: "Internal Document Management & Creator Pipeline System — Bithour Production",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.svg",
    apple: "/bithour-logo.webp",
  },
  openGraph: {
    title: "Bithour Production | Internal Portal",
    description: "Internal Document Management & Creator Pipeline System — Bithour Production",
    siteName: "Bithour Production",
    locale: "id_ID",
    type: "website",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Bithour Production" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Bithour Production | Internal Portal",
    description: "Internal Document Management & Creator Pipeline System",
    images: ["/opengraph-image"],
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#000000',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
        <LogSuppressor />
        <NextAuthProvider>
          <I18nProvider>
            {children}
          </I18nProvider>
        </NextAuthProvider>
      </body>
    </html>
  );
}
