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
  title: "CetakFoto Studio — Cetak Foto, Polaroid & Dokumen",
  description:
    "Aplikasi cetak foto profesional dengan berbagai ukuran (2x3, 3x4, 4x6, 1R-10R) di kertas A5-A3. Polaroid klasik, editor HD, dan cetak dokumen langsung dari browser.",
  keywords: [
    "cetak foto",
    "pas foto",
    "polaroid",
    "cetak A4",
    "cetak A3",
    "cetak dokumen",
    "print foto",
    "photo editor",
  ],
  authors: [{ name: "CetakFoto Studio" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
