import type { Metadata, Viewport } from "next";
import { Figtree, Newsreader } from "next/font/google";
import { APP_DESCRIPTION, APP_NAME } from "@/lib/app";
import "./globals.css";

// Free stand-ins for UC Davis's brand faces: Figtree for Proxima Nova, Newsreader for Freight.
const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
});

export const metadata: Metadata = {
  title: `${APP_NAME} · UC Davis dining menus`,
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  appleWebApp: {
    capable: true,
    title: APP_NAME,
    // Content runs under the status bar; the app paints it navy to match the header.
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
  openGraph: {
    title: APP_NAME,
    description: APP_DESCRIPTION,
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Aggie Blue, so the browser bar blends into the header.
  themeColor: "#022851",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${figtree.variable} ${newsreader.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
