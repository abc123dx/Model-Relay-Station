"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Gauge,
  KeyRound,
  ListChecks,
  Network,
  Router
} from "lucide-react";
import { LogoutButton } from "@/components/admin/logout-button";
import { cn } from "@/lib/utils";

const navGroups = [
  {
    title: "Console",
    items: [
      { href: "/admin", label: "Overview", icon: Gauge },
      { href: "/admin/keys", label: "API Keys", icon: KeyRound },
      { href: "/usage-logs/common", label: "Usage Logs", icon: ListChecks }
    ]
  },
  {
    title: "Admin",
    items: [
      { href: "/admin/channels", label: "Channels", icon: Network }
    ]
  }
];

function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r bg-card lg:flex lg:flex-col">
        <div className="flex h-16 items-center gap-3 border-b px-5">
          <Link href="/admin" className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-foreground text-background">
              <Router className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-base font-semibold tracking-normal">ai-relay</span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Activity className="h-3 w-3 text-emerald-600" />
                API gateway
              </span>
            </span>
          </Link>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {navGroups.map((group) => (
            <div key={group.title} className="mb-5">
              <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-normal text-muted-foreground">
                {group.title}
              </div>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(pathname, item.href);
                  return (
                    <Link
                      key={`${group.title}-${item.label}`}
                      href={item.href}
                      className={cn(
                        "flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
                        active && "bg-secondary text-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="border-t p-4">
          <div className="mb-3 rounded-md border bg-secondary/45 p-3">
            <div className="text-sm font-medium">OpenAI compatible</div>
            <div className="mt-1 text-xs text-muted-foreground">/v1/chat/completions</div>
          </div>
          <LogoutButton />
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b bg-background/88 backdrop-blur">
          <div className="flex h-16 items-center justify-between px-4 sm:px-6">
            <Link href="/admin" className="flex items-center gap-3 lg:hidden">
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-foreground text-background">
                <Router className="h-5 w-5" />
              </span>
              <span className="font-semibold">ai-relay</span>
            </Link>
            <div className="hidden lg:block">
              <div className="text-sm font-medium">ai-relay 控制台</div>
              <div className="text-xs text-muted-foreground">轻量版中转管理控制台</div>
            </div>
            <LogoutButton />
          </div>
          <nav className="flex gap-1 overflow-x-auto px-4 pb-3 lg:hidden">
            {navGroups[0].items.map((item) => {
              const Icon = item.icon;
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "inline-flex h-9 shrink-0 items-center gap-2 rounded-md border px-3 text-sm text-muted-foreground",
                    active && "border-foreground bg-foreground text-background"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>
        <main className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
