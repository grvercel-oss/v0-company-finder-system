import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, ExternalLink } from "lucide-react"

export function ClerkSetupBanner() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-500" />
            Clerk Authentication Setup Required
          </CardTitle>
          <CardDescription>Your application requires Clerk authentication to be configured</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Missing Environment Variables</AlertTitle>
            <AlertDescription>
              The following Clerk environment variables are required:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>
                  <code className="text-sm bg-muted px-1 py-0.5 rounded">NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code>
                </li>
                <li>
                  <code className="text-sm bg-muted px-1 py-0.5 rounded">CLERK_SECRET_KEY</code>
                </li>
              </ul>
            </AlertDescription>
          </Alert>

          <div className="space-y-3">
            <h3 className="font-semibold">Setup Instructions:</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li>
                Go to{" "}
                <a
                  href="https://dashboard.clerk.com/sign-up"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  Clerk Dashboard
                  <ExternalLink className="h-3 w-3" />
                </a>{" "}
                and create a free account
              </li>
              <li>Create a new application in Clerk</li>
              <li>
                Navigate to{" "}
                <a
                  href="https://dashboard.clerk.com/last-active?path=api-keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  API Keys
                  <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li>Copy your Publishable Key and Secret Key</li>
              <li>
                In v0, click the <strong>Vars</strong> button in the left sidebar
              </li>
              <li>
                Add the following environment variables:
                <div className="mt-2 space-y-2 ml-4">
                  <div className="bg-muted p-2 rounded text-xs font-mono">
                    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
                  </div>
                  <div className="bg-muted p-2 rounded text-xs font-mono">CLERK_SECRET_KEY=sk_test_...</div>
                </div>
              </li>
              <li>Refresh this page after adding the environment variables</li>
            </ol>
          </div>

          <Alert variant="default" className="bg-blue-50 border-blue-200">
            <AlertDescription className="text-sm">
              <strong>Note:</strong> For detailed setup instructions, see the{" "}
              <code className="text-sm bg-muted px-1 py-0.5 rounded">CLERK_SETUP.md</code> file in your project.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  )
}
