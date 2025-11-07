"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Building2, Search, FolderOpen, Mail, BarChart3, Settings, Inbox } from "lucide-react"
import { cn } from "@/lib/utils"
import { UserButton, useUser } from "@clerk/nextjs"

export function Navigation() {
  const pathname = usePathname()
  const { isLoaded, isSignedIn } = useUser()

  const links = [
    { href: "/", label: "Home", icon: Building2 },
    { href: "/search", label: "Search", icon: Search },
    { href: "/lists", label: "Lists", icon: FolderOpen },
    { href: "/campaigns", label: "Campaigns", icon: Mail },
    { href: "/inbox", label: "Inbox", icon: Inbox },
    { href: "/analytics", label: "Analytics", icon: BarChart3 },
    { href: "/settings", label: "Settings", icon: Settings },
  ]

  return (
    <nav className="border-b bg-card">
      <div className="container mx-auto px-4">
        <div className="flex items-center gap-6 h-16">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg">
            <Building2 className="h-6 w-6" />
            <span>Binfo</span>
          </Link>
          <div className="flex gap-1 ml-auto items-center">
            {links.map((link) => {
              const Icon = link.icon
              const isActive = pathname === link.href || pathname?.startsWith(link.href + "/")
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {link.label}
                </Link>
              )
            })}

            {isLoaded && isSignedIn && (
              <div className="ml-2">
                <UserButton
                  afterSignOutUrl="/"
                  appearance={{
                    elements: {
                      avatarBox: "h-10 w-10",
                    },
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
