"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Upload, FileText, CheckCircle } from "lucide-react"

interface CSVUploadProps {
  campaignId: string
  onUploadComplete: () => void
}

export function CSVUpload({ campaignId, onUploadComplete }: CSVUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [file, setFile] = useState<File | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
    }
  }

  const handleUpload = async () => {
    if (!file) return

    setUploading(true)

    try {
      const text = await file.text()
      const lines = text.split("\n").filter((line) => line.trim())

      if (lines.length < 2) {
        alert("CSV file must have at least a header row and one data row")
        return
      }

      // Parse CSV
      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase())
      const contacts = []

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(",").map((v) => v.trim())
        const contact: any = {}

        headers.forEach((header, index) => {
          if (header === "email") contact.email = values[index]
          else if (header === "first_name" || header === "firstname") contact.first_name = values[index]
          else if (header === "last_name" || header === "lastname") contact.last_name = values[index]
          else if (header === "company" || header === "company_name") contact.company_name = values[index]
          else if (header === "job_title" || header === "title") contact.job_title = values[index]
        })

        if (contact.email) {
          contacts.push(contact)
        }
      }

      if (contacts.length === 0) {
        alert("No valid contacts found in CSV. Make sure you have an 'email' column.")
        return
      }

      // Upload to API
      const response = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, contacts }),
      })

      if (!response.ok) throw new Error("Failed to upload contacts")

      const data = await response.json()
      alert(`Successfully uploaded ${data.count} contacts!`)
      setFile(null)
      onUploadComplete()
    } catch (error) {
      console.error("Upload error:", error)
      alert("Failed to upload contacts. Please try again.")
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Upload Contacts</CardTitle>
          <CardDescription>Upload a CSV file with your contact list</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border-2 border-dashed rounded-lg p-8 text-center">
            <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <div className="space-y-2">
              <label htmlFor="csv-upload" className="cursor-pointer">
                <div className="text-sm font-medium mb-1">
                  {file ? file.name : "Choose a CSV file or drag and drop"}
                </div>
                <div className="text-xs text-muted-foreground">CSV files only</div>
                <input id="csv-upload" type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
              </label>
              <Button variant="outline" onClick={() => document.getElementById("csv-upload")?.click()}>
                <FileText className="h-4 w-4 mr-2" />
                Select File
              </Button>
            </div>
          </div>

          {file && (
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="text-sm font-medium">{file.name}</span>
              </div>
              <Button onClick={handleUpload} disabled={uploading}>
                {uploading ? "Uploading..." : "Upload"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">CSV Format</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm space-y-2">
            <p className="text-muted-foreground">Your CSV should include these columns:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>
                <strong>email</strong> (required)
              </li>
              <li>first_name (optional)</li>
              <li>last_name (optional)</li>
              <li>company_name (optional)</li>
              <li>job_title (optional)</li>
            </ul>
            <p className="text-xs text-muted-foreground mt-4">
              Example: email,first_name,last_name,company_name,job_title
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
