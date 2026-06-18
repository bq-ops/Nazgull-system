"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

// ─── nav config ─────────────────────────────────────────────────────────────

const NAV = [
  { label: "Dashboard", href: "/" },
  { label: "Products", href: "/products" },
  { label: "Purchases", href: "/purchases" },
  { label: "Sales", href: "/sales" },
  { label: "Expenses", href: "/expenses" },
] as const;

function isActive(href: string, pathname: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

// ─── shared pieces ───────────────────────────────────────────────────────────

function Logo() {
  return (
    <Link href="/" className="block px-5 py-5 focus-visible:outline-none">
      <span className="font-display text-xl font-bold tracking-tight text-brand-oxblood select-none">
        NAZGULL
      </span>
    </Link>
  );
}

function NavLinks({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex-1 space-y-0.5 px-3 py-2">
      {NAV.map(({ label, href }) => {
        const active = isActive(href, pathname);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={`flex items-center rounded-card px-3 py-2 text-sm transition-colors ${
              active
                ? "bg-blush font-medium text-brand-oxblood"
                : "text-text-muted hover:bg-blush/50 hover:text-text"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

// ─── SVG icons ───────────────────────────────────────────────────────────────

function Hamburger() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden
    >
      <rect x="2" y="4"  width="16" height="1.75" rx="0.875" />
      <rect x="2" y="9.125" width="16" height="1.75" rx="0.875" />
      <rect x="2" y="14.25" width="16" height="1.75" rx="0.875" />
    </svg>
  );
}

function Close() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden
    >
      <path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" />
    </svg>
  );
}

// ─── shell ───────────────────────────────────────────────────────────────────

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close drawer whenever the route changes
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <div className="flex h-dvh overflow-hidden bg-bg">
      {/* ── Desktop sidebar (hidden on mobile) ── */}
      <aside className="hidden w-56 shrink-0 flex-col border-r border-border bg-surface md:flex">
        <Logo />
        <hr className="border-border" />
        <NavLinks pathname={pathname} />
      </aside>

      {/* ── Right: top-bar + scrollable content ── */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Mobile top bar */}
        <header className="flex items-center justify-between border-b border-border bg-surface px-4 py-3 md:hidden">
          <span className="font-display text-lg font-bold tracking-tight text-brand-oxblood select-none">
            NAZGULL
          </span>
          <button
            onClick={() => setMenuOpen(true)}
            aria-label="Open navigation menu"
            className="rounded-card p-1.5 text-text-muted transition-colors hover:bg-blush hover:text-text"
          >
            <Hamburger />
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>

      {/* ── Mobile drawer ── */}

      {/* Backdrop */}
      <div
        aria-hidden={!menuOpen}
        className={`fixed inset-0 z-40 bg-text/40 backdrop-blur-sm transition-opacity duration-200 md:hidden ${
          menuOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setMenuOpen(false)}
      />

      {/* Slide-in panel */}
      <aside
        aria-label="Navigation menu"
        className={`fixed inset-y-0 left-0 z-50 flex w-56 flex-col border-r border-border bg-surface shadow-xl transition-transform duration-200 ease-in-out md:hidden ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-4 py-3">
          <span className="font-display text-lg font-bold tracking-tight text-brand-oxblood select-none">
            NAZGULL
          </span>
          <button
            onClick={() => setMenuOpen(false)}
            aria-label="Close navigation menu"
            className="rounded-card p-1.5 text-text-muted transition-colors hover:bg-blush hover:text-text"
          >
            <Close />
          </button>
        </div>
        <hr className="border-border" />
        <NavLinks pathname={pathname} onNavigate={() => setMenuOpen(false)} />
      </aside>
    </div>
  );
}
