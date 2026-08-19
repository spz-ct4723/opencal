"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Calendar,
  RefreshCw,
  Link2,
  Inbox,
  Users,
  Settings,
  Layers,
  Share2,
  LogOut,
  CalendarDays,
} from "lucide-react";
import { signOut } from "next-auth/react";

const nav = [
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/syncs", label: "Calendar Sync", icon: RefreshCw },
  { href: "/scheduling", label: "Scheduling Links", icon: Link2 },
  { href: "/bookings", label: "Bookings", icon: Inbox },
  { href: "/accounts", label: "Accounts", icon: Layers },
  { href: "/team", label: "Team", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({
  user,
}: {
  user?: { name?: string | null; email?: string | null; username?: string };
}) {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col bg-sidebar text-sidebar-fg">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white">
          <Calendar className="h-4 w-4" />
        </div>
        <div>
          <div className="text-sm font-bold tracking-tight text-white">
            OpenCal
          </div>
          <div className="text-[10px] uppercase tracking-wider text-slate-400">
            Open source
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 px-3 py-2">
        {nav.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-white/10 text-white"
                  : "text-slate-300 hover:bg-white/5 hover:text-white"
              )}
            >
              <Icon className="h-4 w-4 shrink-0 opacity-80" />
              {item.label}
            </Link>
          );
        })}
        <Link
          href="/settings#share"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-white/5 hover:text-white"
        >
          <Share2 className="h-4 w-4 shrink-0 opacity-80" />
          Calendar Sharing
        </Link>
      </nav>

      <div className="border-t border-white/10 p-4">
        <div className="mb-3 truncate text-xs text-slate-400">
          <div className="truncate font-medium text-slate-200">
            {user?.name || "User"}
          </div>
          <div className="truncate">{user?.email}</div>
          {user?.username && (
            <div className="mt-1 text-slate-500">@{user.username}</div>
          )}
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-400 hover:bg-white/5 hover:text-white cursor-pointer"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
