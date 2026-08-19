"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  BedDouble,
  ClipboardList,
  CalendarDays,
  BarChart3,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  {
    name: "Bookings",
    href: "/bookings",
    icon: ClipboardList,
    roles: ["GENERAL_MANAGER", "MANAGER", "STAFF"],
  },
  {
    name: "Calendar",
    href: "/calendar",
    icon: CalendarDays,
    roles: ["GENERAL_MANAGER", "MANAGER", "STAFF"],
  },
  {
    name: "Rooms",
    href: "/rooms",
    icon: BedDouble,
    roles: ["GENERAL_MANAGER"],
  },
  {
    name: "Reports",
    href: "/reports",
    icon: BarChart3,
    roles: ["GENERAL_MANAGER", "MANAGER"],
  },
  {
    name: "Staff",
    href: "/staff",
    icon: Users,
    roles: ["GENERAL_MANAGER"],
  },
];

interface SidebarProps {
  onNavigate?: () => void;
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const userRole = session?.user?.role || "STAFF";

  const filteredNavigation = navigation.filter((item) =>
    item.roles.includes(userRole)
  );

  const handleNavClick = () => {
    // Small delay to show the tap effect before closing
    if (onNavigate) {
      setTimeout(() => {
        onNavigate();
      }, 150);
    }
  };

  return (
    <div className="flex h-full w-52 flex-col bg-navy">
      {/* Logo */}
      <div className="flex py-3 items-center justify-center border-b border-navy-light">
        <Link href="/bookings" onClick={handleNavClick}>
          <div className="relative w-48 h-28">
            <Image
              src="/logo.png"
              alt="Scone Willow Tree"
              fill
              className="object-contain"
            />
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {filteredNavigation.map((item, index) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={handleNavClick}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium",
                "transition-all duration-200 ease-out",
                "active:scale-95 active:opacity-80",
                isActive
                  ? "bg-gold text-navy shadow-md"
                  : "text-cream/80 hover:bg-navy-light hover:text-cream"
              )}
              style={{
                animationDelay: `${index * 50}ms`,
              }}
            >
              <item.icon className={cn(
                "h-5 w-5 transition-transform duration-200",
                isActive && "scale-110"
              )} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-navy-light p-4">
        <p className="text-xs text-cream/60 text-center">
          Booking Management v1.0
        </p>
      </div>
    </div>
  );
}
