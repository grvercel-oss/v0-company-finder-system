import { SignInButton, SignUpButton, SignedIn, SignedOut } from "@clerk/nextjs"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Search, Database, Brain, Shield, Zap, TrendingUp, ArrowRight } from "lucide-react"
import Link from "next/link"
import { redirect } from "next/navigation"
import { currentUser } from "@clerk/nextjs/server"

export default async function LandingPage() {
  const user = await currentUser()
  if (user) {
    redirect("/dashboard")
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Search className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">Company Finder</span>
          </div>
          <div className="flex items-center gap-3">
            <SignedOut>
              <SignInButton mode="modal">
                <Button variant="ghost">Sign In</Button>
              </SignInButton>
              <SignUpButton mode="modal">
                <Button>Get Started</Button>
              </SignUpButton>
            </SignedOut>
            <SignedIn>
              <Button asChild>
                <Link href="/dashboard">Go to Dashboard</Link>
              </Button>
            </SignedIn>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="container mx-auto px-4 py-20">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            <Zap className="h-4 w-4" />
            AI-Powered Business Intelligence
          </div>
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-balance">
            Discover Companies with AI-Powered Intelligence
          </h1>
          <p className="text-xl text-muted-foreground text-balance max-w-2xl mx-auto">
            Professional company finder and information scraper system utilizing Perplexity and OpenAI for accurate,
            reliable business intelligence.
          </p>
          <div className="flex gap-4 justify-center pt-6">
            <SignedOut>
              <SignUpButton mode="modal">
                <Button size="lg">
                  Get Started Free
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </SignUpButton>
              <SignInButton mode="modal">
                <Button size="lg" variant="outline">
                  Sign In
                </Button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <Button size="lg" asChild>
                <Link href="/search">
                  <Search className="mr-2 h-5 w-5" />
                  Start Searching
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/dashboard">View Dashboard</Link>
              </Button>
            </SignedIn>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Enterprise Features</h2>
            <p className="text-muted-foreground text-lg">Built for scalability, security, and professional use</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardContent className="pt-6">
                <Search className="h-10 w-10 text-primary mb-4" />
                <h3 className="text-xl font-semibold mb-2">AI-Powered Search</h3>
                <p className="text-muted-foreground">
                  Leverage Perplexity AI to find companies with natural language queries and intelligent matching
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <Brain className="h-10 w-10 text-primary mb-4" />
                <h3 className="text-xl font-semibold mb-2">Smart Enrichment</h3>
                <p className="text-muted-foreground">
                  OpenAI automatically summarizes and extracts relevant information from company data
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <Database className="h-10 w-10 text-primary mb-4" />
                <h3 className="text-xl font-semibold mb-2">Comprehensive Profiles</h3>
                <p className="text-muted-foreground">
                  Detailed company profiles with industry, location, size, technologies, and more
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <Shield className="h-10 w-10 text-primary mb-4" />
                <h3 className="text-xl font-semibold mb-2">Data Quality Scoring</h3>
                <p className="text-muted-foreground">
                  Automated quality assessment ensures reliable and accurate company information
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <TrendingUp className="h-10 w-10 text-primary mb-4" />
                <h3 className="text-xl font-semibold mb-2">Advanced Filtering</h3>
                <p className="text-muted-foreground">
                  Filter by industry, location, company size, verification status, and more
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <Zap className="h-10 w-10 text-primary mb-4" />
                <h3 className="text-xl font-semibold mb-2">Real-Time Updates</h3>
                <p className="text-muted-foreground">
                  Track changes and updates to company data with comprehensive audit trails
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="container mx-auto px-4 py-16">
        <Card className="max-w-4xl mx-auto bg-primary text-primary-foreground">
          <CardContent className="p-12 text-center space-y-6">
            <h2 className="text-3xl font-bold">Ready to Get Started?</h2>
            <p className="text-lg opacity-90">
              Start discovering companies with enterprise-grade AI intelligence today
            </p>
            <SignedOut>
              <SignUpButton mode="modal">
                <Button size="lg" variant="secondary">
                  Create Free Account
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </SignUpButton>
            </SignedOut>
            <SignedIn>
              <Button size="lg" variant="secondary" asChild>
                <Link href="/search">
                  <Search className="mr-2 h-5 w-5" />
                  Launch Company Finder
                </Link>
              </Button>
            </SignedIn>
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <footer className="border-t mt-16">
        <div className="container mx-auto px-4 py-8 text-center text-sm text-muted-foreground">
          <p>© 2025 Company Finder. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
