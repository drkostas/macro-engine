"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Home", icon: "◉" },
  { href: "/foods", label: "Foods", icon: "+" },
  { href: "/setup", label: "Settings", icon: "⚙" },
];

export function NavBar() {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop: top bar */}
      <nav className="hidden md:flex items-center justify-between px-6 py-3 bg-slate-900 border-b border-slate-800">
        <Link href="/dashboard" className="text-lg font-bold text-slate-100">
          MacroEngine
        </Link>
        <div className="flex items-center gap-1">
          {NAV_ITEMS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                pathname === href || pathname.startsWith(href + "/")
                  ? "bg-blue-600 text-white font-medium"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
      </nav>

      {/* Mobile: bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around bg-slate-900 border-t border-slate-800 py-2 pb-[env(safe-area-inset-bottom)]">
        {NAV_ITEMS.map(({ href, label, icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center gap-0.5 px-4 py-1 min-w-[64px] ${
              pathname === href || pathname.startsWith(href + "/")
                ? "text-blue-400"
                : "text-slate-500"
            }`}
          >
            <span className="text-lg">{icon}</span>
            <span className="text-[10px] font-medium">{label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
