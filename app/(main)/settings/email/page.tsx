"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, ExternalLink, CheckCircle2, Loader2, RefreshCw, AlertCircle, Info } from "lucide-react"
import Link from "next/link"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useSearchParams } from "next/navigation"

export default function EmailSettingsPage() {
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [connected, setConnected] = useState(false)
  const [config, setConfig] = useState({
    account_email: "",
    account_name: "",
    data_center: "",
  })
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchConfig()

    const success = searchParams?.get("success")
    const errorParam = searchParams?.get("error")

    if (success) {
      setError(null)
      window.history.replaceState({}, "", "/settings/email")
      fetchConfig()
    } else if (errorParam) {
      setError(decodeURIComponent(errorParam))
      window.history.replaceState({}, "", "/settings/email")
    }
  }, [searchParams])

  const fetchConfig = async () => {
    try {
      const response = await fetch("/api/zoho/config")
      if (response.ok) {
        const data = await response.json()
        setConnected(data.connected)
        if (data.connected) {
          setConfig({
            account_email: data.account_email || "",
            account_name: data.account_name || "",
            data_center: data.data_center || "",
          })
        }
      }
    } catch (error) {
      console.error("Failed to fetch config:", error)
    }
  }

  const handleConnect = () => {
    setLoading(true)
    setError(null)
    window.location.href = "/api/zoho/oauth/initiate"
  }

  const handleDisconnect = async () => {
    if (!confirm("Are you sure you want to disconnect Zoho Mail?")) return

    setLoading(true)
    try {
      const response = await fetch("/api/zoho/config", { method: "DELETE" })
      if (response.ok) {
        setConnected(false)
        setConfig({
          account_email: "",
          account_name: "",
          data_center: "",
        })
        setError(null)
      }
    } catch (error) {
      console.error("Disconnect error:", error)
      setError("Failed to disconnect")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-3xl">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/campaigns">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Zoho Mail Integration</h1>
          <p className="text-muted-foreground">Connect your Zoho Mail account to send emails</p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Connection Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {connected && (
        <Alert className="mb-6">
          <Info className="h-4 w-4" />
          <AlertTitle>New Feature: Email Inbox & Reply Management</AlertTitle>
          <AlertDescription>
            We've added inbox functionality to track email replies and manage conversations. To use this feature, you
            need to <strong>reconnect your Zoho account</strong> to grant additional permissions for reading emails.
            Click "Disconnect" below, then "Connect with Zoho" again.
          </AlertDescription>
        </Alert>
      )}

      {connected && (
        <Alert className="mb-6">
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Connected</AlertTitle>
          <AlertDescription>
            Your Zoho Mail account is connected{config.account_email && ` as ${config.account_email}`}.
          </AlertDescription>
        </Alert>
      )}

      {!connected && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>How It Works</CardTitle>
            <CardDescription>Multi-tenant email sending powered by Zoho Mail API</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3 text-sm">
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
                  1
                </div>
                <div>
                  <p className="font-medium mb-1">Platform OAuth Setup (Admin Only)</p>
                  <p className="text-muted-foreground">
                    The platform administrator has already configured a Server-Based Application in Zoho API Console
                    with the necessary credentials stored as environment variables.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
                  2
                </div>
                <div>
                  <p className="font-medium mb-1">Connect Your Account</p>
                  <p className="text-muted-foreground">
                    Click "Connect with Zoho" below. You'll be redirected to Zoho to authorize this platform to send
                    emails and read replies on your behalf. After approval, you'll be automatically redirected back.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
                  3
                </div>
                <div>
                  <p className="font-medium mb-1">Start Sending & Managing Replies</p>
                  <p className="text-muted-foreground">
                    Once connected, all emails will be sent from YOUR Zoho account. You can also track replies and
                    manage conversations in the Inbox section.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{connected ? "Account Information" : "Connect Your Zoho Account"}</CardTitle>
          <CardDescription>
            {connected ? "Your connected Zoho account details" : "One-click OAuth connection"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!connected ? (
            <>
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <p className="text-sm font-medium">Ready to connect?</p>
                <p className="text-xs text-muted-foreground">
                  You'll be redirected to Zoho's secure authorization page. After approving, you'll be brought back here
                  automatically with your account connected.
                </p>
                <p className="text-xs text-muted-foreground pt-2 border-t">
                  <strong>Permissions requested:</strong> Send emails, read messages, manage inbox, and update message
                  status.
                </p>
              </div>

              <Button onClick={handleConnect} disabled={loading} className="w-full" size="lg">
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Connect with Zoho
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">Email Address</div>
                <div className="text-base font-medium">{config.account_email}</div>
              </div>

              {config.account_name && (
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">Account Name</div>
                  <div className="text-base font-medium">{config.account_name}</div>
                </div>
              )}

              {config.data_center && (
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">Data Center</div>
                  <div className="text-base font-medium">{config.data_center.toUpperCase()}</div>
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <Button onClick={fetchConfig} variant="outline" className="flex-1 bg-transparent">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
                <Button onClick={handleDisconnect} variant="destructive" className="flex-1" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Disconnect
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">For Administrators</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="text-muted-foreground">
            Platform administrators need to set up the following environment variables for the OAuth flow to work:
          </p>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-2">
            <li>
              <code className="text-xs bg-muted px-1 py-0.5 rounded">ZOHO_CLIENT_ID</code> - Server-based app client ID
            </li>
            <li>
              <code className="text-xs bg-muted px-1 py-0.5 rounded">ZOHO_CLIENT_SECRET</code> - Server-based app client
              secret
            </li>
            <li>
              <code className="text-xs bg-muted px-1 py-0.5 rounded">ZOHO_DATACENTER</code> - Data center (com, eu, in,
              etc.)
            </li>
          </ul>
          <p className="text-muted-foreground pt-2">
            <strong>Required OAuth Scopes:</strong> ZohoMail.messages.CREATE, ZohoMail.messages.READ,
            ZohoMail.messages.UPDATE, ZohoMail.accounts.READ, ZohoMail.settings.READ, ZohoMail.settings.UPDATE
          </p>
          <div className="pt-2">
            <Button variant="outline" size="sm" asChild className="w-full justify-start bg-transparent">
              <a
                href="https://www.zoho.com/accounts/protocol/oauth/web-server-applications.html"
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Server-Based OAuth Documentation
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
