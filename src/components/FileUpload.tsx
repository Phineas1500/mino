"use client"

import type React from "react"

import { useState } from "react"
import { Upload } from "lucide-react"

export function FileUpload() {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
  
    setFile(file)
    setUploading(true)
  
    try {
      const formData = new FormData()
      formData.append('file', file)
  
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })
  
      if (!response.ok) {
        throw new Error('Upload failed')
      }
  
      const data = await response.json()
      console.log('Upload successful:', data)
    } catch (error) {
      console.error('Upload failed:', error)
    } finally {
      setUploading(false)
    }
  }
  
  return (
    <div className="border border-muted-foreground/20 hover:border-muted-foreground/40 transition-colors rounded-lg p-8">
      <input
        type="file"
        id="video-upload"
        className="hidden"
        accept="video/*"
        onChange={handleUpload}
        disabled={uploading}
      />
      <label htmlFor="video-upload" className="flex flex-col items-center cursor-pointer">
        <Upload className="w-8 h-8 mb-4 text-muted-foreground" />
        <span className="text-base mb-1">{uploading ? "Uploading..." : "Drop your lecture video here"}</span>
        <span className="text-sm text-muted-foreground">MP4, WebM, or MOV up to 2GB</span>
      </label>
      {file && <div className="mt-4 text-sm text-muted-foreground">Selected: {file.name}</div>}
    </div>
  )
}

