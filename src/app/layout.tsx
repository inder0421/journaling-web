import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Discipline Journal",
  description:
    "A trading discipline journal that makes overriding your own risk rules harder.",
  applicationName: "Discipline Journal",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Discipline",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0a0b0d",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-bg text-fg antialiased">{children}</body>
    </html>
  );
}
