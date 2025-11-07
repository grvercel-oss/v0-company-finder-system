"use client"

import { Home, Search, FolderOpen, Send, Inbox, BarChart3, Settings, Building2 } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { UserButton } from "@clerk/nextjs"
import { cn } from "@/lib/utils"

const navigation = [
  { name: "Dashboard", href: "/", icon: Home },
  { name: "Search", href: "/search", icon: Search },
  { name: "Lists", href: "/lists", icon: FolderOpen },
  { name: "Campaigns", href: "/campaigns", icon: Send },
  { name: "Inbox", href: "/inbox", icon: Inbox },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
  { name: "Settings", href: "/settings", icon: Settings },
]

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <div className="flex h-screen w-64 flex-col border-r border-border bg-card">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-border px-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
          <Building2 className="h-6 w-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-base font-bold leading-tight">Company Finder</h1>
          <p className="text-xs text-muted-foreground">B2B Lead Gen</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href + "/"))
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-all",
                isActive
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          )
        })}
      </nav>

      {/* User section */}
      <div className="border-t border-border p-4">
        <div className="flex items-center gap-3 rounded-lg bg-muted p-3">
          <UserButton afterSignOutUrl="/sign-in" />
          <div className="flex-1">
            <p className="text-sm font-medium">Account</p>
            <p className="text-xs text-muted-foreground">Profile settings</p>
          </div>
        </div>
      </div>
    </div>
  )
}
