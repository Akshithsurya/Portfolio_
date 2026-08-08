import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Akshith Surya",

  openGraph: {
    title: "Akshith Surya",
    description: "Akshith Surya's personal portfolio",
    url: "https://project-rkhh.vercel.app",
    siteName: "Akshith Surya",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Akshith Surya",
    description: "Akshith Surya's personal portfolio",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
