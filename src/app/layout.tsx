import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import GlobalPlayer from "@/components/player/GlobalPlayer";
import BottomTabBar from "@/components/layout/BottomTabBar";
import SwipeNavigation from "@/components/layout/SwipeNavigation";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Slowi Music",
  description: "Personal Google Drive Music Player",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-black text-white`}
        suppressHydrationWarning
      >
        <SwipeNavigation>
           {children}
        </SwipeNavigation>
        <GlobalPlayer />
        <BottomTabBar />
      </body>
    </html>
  );
}
