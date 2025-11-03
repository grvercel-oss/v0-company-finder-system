"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Search, Database, Brain, Shield, Zap, TrendingUp } from "lucide-react"
import Link from "next/link"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            <Zap className="h-4 w-4" />
            Enterprise-Grade Intelligence
          </div>
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-balance">
            Discover Companies with AI-Powered Intelligence
          </h1>
          <p className="text-xl text-muted-foreground text-balance max-w-2xl mx-auto">
            Professional company finder and information scraper system utilizing Perplexity and OpenAI for accurate,
            reliable business intelligence.
          </p>
          <div className="flex gap-4 justify-center pt-4">
            <Button size="lg" asChild>
              <Link href="/search">
                <Search className="mr-2 h-5 w-5" />
                Start Searching
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/dashboard">View Dashboard</Link>
            </Button>
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
              <CardHeader>
                <Search className="h-10 w-10 text-primary mb-2" />
                <CardTitle>AI-Powered Search</CardTitle>
                <CardDescription>
                  Leverage Perplexity AI to find companies with natural language queries and intelligent matching
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <Brain className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Smart Enrichment</CardTitle>
                <CardDescription>
                  OpenAI automatically summarizes and extracts relevant information from company data
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <Database className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Comprehensive Profiles</CardTitle>
                <CardDescription>
                  Detailed company profiles with industry, location, size, technologies, and more
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <Shield className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Data Quality Scoring</CardTitle>
                <CardDescription>
                  Automated quality assessment ensures reliable and accurate company information
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <TrendingUp className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Advanced Filtering</CardTitle>
                <CardDescription>
                  Filter by industry, location, company size, verification status, and more
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <Zap className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Real-Time Updates</CardTitle>
                <CardDescription>
                  Track changes and updates to company data with comprehensive audit trails
                </CardDescription>
              </CardHeader>
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
            <Button size="lg" variant="secondary" asChild>
              <Link href="/search">
                <Search className="mr-2 h-5 w-5" />
                Launch Company Finder
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
