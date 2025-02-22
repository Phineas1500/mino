'use client'

import { useState } from "react"
import { Upload, Loader2 } from "lucide-react"

const PI_SERVER = 'http://100.70.34.122:3001';

export function FileUpload() {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [processedUrl, setProcessedUrl] = useState<string | null>(null)
  const [progress, setProgress] = useState<{
    status: 'idle' | 'uploading' | 'processing' | 'done' | 'error'
    message: string
  }>({ status: 'idle', message: '' })
  const [uploadGlow, setUploadGlow] = useState(false)


  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setFile(file)
    setUploading(true)
    setUploadGlow(true)
    setProgress({ status: 'uploading', message: 'Uploading video...' })

    try {
      const formData = new FormData()
      formData.append('video', file)

      const response = await fetch(`${PI_SERVER}/upload`, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
        },
        credentials: 'omit'  // Change from 'include' to 'omit'
      })

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`)
      }

      const data = await response.json()
      
      if (data.success) {
        setProcessedUrl(data.url)
        setProgress({ 
          status: 'processing', 
          message: 'Video uploaded successfully! Processing...' 
        })
        
        // Here you could set up a polling mechanism to check processing status
        // For now, we'll just show a success message after a delay
        setTimeout(() => {
          setProgress({ 
            status: 'done', 
            message: 'Video processed successfully! Ready to play.' 
          })
        }, 2000)
      } else {
        throw new Error(data.error || 'Upload failed')
      }
    } catch (error) {
      console.error('Upload failed:', error)
      setProgress({ 
        status: 'error', 
        message: error instanceof Error ? error.message : 'Upload failed' 
      })
    } finally {
      setUploading(false)
      setTimeout(() => setUploadGlow(false), 1000)
    }
  }

  return (
    <div className="flex flex-col items-center gap-8">

      {uploadGlow && (
          <div className="absolute inset-0 flex items-center justify-center -z-10 pointer-events-none">
            <div className="w-[500%] h-[150%] rounded-full bg-blue-300/30 blur-3xl scale-0 animate-[glow_1s_ease-out]"></div>
          </div>
      )}
      <div className="relative w-full max-w-4xl bg-black aspect-[36/9] border border-muted-foreground/20 hover:border-muted-foreground/40 transition-colors rounded-lg p-8" >
        <input
          type="file"
          id="video-upload"
          className="hidden"
          accept="video/*"
          onChange={handleUpload}
          disabled={uploading}
        />
        <label
          htmlFor="video-upload"
          className="flex flex-col items-center cursor-pointer"
        >
          {progress.status === 'uploading' || progress.status === 'processing' ? (
            <Loader2 className="w-8 h-8 mb-4 text-muted-foreground animate-spin" />
          ) : (
            <Upload className="w-8 h-8 mb-4 text-muted-foreground" />
          )}
          <span className="text-base mb-1">
            {progress.status === 'idle' 
              ? "Drop your lecture video here"
              : progress.message
            }
          </span>
          <span className="text-sm text-muted-foreground">
            MP4, WebM, or MOV up to 2GB
          </span>
        </label>
        
        {file && (
          <div className="mt-4 text-sm text-muted-foreground">
            Selected: {file.name}
          </div>
        )}
        
        {progress.status !== 'idle' && (
          <div className={`mt-4 text-sm ${
            progress.status === 'error' ? 'text-red-500' : 
            progress.status === 'done' ? 'text-green-500' : 
            'text-blue-500'
          }`}>
            {progress.message}
          </div>
        )}
      </div>

      {processedUrl && progress.status === 'done' && (
        <div className="w-full max-w-2xl">
          <h2 className="text-lg font-semibold mb-4">Processed Video</h2>
          <video 
            src={processedUrl} 
            controls 
            className="w-full rounded-lg shadow-lg"
          />
        </div>
      )}
    </div>
  )
}