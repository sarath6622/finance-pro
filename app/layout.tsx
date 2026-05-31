import type { Metadata, Viewport } from "next";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Finance Tracker",
  description: "Personal finance tracker — Life OS",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#1F6FEB",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
