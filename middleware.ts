import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// Public routes that don't require authentication
const publicRoutes = ["/login", "/signup"]
const publicApiRoutes = ["/api/auth/login", "/api/auth/signup", "/api/auth/session"]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (publicRoutes.includes(pathname) || publicApiRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.next()
  }

  const sessionCookie = request.cookies.get("account_session")

  if (!sessionCookie && !publicRoutes.includes(pathname)) {
    const loginUrl = new URL("/login", request.url)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

// Configure which routes to run middleware on
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
