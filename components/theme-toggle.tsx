"use client"

import { useTheme } from "@/contexts/theme-provider"
import { Moon, Sun } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {theme === "dark" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
          Appearance
        </CardTitle>
        <CardDescription>Choose your preferred theme</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="text-sm font-medium">Theme</div>
            <div className="text-sm text-muted-foreground">
              Currently using {theme === "dark" ? "dark" : "light"} mode
            </div>
          </div>
          <Button onClick={toggleTheme} variant="outline" size="lg" className="w-32 bg-transparent">
            {theme === "dark" ? (
              <>
                <Sun className="h-4 w-4 mr-2" />
                Light
              </>
            ) : (
              <>
                <Moon className="h-4 w-4 mr-2" />
                Dark
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
