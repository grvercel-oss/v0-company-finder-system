"use client"

import { useTheme } from "@/contexts/theme-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Moon, Sun } from "lucide-react"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Theme</CardTitle>
        <CardDescription>Choose your preferred color theme</CardDescription>
      </CardHeader>
      <CardContent>
        <RadioGroup value={theme} onValueChange={(value) => setTheme(value as "light" | "dark")}>
          <div className="grid gap-4">
            <div className="flex items-center space-x-4 rounded-lg border p-4 cursor-pointer hover:bg-accent transition-colors">
              <RadioGroupItem value="light" id="light" />
              <Label htmlFor="light" className="flex items-center gap-3 cursor-pointer flex-1">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-background border">
                  <Sun className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">Light</p>
                  <p className="text-sm text-muted-foreground">Clean, bright interface</p>
                </div>
              </Label>
            </div>

            <div className="flex items-center space-x-4 rounded-lg border p-4 cursor-pointer hover:bg-accent transition-colors">
              <RadioGroupItem value="dark" id="dark" />
              <Label htmlFor="dark" className="flex items-center gap-3 cursor-pointer flex-1">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-background border">
                  <Moon className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">Dark</p>
                  <p className="text-sm text-muted-foreground">Easy on the eyes in low light</p>
                </div>
              </Label>
            </div>
          </div>
        </RadioGroup>
      </CardContent>
    </Card>
  )
}
