import type { Metadata } from "next";
import { NavBar } from "@/components/nav-bar";
import "./globals.css";

export const metadata: Metadata = {
  title: "MacroEngine",
  description: "Smart nutrition tracking with real Garmin data",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-100 min-h-screen">
        <NavBar />
        <div className="pb-16 md:pb-0">
          {children}
        </div>
      </body>
    </html>
  );
}
