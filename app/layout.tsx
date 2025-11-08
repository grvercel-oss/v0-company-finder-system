import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono, Source_Code_Pro } from "next/font/google"
import "./globals.css"
import { ClerkProvider } from "@clerk/nextjs"
import { ClerkSetupBanner } from "@/components/clerk-setup-banner"
import { ThemeProvider } from "@/contexts/theme-provider"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

const sourceCodePro = Source_Code_Pro({
  variable: "--font-source-code-pro",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
})

export const metadata: Metadata = {
  title: "Binfo - AI-Powered Business Intelligence",
  description: "Professional business intelligence and company finder system utilizing Perplexity and OpenAI",
  generator: "v0.app",
}

const isClerkConfigured = !!(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY)

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  if (!isClerkConfigured) {
    return (
      <html lang="en">
        <body className={`${sourceCodePro.variable} antialiased`}>
          <ClerkSetupBanner />
        </body>
      </html>
    )
  }

  return (
    <ClerkProvider signInUrl="/sign-in" signUpUrl="/sign-up" afterSignOutUrl="/">
      <html lang="en">
        <body className={`${sourceCodePro.variable} antialiased`}>
          <ThemeProvider>{children}</ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
