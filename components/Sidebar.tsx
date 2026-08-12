"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  FileStack,
  ScanSearch,
  MapPinned,
  UserCheck,
  Sparkles,
  Zap,
  Compass,
  Globe,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Sentinel Core", href: "/sentinel", icon: Zap },
  { label: "Compass Core", href: "/compass", icon: Compass },
  { label: "Atlas Intel", href: "/atlas", icon: Globe },
  { label: "Decision Center", href: "/", icon: LayoutDashboard },
  { label: "Sentinel", href: "/xray", icon: ScanSearch },
  { label: "Trustline Portal", href: "/trustline", icon: Building2 },
  { label: "Receipt Center", href: "/evidence", icon: FileStack },
  { label: "Supplier Workspace", href: "/supplier/steelcorp", icon: UserCheck },
  { label: "Mobile Site Capture", href: "/site", icon: MapPinned },
  { label: "Landing Page", href: "/landing", icon: Sparkles },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary navigation"
      className="hidden h-screen w-[220px] shrink-0 flex-col border-r border-muted bg-background md:flex"
    >
      <div className="flex h-16 items-center px-6 border-b border-muted/50">
        <Link href="/" className="text-emphasis font-bold tracking-tight text-foreground">
          ORCHESTRA
        </Link>
      </div>

      <ul className="flex flex-1 flex-col gap-1 px-3 py-4">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "group flex items-center gap-3 rounded-md border-l-2 border-transparent px-3 py-2 text-body transition-colors",
                  isActive
                    ? "border-accent text-foreground bg-muted/20 font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/10"
                )}
              >
                <item.icon
                  className={cn(
                    "h-4 w-4 shrink-0 transition-colors",
                    isActive ? "text-accent" : "text-muted-foreground group-hover:text-foreground"
                  )}
                  strokeWidth={1.75}
                />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
