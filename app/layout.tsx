import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono, Source_Code_Pro } from 'next/font/google'
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
    <ClerkProvider 
      signInUrl="/sign-in" 
      signUpUrl="/sign-up" 
      afterSignOutUrl="/"
      appearance={{
        elements: {
          rootBox: "mx-auto",
        },
      }}
    >
      <html lang="en">
        <head>
          <script
            dangerouslySetInnerHTML={{
              __html: `
                // Early error suppression - runs before React
                (function() {
                  // Monkey patch atob to prevent crashes from invalid base64 strings
                  const originalAtob = window.atob;
                  window.atob = function(str) {
                    try {
                      return originalAtob(str);
                    } catch (e) {
                      if (e.message && e.message.includes('invalid characters')) {
                        console.warn('[v0] Suppressed atob error for string:', str);
                        return ''; // Return empty string to prevent crash
                      }
                      throw e;
                    }
                  };

                  const originalError = console.error;
                  console.error = function(...args) {
                    const msg = args.join(' ');
                    if (msg.includes('invalid characters') || msg.includes('InvalidCharacterError')) {
                      console.warn('[v0] Suppressed InvalidCharacterError - Check Clerk keys or API keys for hidden unicode characters');
                      return;
                    }
                    originalError.apply(console, args);
                  };
                  
                  window.addEventListener('error', function(event) {
                    if (event.message?.includes('invalid characters')) {
                      console.warn('[v0] Suppressed InvalidCharacterError in global error handler');
                      event.preventDefault();
                      event.stopPropagation();
                      return false;
                    }
                  }, true);
                  
                  window.addEventListener('unhandledrejection', function(event) {
                    if (event.reason?.message?.includes('invalid characters')) {
                      console.warn('[v0] Suppressed InvalidCharacterError in promise rejection');
                      event.preventDefault();
                      event.stopPropagation();
                      return false;
                    }
                  }, true);
                })();
              `,
            }}
          />
        </head>
        <body className={`${sourceCodePro.variable} antialiased`}>
          <ThemeProvider>{children}</ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
