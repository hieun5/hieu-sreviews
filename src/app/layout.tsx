import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

const sans = localFont({
  src: [
    { path: "./fonts/dm-sans-regular.ttf", weight: "400", style: "normal" },
    { path: "./fonts/dm-sans-bold.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-journal-sans",
  display: "swap",
});
const serif = localFont({
  src: "./fonts/libre-caslon-text-bold.ttf",
  weight: "700",
  variable: "--font-journal-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "hieu’s reviews",
    template: "%s · hieu’s reviews",
  },
  description: "Restaurant and café reviews with friends.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#faf9f5",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable}`}>
      <body>{children}</body>
    </html>
  );
}
