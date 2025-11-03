"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useState, useEffect } from "react"
import { Loader2, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import Image from "next/image"

interface EmailProvider {
  id: string
  name: string
  displayName: string
  logo: string
  connectUrl: string
}

const providers: EmailProvider[] = [
  {
    id: "outlook",
    name: "Outlook",
    displayName: "Microsoft Outlook",
    logo: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Microsoft_Outlook_logo_%282024%E2%80%932025%29.svg-hbnw6z6H0Yggj28pJb1t6MlxveHi03.png",
    connectUrl: "/api/outlook/oauth/initiate",
  },
  {
    id: "gmail",
    name: "Gmail",
    displayName: "Gmail",
    logo: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Gmail_icon_%282020%29.svg-7fzrXzltYTUg2fR1s7lUQzJb6LZuJz.png",
    connectUrl: "#",
  },
  {
    id: "zoho",
    name: "Zoho",
    displayName: "Zoho Mail",
    logo: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/zoho-logo-512-MURDH2sv880dMkNvUcynJMNLhOtl5F.png",
    connectUrl: "/api/zoho/oauth/initiate",
  },
]

interface ConnectionStatus {
  connected: boolean
  provider: string | null
  email: string | null
  name?: string
}

export function EmailConnectionCard() {
  const [hoveredProvider, setHoveredProvider] = useState<string | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [disconnecting, setDisconnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchConnectionStatus()
  }, [])

  const fetchConnectionStatus = async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/email/connection-status")
      const data = await response.json()
      setConnectionStatus(data)
    } catch (err) {
      console.error("Failed to fetch connection status:", err)
      setError("Failed to load connection status")
    } finally {
      setLoading(false)
    }
  }

  const handleConnect = (provider: EmailProvider) => {
    if (provider.connectUrl === "#") {
      alert(`${provider.name} integration coming soon!`)
      return
    }
    window.location.href = provider.connectUrl
  }

  const handleDisconnect = async () => {
    if (!connectionStatus?.provider) return

    if (!confirm(`Are you sure you want to disconnect ${connectionStatus.provider}?`)) return

    setDisconnecting(true)
    setError(null)

    try {
      const endpoint = connectionStatus.provider === "zoho" ? "/api/zoho/config" : "/api/outlook/config"

      const response = await fetch(endpoint, { method: "DELETE" })

      if (!response.ok) {
        throw new Error("Failed to disconnect")
      }

      // Refresh connection status
      await fetchConnectionStatus()
    } catch (err) {
      console.error("Disconnect error:", err)
      setError("Failed to disconnect. Please try again.")
    } finally {
      setDisconnecting(false)
    }
  }

  if (loading) {
    return (
      <Card className="w-full max-w-5xl mx-auto border-2">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (connectionStatus?.connected && connectionStatus.provider) {
    const connectedProvider = providers.find((p) => p.id === connectionStatus.provider)

    return (
      <div className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card className="w-full max-w-5xl mx-auto border-2">
          <CardContent className="py-12">
            <div className="flex flex-col items-center gap-8">
              <div className="w-full max-w-3xl rounded-3xl border-2 border-border bg-card p-8">
                <div className="flex items-center justify-between gap-8">
                  {/* Logo */}
                  <div className="relative h-32 w-32 flex-shrink-0">
                    <Image
                      src={connectedProvider?.logo || "/placeholder.svg"}
                      alt={`${connectedProvider?.name} logo`}
                      fill
                      className="object-contain"
                    />
                  </div>

                  {/* Service name - removed email display */}
                  <div className="flex-1">
                    <h3 className="text-3xl font-bold text-center">{connectedProvider?.displayName}</h3>
                  </div>

                  {/* Connected badge */}
                  <div className="flex-shrink-0">
                    <div className="rounded-full bg-green-500 px-8 py-4">
                      <span className="text-xl font-bold text-white">CONNECTED</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Disconnect button */}
              <Button
                onClick={handleDisconnect}
                disabled={disconnecting}
                variant="destructive"
                size="lg"
                className="w-full max-w-md"
              >
                {disconnecting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Disconnecting...
                  </>
                ) : (
                  "Disconnect"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card className="w-full max-w-5xl mx-auto border-2">
        <CardHeader className="text-center pb-8">
          <CardTitle className="text-4xl font-bold">Connect your email</CardTitle>
          <CardDescription className="text-base">Choose your email provider to get started</CardDescription>
        </CardHeader>
        <CardContent className="px-12 pb-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 justify-items-center">
            {providers.map((provider) => (
              <button
                key={provider.id}
                onClick={() => handleConnect(provider)}
                onMouseEnter={() => setHoveredProvider(provider.id)}
                onMouseLeave={() => setHoveredProvider(null)}
                className="group relative aspect-square w-full max-w-sm rounded-3xl border-2 border-border bg-gradient-to-br from-primary/10 to-primary/5 p-12 transition-all duration-300 hover:border-primary hover:shadow-xl hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <div className="flex h-full flex-col items-center justify-center gap-6">
                  <div className="relative h-40 w-40 transition-transform duration-300 group-hover:scale-110">
                    <Image
                      src={provider.logo || "/placeholder.svg"}
                      alt={`${provider.name} logo`}
                      fill
                      className="object-contain"
                    />
                  </div>
                  <div
                    className={`text-center transition-opacity duration-300 ${
                      hoveredProvider === provider.id ? "opacity-100" : "opacity-0"
                    }`}
                  >
                    <p className="text-base font-semibold text-foreground">Connect to {provider.name}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Info card */}
      <Card className="w-full max-w-5xl mx-auto">
        <CardHeader>
          <CardTitle className="text-xl">Ready to connect?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            You'll be redirected to secure authorization page. After approving, you'll be brought back here
            automatically with your account connected.
          </p>
          <div className="pt-2 border-t">
            <p className="text-sm font-medium mb-2">Permissions requested:</p>
            <p className="text-sm text-muted-foreground">Send emails, read messages, and manage your mailbox.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
