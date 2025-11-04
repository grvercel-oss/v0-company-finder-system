import { SignInButton, SignUpButton, SignedIn, SignedOut } from "@clerk/nextjs"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Search, Database, Brain, Shield, Zap, TrendingUp, ArrowRight, Sparkles } from "lucide-react"
import Link from "next/link"
import { redirect } from "next/navigation"
import { currentUser } from "@clerk/nextjs/server"

export default async function LandingPage() {
  const user = await currentUser()
  if (user) {
    redirect("/dashboard")
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-lg supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
              <Search className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Company Finder
            </span>
          </div>
          <div className="flex items-center gap-3">
            <SignedOut>
              <SignInButton mode="modal">
                <Button variant="ghost" size="lg" className="font-semibold">
                  Sign In
                </Button>
              </SignInButton>
              <SignUpButton mode="modal">
                <Button
                  size="lg"
                  className="font-semibold shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all"
                >
                  Get Started Free
                </Button>
              </SignUpButton>
            </SignedOut>
            <SignedIn>
              <Button size="lg" asChild className="font-semibold">
                <Link href="/dashboard">Go to Dashboard</Link>
              </Button>
            </SignedIn>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="container mx-auto px-4 py-24 md:py-32">
        <div className="max-w-5xl mx-auto text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-primary/15 via-primary/10 to-primary/5 border border-primary/20 text-primary text-sm font-semibold mb-4">
            <Sparkles className="h-4 w-4" />
            AI-Powered Business Intelligence
          </div>

          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-balance leading-tight">
            <span className="bg-gradient-to-r from-foreground via-foreground to-foreground/70 bg-clip-text text-transparent">
              Discover Companies with
            </span>
            <br />
            <span className="bg-gradient-to-r from-primary via-primary to-primary/70 bg-clip-text text-transparent">
              AI-Powered Intelligence
            </span>
          </h1>

          <p className="text-xl md:text-2xl text-muted-foreground text-balance max-w-3xl mx-auto leading-relaxed">
            Professional company finder and information scraper system utilizing Perplexity and OpenAI for accurate,
            reliable business intelligence.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8">
            <SignedOut>
              <SignUpButton mode="modal">
                <Button
                  size="lg"
                  className="text-lg px-8 py-6 font-bold shadow-2xl shadow-primary/30 hover:shadow-primary/40 hover:scale-105 transition-all"
                >
                  Get Started Free
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </SignUpButton>
              <SignInButton mode="modal">
                <Button
                  size="lg"
                  variant="outline"
                  className="text-lg px-8 py-6 font-semibold border-2 hover:bg-accent hover:scale-105 transition-all bg-transparent"
                >
                  Sign In
                </Button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <Button size="lg" asChild className="text-lg px-8 py-6 font-bold">
                <Link href="/search">
                  <Search className="mr-2 h-5 w-5" />
                  Start Searching
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                asChild
                className="text-lg px-8 py-6 font-semibold border-2 bg-transparent"
              >
                <Link href="/dashboard">View Dashboard</Link>
              </Button>
            </SignedIn>
          </div>

          <p className="text-sm text-muted-foreground pt-4">
            No credit card required • Free to start • Enterprise-grade security
          </p>
        </div>
      </div>

      {/* Features Section */}
      <div className="container mx-auto px-4 py-20 bg-gradient-to-b from-transparent to-muted/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-balance">Enterprise Features</h2>
            <p className="text-muted-foreground text-xl">Built for scalability, security, and professional use</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="border-2 hover:border-primary/50 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
              <CardContent className="pt-8 pb-6">
                <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center mb-4">
                  <Search className="h-7 w-7 text-primary-foreground" />
                </div>
                <h3 className="text-xl font-bold mb-3">AI-Powered Search</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Leverage Perplexity AI to find companies with natural language queries and intelligent matching
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-primary/50 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
              <CardContent className="pt-8 pb-6">
                <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center mb-4">
                  <Brain className="h-7 w-7 text-primary-foreground" />
                </div>
                <h3 className="text-xl font-bold mb-3">Smart Enrichment</h3>
                <p className="text-muted-foreground leading-relaxed">
                  OpenAI automatically summarizes and extracts relevant information from company data
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-primary/50 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
              <CardContent className="pt-8 pb-6">
                <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center mb-4">
                  <Database className="h-7 w-7 text-primary-foreground" />
                </div>
                <h3 className="text-xl font-bold mb-3">Comprehensive Profiles</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Detailed company profiles with industry, location, size, technologies, and more
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-primary/50 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
              <CardContent className="pt-8 pb-6">
                <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center mb-4">
                  <Shield className="h-7 w-7 text-primary-foreground" />
                </div>
                <h3 className="text-xl font-bold mb-3">Data Quality Scoring</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Automated quality assessment ensures reliable and accurate company information
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-primary/50 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
              <CardContent className="pt-8 pb-6">
                <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center mb-4">
                  <TrendingUp className="h-7 w-7 text-primary-foreground" />
                </div>
                <h3 className="text-xl font-bold mb-3">Advanced Filtering</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Filter by industry, location, company size, verification status, and more
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-primary/50 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
              <CardContent className="pt-8 pb-6">
                <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center mb-4">
                  <Zap className="h-7 w-7 text-primary-foreground" />
                </div>
                <h3 className="text-xl font-bold mb-3">Real-Time Updates</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Track changes and updates to company data with comprehensive audit trails
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="container mx-auto px-4 py-20">
        <Card className="max-w-4xl mx-auto bg-gradient-to-br from-primary via-primary to-primary/80 text-primary-foreground border-0 shadow-2xl">
          <CardContent className="p-12 md:p-16 text-center space-y-6">
            <h2 className="text-4xl md:text-5xl font-bold text-balance">Ready to Get Started?</h2>
            <p className="text-xl md:text-2xl opacity-95 text-balance max-w-2xl mx-auto">
              Start discovering companies with enterprise-grade AI intelligence today
            </p>
            <div className="pt-4">
              <SignedOut>
                <SignUpButton mode="modal">
                  <Button
                    size="lg"
                    variant="secondary"
                    className="text-lg px-8 py-6 font-bold shadow-xl hover:scale-105 transition-all"
                  >
                    Create Free Account
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </SignUpButton>
              </SignedOut>
              <SignedIn>
                <Button size="lg" variant="secondary" asChild className="text-lg px-8 py-6 font-bold">
                  <Link href="/search">
                    <Search className="mr-2 h-5 w-5" />
                    Launch Company Finder
                  </Link>
                </Button>
              </SignedIn>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <footer className="border-t mt-16 bg-muted/30">
        <div className="container mx-auto px-4 py-8 text-center text-sm text-muted-foreground">
          <p>© 2025 Company Finder. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
