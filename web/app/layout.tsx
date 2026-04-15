import type { Metadata, Viewport } from "next";
import { NavBar } from "@/components/nav-bar";
import { UndoToastProvider } from "@/lib/use-undo-toast";
import "./globals.css";

export const metadata: Metadata = {
  title: "MacroEngine",
  description: "Smart nutrition tracking with real Garmin data",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "MacroEngine",
  },
};

export const viewport: Viewport = {
  themeColor: "#0A1720",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className="bg-base text-text min-h-screen antialiased">
        <UndoToastProvider>
          <NavBar />
          <div className="pb-16 md:pb-0">
            {children}
          </div>
        </UndoToastProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                navigator.serviceWorker.register('/sw.js').catch(() => {});
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
