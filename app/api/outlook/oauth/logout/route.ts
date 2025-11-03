import { NextResponse } from "next/server"

/**
 * Front-channel logout endpoint for Microsoft Azure AD
 *
 * Register this URL in Azure Portal:
 * https://your-domain.vercel.app/api/outlook/oauth/logout
 *
 * When a user signs out from Microsoft, Azure will send a GET request here
 * to notify the app to clear the session.
 */
export async function GET(request: Request) {
  console.log("[v0] [OUTLOOK-LOGOUT] Front-channel logout request received")

  try {
    const { searchParams } = new URL(request.url)
    const sid = searchParams.get("sid") // Session ID from Microsoft
    const iss = searchParams.get("iss") // Issuer

    console.log("[v0] [OUTLOOK-LOGOUT] Session ID:", sid)
    console.log("[v0] [OUTLOOK-LOGOUT] Issuer:", iss)

    // If we have a session ID, we could use it to identify which user to log out
    // For now, we'll just log the request
    // In a production app, you might want to store the sid when creating the session
    // and use it here to identify which user to log out

    // Return a simple HTML page confirming logout
    // Microsoft expects an HTML response, not JSON
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Logged Out</title>
          <meta charset="utf-8">
        </head>
        <body>
          <h1>Logged Out</h1>
          <p>You have been logged out from Outlook.</p>
          <script>
            // Optional: Close the window or redirect
            console.log('Front-channel logout completed');
          </script>
        </body>
      </html>
    `

    console.log("[v0] [OUTLOOK-LOGOUT] Logout processed successfully")

    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html",
      },
    })
  } catch (error) {
    console.error("[v0] [OUTLOOK-LOGOUT] Error processing logout:", error)

    // Still return HTML even on error
    const errorHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Logout Error</title>
          <meta charset="utf-8">
        </head>
        <body>
          <h1>Logout Error</h1>
          <p>An error occurred during logout.</p>
        </body>
      </html>
    `

    return new NextResponse(errorHtml, {
      status: 500,
      headers: {
        "Content-Type": "text/html",
      },
    })
  }
}

/**
 * Optional: POST endpoint for back-channel logout
 * This is used if you configure back-channel logout in Azure
 */
export async function POST(request: Request) {
  console.log("[v0] [OUTLOOK-LOGOUT] Back-channel logout request received")

  try {
    const body = await request.text()
    console.log("[v0] [OUTLOOK-LOGOUT] Logout token:", body)

    // Parse the logout token (JWT) if needed
    // For now, just acknowledge receipt

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] [OUTLOOK-LOGOUT] Error processing back-channel logout:", error)
    return NextResponse.json({ error: "Logout failed" }, { status: 500 })
  }
}
